import { mkdir, readdir, rename, stat } from 'node:fs/promises'
import path from 'node:path'
import mimes from 'cofound/mimes'
import { handleUpload } from 'co-media-upload'
import { serveRange } from 'co-media-file'
import { memoryStorage, openLibrary } from 'co-media-library'

const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || 'media')
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || '.uploads')
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024 * 1024

await mkdir(MEDIA_DIR, { recursive: true })
await mkdir(UPLOAD_DIR, { recursive: true })

const library = await openLibrary({
  roots: [MEDIA_DIR],
  storage: memoryStorage(),
})
await library.scan()

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
  }
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
