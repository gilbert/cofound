import { mkdir, readdir, rename, stat } from 'node:fs/promises'
import path from 'node:path'
import { makeDb, migrate } from 'cofound/db'
import { BaseJob, JobQueue, jobQueueSchema } from 'cofound/jobs'
import mimes from 'cofound/mimes'
import { handleUpload } from 'co-media-upload'
import { serveRange } from 'co-media-file'
import { jsonStorage, openLibrary } from 'co-media-library'
import {
  ensureThumbnails,
  generateThumbnail,
  markThumbnailFailed,
  publicThumbnail,
  thumbnailNameToId,
  thumbnailPath,
} from './thumbnails.js'

const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || 'media')
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || '.uploads')
const THUMB_DIR = path.resolve(process.env.THUMB_DIR || '.thumbs')
const LIBRARY_FILE = path.resolve(process.env.LIBRARY_FILE || '.media-library.json')
const DB_FILE = process.env.DB_FILE || 'app.db'
const THUMB_WIDTH = Number(process.env.THUMB_WIDTH || 320)
const THUMB_CONCURRENCY = Number(process.env.THUMB_CONCURRENCY || 2)
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg'
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024 * 1024

await mkdir(MEDIA_DIR, { recursive: true })
await mkdir(UPLOAD_DIR, { recursive: true })
await mkdir(THUMB_DIR, { recursive: true })

const library = await openLibrary({
  roots: [MEDIA_DIR],
  storage: jsonStorage(LIBRARY_FILE),
})
const db = makeDb(DB_FILE)
migrate(db, jobQueueSchema)

class GenerateThumbnailJob extends BaseJob {
  retryLimit = 2

  getConcurrency() {
    return { queue: 'thumbnails', limit: THUMB_CONCURRENCY }
  }

  async run(params) {
    return generateThumbnail({
      library,
      thumbDir: THUMB_DIR,
      thumbWidth: THUMB_WIDTH,
      ffmpeg: FFMPEG,
      ...params,
    })
  }

  async onFinalFailure(params, meta) {
    await markThumbnailFailed({
      library,
      ...params,
      error: meta.errorResult?.error,
    })
  }
}

const jobs = new JobQueue({ db }).register(GenerateThumbnailJob).start()
await library.scan()
await queueMissingThumbnails()
installShutdownHandlers()

export default function mediaServer(app) {
  app.get('/files.json', async r => {
    r.json(await listDirectory(r.query.get('dir') || ''))
  })

  app.get('/media/:id', r => {
    const item = library.get(r.params.id)
    if (!item) return r.statusEnd(404)
    r.json(publicRecord(item))
  })

  app.post('/directories', async r => {
    const body = await r.body('json')
    const dir = safeMediaPath(body.dir || '')
    if (!dir) return r.statusEnd(400)

    const name = sanitizeDirectoryName(body.name || '')
    if (!name) return r.statusEnd(400)

    try {
      await mkdir(path.join(dir.full, name), { recursive: false })
      r.json({ ok: true }, 201)
    } catch (err) {
      if (err.code === 'EEXIST') return r.statusEnd(409)
      throw err
    }
  })

  app.get('/files', async r => {
    await serveUploadedFile(r, r.query.get('path') || '')
  })

  app.get('/files/:name', async r => {
    await serveUploadedFile(r, r.params.name)
  })

  app.get('/stream/:id', async r => {
    await serveLibraryFile(r, r.params.id)
  })

  app.get('/thumbs/:name', async r => {
    await serveThumbnailFile(r, r.params.name)
  })

  app.options('/upload', r => uploadRoute(r))
  app.post('/upload', r => uploadRoute(r))
  app.head('/upload/:id', r => uploadRoute(r))
  app.patch('/upload/:id', r => uploadRoute(r))
  app.delete('/upload/:id', r => uploadRoute(r))
}

async function uploadRoute(r) {
  await handleUpload(r, {
    prefix: '/upload',
    dir: UPLOAD_DIR,
    maxSize: MAX_UPLOAD_SIZE,
    onComplete: moveCompletedUpload,
  })
}

async function moveCompletedUpload({ path: tempPath, metadata }) {
  const original = metadata.filename || 'upload'
  const dir = safeMediaPath(metadata.dir || '')
  if (!dir) throw new Error('Invalid upload directory')

  const name = await uniqueFilename(dir.full, sanitizeFilename(original))
  await rename(tempPath, path.join(dir.full, name))
  await library.scan()
  await queueMissingThumbnails()
}

async function serveUploadedFile(r, file) {
  const safe = safeMediaPath(file)
  if (!safe) return r.statusEnd(404)

  try {
    const info = await stat(safe.full)
    if (!info.isFile()) return r.statusEnd(404)
    await serveRange(r, safe.full, { type: contentType(safe.full) })
  } catch (err) {
    if (err.code === 'ENOENT') return r.statusEnd(404)
    throw err
  }
}

async function serveLibraryFile(r, id) {
  const item = library.get(id)
  if (!item) return r.statusEnd(404)

  try {
    await serveRange(r, item.path, { type: contentType(item.name) })
  } catch (err) {
    if (err.code === 'ENOENT') return r.statusEnd(404)
    throw err
  }
}

async function serveThumbnailFile(r, name) {
  const id = thumbnailNameToId(name)
  if (!id || !library.get(id)) return r.statusEnd(404)

  try {
    await serveRange(r, thumbnailPath(THUMB_DIR, id), { type: 'image/jpeg' })
  } catch (err) {
    if (err.code === 'ENOENT') return r.statusEnd(404)
    throw err
  }
}

async function listDirectory(dir = '') {
  const safe = safeMediaPath(dir)
  if (!safe) return { dir: '', entries: [] }

  const indexed = new Map(library.items().map(item => [item.rel, item]))
  const entries = await readdir(safe.full, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (!entry.isFile() && !entry.isDirectory()) continue
    const file = path.join(safe.full, entry.name)
    const info = await stat(file)
    const relative = path.posix.join(safe.relative, entry.name)
    const media = entry.isFile() ? indexed.get(relative) : null
    files.push({
      kind: entry.isDirectory() ? 'directory' : 'file',
      id: media?.id || null,
      name: entry.name,
      size: info.size,
      updatedAt: info.mtime.toISOString(),
      path: relative,
      href: entry.isFile() ? fileHref(relative, media) : null,
      playerHref: media ? '/player/' + encodeURIComponent(media.id) : null,
      type: entry.isFile() ? contentType(entry.name) : null,
      mediaType: media?.type || null,
      thumbnail: publicThumbnail(media),
    })
  }
  files.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return {
    dir: safe.relative,
    entries: files,
  }
}

function publicRecord(item) {
  return {
    id: item.id,
    name: item.name,
    rel: item.rel,
    size: item.size,
    updatedAt: item.updatedAt,
    href: '/stream/' + encodeURIComponent(item.id),
    type: contentType(item.name),
    mediaType: item.type,
    thumbnail: publicThumbnail(item),
  }
}

function queueMissingThumbnails() {
  return ensureThumbnails({ library, queue: jobs, job: GenerateThumbnailJob })
}

function fileHref(relative, media) {
  return media ? '/stream/' + encodeURIComponent(media.id) : '/files?path=' + encodeURIComponent(relative)
}

async function uniqueFilename(dir, name) {
  const ext = path.extname(name)
  const base = path.basename(name, ext)
  let candidate = name
  let i = 2
  while (true) {
    try {
      await stat(path.join(dir, candidate))
      candidate = `${base}-${i++}${ext}`
    } catch (err) {
      if (err.code === 'ENOENT') return candidate
      throw err
    }
  }
}

function safeMediaPath(value) {
  const clean = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const parts = clean.split('/').filter(Boolean)
  if (parts.some(part => part === '.' || part === '..')) return null

  const relative = parts.join('/')
  const full = path.resolve(MEDIA_DIR, relative)
  if (full !== MEDIA_DIR && !full.startsWith(MEDIA_DIR + path.sep)) return null
  return { full, relative }
}

function sanitizeFilename(name) {
  const clean = path.basename(String(name))
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return clean || 'upload'
}

function sanitizeDirectoryName(name) {
  const clean = sanitizeFilename(name)
  return clean === '.' || clean === '..' ? '' : clean
}

function contentType(file) {
  const ext = path.extname(file).slice(1).toLowerCase()
  return mimes.get(ext) || 'application/octet-stream'
}

function installShutdownHandlers() {
  const shutdown = () => jobs.shutdown()
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}
