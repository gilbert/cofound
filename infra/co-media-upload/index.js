import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { pipeline } from 'node:stream/promises'

export const TUS_VERSION = '1.0.0'
export const TUS_EXTENSIONS = 'creation,termination,expiration'
export const DEFAULT_UPLOAD_PREFIX = '/upload'
export const DEFAULT_UPLOAD_DIR = '.uploads'
export const DEFAULT_UPLOAD_TTL = 24 * 60 * 60 * 1000
export const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024

export class UploadError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'UploadError'
    this.status = status
  }
}

export function uploadServer(app, options = {}) {
  const prefix = normalizePrefix(options.prefix || DEFAULT_UPLOAD_PREFIX)

  app.options(prefix, r => handleUpload(r, options))
  app.post(prefix, r => handleUpload(r, options))
  app.head(prefix + '/:id', r => handleUpload(r, options))
  app.patch(prefix + '/:id', r => handleUpload(r, options))
  app.delete(prefix + '/:id', r => handleUpload(r, options))
}

export async function handleUpload(r, options = {}) {
  const config = normalizeOptions(options)
  try {
    await routeRequest(r, config)
  } catch (err) {
    sendError(r, err)
  }
}

export function uploadFile(file, options = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('uploadFile requires fetch')
  }

  const endpoint = options.endpoint || DEFAULT_UPLOAD_PREFIX
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE
  const storage = options.storage || globalThis.localStorage
  const metadata = { filename: file.name, ...options.metadata }
  const key = options.storageKey || uploadStorageKey(file)

  let uploadUrl = options.url || storage?.getItem(key) || null
  let offset = 0
  let paused = false
  let cancelled = false
  let running = false
  let controller = null

  async function start() {
    if (running) return
    running = true
    paused = false
    cancelled = false

    try {
      if (uploadUrl) {
        const found = await loadOffset(uploadUrl)
        if (found == null) uploadUrl = null
        else offset = found
      }
      if (!uploadUrl) {
        uploadUrl = await createUpload(endpoint, file.size, metadata)
        storage?.setItem(key, uploadUrl)
        offset = 0
      }

      while (!paused && !cancelled && offset < file.size) {
        const next = Math.min(offset + chunkSize, file.size)
        controller = new AbortController()
        const response = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            'Tus-Resumable': TUS_VERSION,
            'Upload-Offset': String(offset),
            'Content-Type': 'application/offset+octet-stream',
          },
          body: file.slice(offset, next),
          signal: controller.signal,
        })

        if (response.status === 409) {
          const refreshed = await loadOffset(uploadUrl)
          if (refreshed == null) throw new Error('Upload no longer exists')
          offset = refreshed
          continue
        }
        if (!response.ok) throw new Error(`Upload failed with ${response.status}`)

        offset = numberHeader(response, 'Upload-Offset')
        options.onProgress?.({ uploaded: offset, total: file.size })
      }

      if (!cancelled && offset >= file.size) {
        storage?.removeItem(key)
        options.onComplete?.({ url: uploadUrl, uploaded: offset, total: file.size })
      }
    } catch (err) {
      if (!paused && !cancelled) options.onError?.(err)
    } finally {
      running = false
      controller = null
    }
  }

  async function loadOffset(url) {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'Tus-Resumable': TUS_VERSION },
    })
    if (response.status === 404 || response.status === 410) return null
    if (!response.ok) throw new Error(`Resume check failed with ${response.status}`)
    return numberHeader(response, 'Upload-Offset')
  }

  async function createUpload(url, size, uploadMetadata) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Tus-Resumable': TUS_VERSION,
        'Upload-Length': String(size),
        'Upload-Metadata': encodeMetadata(uploadMetadata),
      },
    })
    if (!response.ok) throw new Error(`Upload creation failed with ${response.status}`)
    const location = response.headers.get('Location')
    if (!location) throw new Error('Upload creation response is missing Location')
    return resolveLocation(location, url)
  }

  return {
    start,
    resume: start,
    pause() {
      paused = true
      controller?.abort()
    },
    async cancel() {
      cancelled = true
      paused = false
      controller?.abort()
      if (uploadUrl) {
        await fetch(uploadUrl, {
          method: 'DELETE',
          headers: { 'Tus-Resumable': TUS_VERSION },
        })
      }
      storage?.removeItem(key)
    },
  }
}

export function encodeMetadata(metadata = {}) {
  return Object.entries(metadata)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key} ${base64Encode(String(value))}`)
    .join(',')
}

export function decodeMetadata(value = '') {
  const metadata = {}
  for (const part of String(value).split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const space = trimmed.indexOf(' ')
    const key = space === -1 ? trimmed : trimmed.slice(0, space)
    const encoded = space === -1 ? '' : trimmed.slice(space + 1)
    if (!/^[A-Za-z0-9_.-]+$/.test(key)) {
      throw new UploadError('Invalid Upload-Metadata key', 400)
    }
    metadata[key] = base64Decode(encoded)
  }
  return metadata
}

async function routeRequest(r, config) {
  r.header('Tus-Resumable', TUS_VERSION)

  const { base, id } = matchPath(requestUrl(r), config.prefix)
  if (!base) throw new UploadError('Not found', 404)
  if (r.method !== 'options') assertTusVersion(r)

  if (r.method === 'options' && !id) return optionsResponse(r, config)
  if (r.method === 'post' && !id) return createUploadResource(r, config)
  if (r.method === 'head' && id) return headUpload(r, config, id)
  if (r.method === 'patch' && id) return patchUpload(r, config, id)
  if (r.method === 'delete' && id) return deleteUpload(r, config, id)

  throw new UploadError('Method not allowed', 405)
}

async function createUploadResource(r, config) {
  const length = parseLength(r.headers['upload-length'])
  if (length == null) throw new UploadError('Upload-Length is required', 400)
  if (config.maxSize != null && length > config.maxSize) {
    throw new UploadError('Upload exceeds Tus-Max-Size', 413)
  }

  await mkdir(config.dir, { recursive: true })

  const now = new Date()
  const id = config.id?.() || randomId()
  const record = {
    id,
    length,
    offset: 0,
    metadata: decodeMetadata(r.headers['upload-metadata']),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: config.ttl ? new Date(now.getTime() + config.ttl).toUTCString() : null,
    complete: false,
    notified: false,
  }

  await writeFile(paths(config, id).bin, '')
  await writeRecord(config, record)

  const location = joinUrl(config.publicPrefix || config.prefix, id)
  const headers = {
    Location: location,
    'Upload-Offset': '0',
  }
  if (record.expiresAt) headers['Upload-Expires'] = record.expiresAt
  r.end('', 201, headers)
}

async function headUpload(r, config, id) {
  const record = await loadLiveRecord(config, id)
  const headers = {
    'Upload-Offset': String(record.offset),
    'Upload-Length': String(record.length),
    'Cache-Control': 'no-store',
  }
  if (record.expiresAt && !record.complete) headers['Upload-Expires'] = record.expiresAt
  if (Object.keys(record.metadata || {}).length) headers['Upload-Metadata'] = encodeMetadata(record.metadata)
  r.end('', 200, headers)
}

async function patchUpload(r, config, id) {
  if (r.headers['content-type'] !== 'application/offset+octet-stream') {
    throw new UploadError('PATCH requires Content-Type: application/offset+octet-stream', 415)
  }

  const record = await loadLiveRecord(config, id)
  if (record.complete) throw new UploadError('Upload is already complete', 409)

  const offset = parseLength(r.headers['upload-offset'])
  if (offset == null) throw new UploadError('Upload-Offset is required', 400)
  if (offset !== record.offset) throw new UploadError('Upload-Offset does not match', 409)

  const contentLength = r.headers['content-length'] == null ? null : parseLength(r.headers['content-length'])
  if (contentLength != null && offset + contentLength > record.length) {
    throw new UploadError('PATCH exceeds Upload-Length', 413)
  }

  await appendRequest(paths(config, id).bin, r)

  const size = (await stat(paths(config, id).bin)).size
  if (size > record.length) throw new UploadError('Upload exceeds Upload-Length', 413)

  record.offset = size
  record.updatedAt = new Date().toISOString()
  if (config.ttl && !record.complete) {
    record.expiresAt = new Date(Date.now() + config.ttl).toUTCString()
  }
  if (record.offset === record.length) record.complete = true
  await writeRecord(config, record)

  if (record.complete && !record.notified) {
    record.notified = true
    await writeRecord(config, record)
    await config.onComplete?.({
      id: record.id,
      path: paths(config, id).bin,
      metadata: record.metadata,
      length: record.length,
    })
  }

  const headers = { 'Upload-Offset': String(record.offset) }
  if (record.expiresAt && !record.complete) headers['Upload-Expires'] = record.expiresAt
  r.end('', 204, headers)
}

async function deleteUpload(r, config, id) {
  const p = paths(config, id)
  await rm(p.bin, { force: true })
  await rm(p.json, { force: true })
  r.end('', 204)
}

function optionsResponse(r, config) {
  const headers = {
    'Tus-Version': TUS_VERSION,
    'Tus-Extension': TUS_EXTENSIONS,
  }
  if (config.maxSize != null) headers['Tus-Max-Size'] = String(config.maxSize)
  r.end('', 204, headers)
}

async function loadLiveRecord(config, id) {
  const record = await readRecord(config, id)
  if (!record) throw new UploadError('Upload not found', 404)
  if (!record.complete && record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
    await deleteRecord(config, id)
    throw new UploadError('Upload expired', 410)
  }
  return record
}

async function readRecord(config, id) {
  try {
    return JSON.parse(await readFile(paths(config, id).json, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

async function writeRecord(config, record) {
  await mkdir(config.dir, { recursive: true })
  const p = paths(config, record.id)
  await writeFile(p.tmp, JSON.stringify(record, null, 2))
  await rename(p.tmp, p.json)
}

async function deleteRecord(config, id) {
  const p = paths(config, id)
  await rm(p.bin, { force: true })
  await rm(p.json, { force: true })
}

async function appendRequest(file, r) {
  await pipeline(r.readable, createWriteStream(file, { flags: 'a' }))
}

function normalizeOptions(options) {
  return {
    prefix: normalizePrefix(options.prefix || DEFAULT_UPLOAD_PREFIX),
    publicPrefix: options.publicPrefix,
    dir: options.dir || DEFAULT_UPLOAD_DIR,
    maxSize: options.maxSize,
    ttl: options.ttl == null ? DEFAULT_UPLOAD_TTL : options.ttl,
    id: options.id,
    onComplete: options.onComplete,
  }
}

function matchPath(url, prefix) {
  const pathname = new URL(url, 'http://local').pathname
  if (pathname === prefix) return { base: true, id: null }
  if (!pathname.startsWith(prefix + '/')) return { base: false, id: null }
  const rest = pathname.slice(prefix.length + 1)
  if (!/^[A-Za-z0-9_-]+$/.test(rest)) return { base: false, id: null }
  return { base: true, id: rest }
}

function paths(config, id) {
  return {
    bin: path.join(config.dir, `${id}.bin`),
    json: path.join(config.dir, `${id}.json`),
    tmp: path.join(config.dir, `${id}.json.tmp`),
  }
}

function assertTusVersion(r) {
  if (r.headers['tus-resumable'] !== TUS_VERSION) {
    throw new UploadError('Tus-Resumable header is required', 412)
  }
}

function parseLength(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) return null
  return number
}

function sendError(r, err) {
  const status = err instanceof UploadError ? err.status : 500
  r.end(err.message || 'Upload error', status, { 'Content-Type': 'text/plain; charset=utf-8' })
}

function randomId() {
  return randomBytes(16).toString('hex')
}

function normalizePrefix(prefix) {
  return String(prefix || DEFAULT_UPLOAD_PREFIX).replace(/\/+$/, '') || DEFAULT_UPLOAD_PREFIX
}

function joinUrl(prefix, id) {
  return normalizePrefix(prefix) + '/' + id
}

function numberHeader(response, name) {
  const value = response.headers.get(name)
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Invalid ${name} response header`)
  }
  return number
}

function uploadStorageKey(file) {
  return `co-media-upload:${file.name}:${file.size}:${file.lastModified || 0}`
}

function resolveLocation(location, endpoint) {
  if (/^https?:\/\//i.test(location)) return location
  if (/^https?:\/\//i.test(endpoint)) return new URL(location, endpoint).href
  return location
}

function base64Encode(value) {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(value)))
  return Buffer.from(value, 'utf8').toString('base64')
}

function base64Decode(value) {
  if (!value) return ''
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(value)))
  return Buffer.from(value, 'base64').toString('utf8')
}

function requestUrl(r) {
  return r.rawQuery ? r.url + '?' + r.rawQuery : r.url
}
