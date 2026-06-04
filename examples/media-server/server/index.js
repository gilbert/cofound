import { mkdir, readdir, rename, stat } from 'node:fs/promises'
import path from 'node:path'
import mimes from 'cofound/mimes'
import { handleUpload } from 'co-media-upload'
import { serveRange } from 'co-media-file'

const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || 'media')
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || '.uploads')
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024 * 1024

await mkdir(MEDIA_DIR, { recursive: true })
await mkdir(UPLOAD_DIR, { recursive: true })

export default function mediaServer(app) {
  app.get('/files.json', async r => {
    r.json(await listFiles())
  })

  app.get('/files/:name', async r => {
    await serveUploadedFile(r, r.params.name)
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
  const name = await uniqueFilename(sanitizeFilename(original))
  await rename(tempPath, path.join(MEDIA_DIR, name))
}

async function serveUploadedFile(r, name) {
  const safe = safeUploadedPath(name)
  if (!safe) return r.statusEnd(404)

  try {
    await serveRange(r, safe, { type: contentType(safe) })
  } catch (err) {
    if (err.code === 'ENOENT') return r.statusEnd(404)
    throw err
  }
}

async function listFiles() {
  const entries = await readdir(MEDIA_DIR, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (!entry.isFile()) continue
    const file = path.join(MEDIA_DIR, entry.name)
    const info = await stat(file)
    files.push({
      name: entry.name,
      size: info.size,
      updatedAt: info.mtime.toISOString(),
      href: '/files/' + encodeURIComponent(entry.name),
      type: contentType(entry.name),
    })
  }
  files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name))
  return files
}

async function uniqueFilename(name) {
  const ext = path.extname(name)
  const base = path.basename(name, ext)
  let candidate = name
  let i = 2
  while (true) {
    try {
      await stat(path.join(MEDIA_DIR, candidate))
      candidate = `${base}-${i++}${ext}`
    } catch (err) {
      if (err.code === 'ENOENT') return candidate
      throw err
    }
  }
}

function safeUploadedPath(name) {
  if (!name || name.includes('/') || name.includes('\\')) return null
  const file = path.resolve(MEDIA_DIR, name)
  if (!file.startsWith(MEDIA_DIR + path.sep)) return null
  return file
}

function sanitizeFilename(name) {
  const clean = path.basename(String(name))
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return clean || 'upload'
}

function contentType(file) {
  const ext = path.extname(file).slice(1).toLowerCase()
  return mimes.get(ext) || 'application/octet-stream'
}
