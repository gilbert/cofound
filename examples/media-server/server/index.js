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
    if (r.method === 'head') return headUploadedFile(r, r.params.name)
    await serveUploadedFile(r, r.params.name)
  })

  app.options('/upload', r => uploadRoute(r))
  app.post('/upload', r => uploadRoute(r))
  app.head('/upload/:id', r => uploadRoute(r))
  app.patch('/upload/:id', r => uploadRoute(r))
  app.delete('/upload/:id', r => uploadRoute(r))
}

async function uploadRoute(r) {
  await handleUpload(uploadReq(r), uploadRes(r), {
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
    await serveRange(rangeReq(r), rangeRes(r), safe, { type: contentType(safe) })
  } catch (err) {
    if (err.code === 'ENOENT') return r.statusEnd(404)
    throw err
  }
}

async function headUploadedFile(r, name) {
  const safe = safeUploadedPath(name)
  if (!safe) return r.statusEnd(404)

  try {
    const info = await stat(safe)
    r.end('', 200, {
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType(safe),
      'Content-Length': info.size,
    })
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

function uploadReq(r) {
  const req = r.readable
  req.method = r.method.toUpperCase()
  req.url = r.url + (r.rawQuery ? '?' + r.rawQuery : '')
  req.headers = r.headers
  return req
}

function uploadRes(r) {
  const headers = {}
  let wrote = false

  return {
    setHeader(name, value) {
      headers[name] = value
    },
    writeHead(status, extra = {}) {
      r.handled = true
      wrote = true
      r.status(status)
      r.header({ ...headers, ...extra })
      return this
    },
    end(body = '') {
      r.handled = true
      if (!wrote) r.header(headers)
      r.end(body)
    },
  }
}

function rangeReq(r) {
  return {
    method: r.method.toUpperCase(),
    headers: r.headers,
  }
}

function rangeRes(r) {
  const res = r.writable
  res.writeHead = (status, headers = {}) => {
    r.handled = true
    r.status(status)
    r.header(headers)
    return res
  }
  return res
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
