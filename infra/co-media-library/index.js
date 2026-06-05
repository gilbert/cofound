import { createHash } from 'node:crypto'
import { mkdir, open, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const DEFAULT_FINGERPRINT_BYTES = 1024 * 1024

let mediaFile

export async function openLibrary(options = {}) {
  const storage = requireStorage(options.storage)
  const roots = requireRoots(options.roots)
  const records = new Map()

  for (const record of await storage.loadAll()) {
    if (record?.id) records.set(record.id, record)
  }

  return {
    scan: async(scanOptions = {}) => {
      const settings = { ...options, ...scanOptions }
      const now = new Date().toISOString()
      const current = await currentFiles(roots, settings)
      const pathRecords = recordsByPathId(records)
      const moves = findMoves({ current, pathRecords, records, roots })
      const seenIds = new Set()
      const seenPathIds = new Set()
      const stats = { added: 0, changed: 0, unchanged: 0, moved: 0, deleted: 0 }

      for (const file of current) {
        const movedFrom = moves.get(file.pathId)
        const previous = movedFrom || pathRecords.get(file.pathId)
        const id = previous?.id || file.pathId
        const moved = movedFrom && recordPathId(movedFrom) !== file.pathId
        const changed = !previous || previous.size !== file.size || previous.mtimeMs !== file.mtimeMs || previous.fingerprint !== file.fingerprint || previous.deleted
        let probe = previous?.probe

        seenIds.add(id)
        seenPathIds.add(file.pathId)
        if (changed && settings.probe) probe = await settings.probe(file.path, { previous })

        const record = {
          ...file,
          id,
          scannedAt: now,
          probe,
          metadata: previous?.metadata || {},
          deleted: false,
          ...(moved ? { movedFrom: movedFrom.rel, movedAt: now } : {}),
        }

        records.set(id, record)
        if (moved) {
          stats.moved++
          await storage.saveOne(record)
        } else if (changed) {
          previous && !previous.deleted ? stats.changed++ : stats.added++
          await storage.saveOne(record)
        } else {
          stats.unchanged++
        }
      }

      for (const record of records.values()) {
        if (record.deleted || !roots.includes(record.root) || seenIds.has(record.id) || seenPathIds.has(recordPathId(record))) continue
        const next = { ...record, deleted: true, deletedAt: now, scannedAt: now }
        records.set(next.id, next)
        stats.deleted++
        await storage.saveOne(next)
      }

      return { ...stats, total: items().length }
    },
    items,
    get(id) {
      const record = records.get(id)
      return record && !record.deleted ? record : null
    },
    async update(id, patch = {}) {
      const record = records.get(id)
      if (!record || record.deleted) return null

      const next = {
        ...record,
        ...patch,
        metadata: merge(record.metadata || {}, patch.metadata || {}),
      }
      records.set(id, next)
      await storage.saveOne(next)
      return next
    },
  }

  function items(options = {}) {
    const list = [...records.values()]
      .filter(record => options.deleted || !record.deleted)
      .sort((a, b) => a.rel.localeCompare(b.rel))
    return options.type ? list.filter(record => record.type === options.type) : list
  }
}

export function jsonStorage(file) {
  let cache = null
  let writing = Promise.resolve()

  return {
    async loadAll() {
      cache = new Map()
      for (const record of await readJson(file)) {
        if (record?.id) cache.set(record.id, record)
      }
      return [...cache.values()]
    },
    async saveOne(record) {
      if (!cache) await this.loadAll()
      cache.set(record.id, record)
      const next = writing.then(
        () => writeCache(file, cache),
        () => writeCache(file, cache),
      )
      writing = next.catch(() => {})
      await next
    },
  }
}

async function writeCache(file, cache) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(tmp, JSON.stringify([...cache.values()], null, 2))
  await rename(tmp, file)
}

export function memoryStorage(records = []) {
  const cache = new Map(records.map(record => [record.id, record]))

  return {
    async loadAll() {
      return [...cache.values()]
    },
    async saveOne(record) {
      cache.set(record.id, record)
    },
  }
}

export function mediaId(root, rel) {
  return createHash('sha1').update(path.resolve(root)).update('\0').update(slash(rel)).digest('hex')
}

export async function weakFingerprint(file, info, options = {}) {
  info ||= await stat(file)
  const size = info.size
  const bytes = Math.min(size, options.bytes ?? DEFAULT_FINGERPRINT_BYTES)
  const ranges = fingerprintRanges(size, bytes)
  const hash = createHash('sha1').update(String(size)).update('\0')
  if (!ranges.length) return hash.digest('hex')

  const handle = await open(file, 'r')
  try {
    for (const range of ranges) {
      const buffer = Buffer.alloc(range.length)
      const { bytesRead } = await handle.read(buffer, 0, range.length, range.start)
      hash.update(String(range.start)).update('\0').update(buffer.subarray(0, bytesRead)).update('\0')
    }
  } finally {
    await handle.close()
  }
  return hash.digest('hex')
}

function requireStorage(storage) {
  if (!storage || typeof storage.loadAll !== 'function' || typeof storage.saveOne !== 'function') {
    throw new Error('openLibrary requires storage with loadAll() and saveOne(record)')
  }
  return storage
}

function requireRoots(roots) {
  if (!Array.isArray(roots) || roots.length === 0) {
    throw new Error('openLibrary requires at least one root')
  }
  return roots.map(root => path.resolve(root))
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
}

async function loadMediaFile() {
  return mediaFile ||= await import('co-media-file').catch(() => import('../co-media-file/index.js'))
}

async function currentFiles(roots, options) {
  const files = []
  const { scanMediaFiles } = await loadMediaFile()

  for (const root of roots) {
    for await (const file of scanMediaFiles(root, options)) {
      const info = await stat(file.path)
      const rel = slash(path.relative(root, file.path))
      const pathId = mediaId(root, rel)
      files.push({
        pathId,
        root,
        path: file.path,
        rel,
        name: path.basename(file.path),
        type: file.type,
        parsed: file.parsed,
        size: info.size,
        mtimeMs: info.mtimeMs,
        updatedAt: info.mtime.toISOString(),
        fingerprint: await fingerprint(file.path, info, options),
      })
    }
  }

  return files
}

async function fingerprint(file, info, options) {
  if (options.fingerprint === false) return null
  if (typeof options.fingerprint === 'function') return options.fingerprint(file, info)
  return weakFingerprint(file, info, { bytes: options.fingerprintBytes })
}

function findMoves({ current, pathRecords, records, roots }) {
  const currentPathIds = new Set(current.map(file => file.pathId))
  const candidates = new Map()
  const additions = new Map()

  for (const record of records.values()) {
    if (!roots.includes(record.root) || !record.fingerprint) continue
    if (!record.deleted && !currentPathIds.has(recordPathId(record))) add(candidates, record.fingerprint, record)
  }

  for (const file of current) {
    if (!file.fingerprint || pathRecords.has(file.pathId)) continue
    add(additions, file.fingerprint, file)
  }

  const moves = new Map()
  for (const [fingerprint, files] of additions) {
    const matches = candidates.get(fingerprint)
    if (files.length === 1 && matches?.length === 1) moves.set(files[0].pathId, matches[0])
  }
  return moves
}

function recordsByPathId(records) {
  const map = new Map()
  for (const record of records.values()) map.set(recordPathId(record), record)
  return map
}

function fingerprintRanges(size, bytes) {
  if (size <= bytes) return bytes ? [{ start: 0, length: bytes }] : []

  const third = Math.floor(bytes / 3)
  return [
    { start: 0, length: bytes - third * 2 },
    { start: Math.floor((size - third) / 2), length: third },
    { start: size - third, length: third },
  ].filter(range => range.length > 0)
}

function recordPathId(record) {
  return record.pathId || mediaId(record.root, record.rel)
}

function add(map, key, value) {
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(value)
}

function slash(value) {
  return String(value || '').split(path.sep).join('/')
}

function merge(a, b) {
  const out = { ...a }
  for (const [key, value] of Object.entries(b)) {
    out[key] = isPlainObject(value) && isPlainObject(out[key])
      ? merge(out[key], value)
      : value
  }
  return out
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}
