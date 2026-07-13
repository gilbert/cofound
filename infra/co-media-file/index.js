import { createReadStream } from 'node:fs'
import { opendir, stat } from 'node:fs/promises'
import path from 'node:path'

export const VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.mkv', '.mov', '.webm', '.avi', '.ts']
export const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.ogg', '.opus', '.wav']
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.heif']
// Documents are opt-in: a consumer must pass `documentExtensions` (e.g. this
// list) to have them recognized, so pure media libraries keep ignoring them.
export const DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.md', '.rtf',
  '.odt', '.ods', '.odp',
]
export const IGNORE_NAMES = new Set([
  '$RECYCLE.BIN',
  'System Volume Information',
  '.DS_Store',
  '.actors',
  'metadata',
])

const MIME_TYPES = new Map([
  ['.mp4', 'video/mp4'],
  ['.m4v', 'video/x-m4v'],
  ['.mkv', 'video/x-matroska'],
  ['.mov', 'video/quicktime'],
  ['.webm', 'video/webm'],
  ['.avi', 'video/x-msvideo'],
  ['.ts', 'video/mp2t'],
  ['.mp3', 'audio/mpeg'],
  ['.flac', 'audio/flac'],
  ['.m4a', 'audio/mp4'],
  ['.ogg', 'audio/ogg'],
  ['.opus', 'audio/opus'],
  ['.wav', 'audio/wav'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.heic', 'image/heic'],
  ['.heif', 'image/heif'],
  ['.pdf', 'application/pdf'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.xls', 'application/vnd.ms-excel'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['.ppt', 'application/vnd.ms-powerpoint'],
  ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.txt', 'text/plain'],
  ['.csv', 'text/csv'],
  ['.md', 'text/markdown'],
  ['.rtf', 'application/rtf'],
  ['.odt', 'application/vnd.oasis.opendocument.text'],
  ['.ods', 'application/vnd.oasis.opendocument.spreadsheet'],
  ['.odp', 'application/vnd.oasis.opendocument.presentation'],
])

const DROP_TOKENS = [
  '2160p', '1080p', '720p', '480p',
  'uhd', 'hdr', 'dv', 'webrip', 'web-dl', 'webdl',
  'bluray', 'brrip', 'x264', 'x265', 'h264', 'h265', 'hevc',
  'aac', 'dts', 'proper', 'repack',
]

export function isMediaFile(file, options = {}) {
  return mediaType(file, options) != null
}

export function mediaType(file, options = {}) {
  const ext = path.extname(file).toLowerCase()
  const video = options.videoExtensions || VIDEO_EXTENSIONS
  const audio = options.audioExtensions || AUDIO_EXTENSIONS
  const image = options.imageExtensions || IMAGE_EXTENSIONS
  // Opt-in: default is [] so media-only consumers are unaffected.
  const document = options.documentExtensions || []
  if (video.includes(ext)) return 'video'
  if (audio.includes(ext)) return 'audio'
  if (image.includes(ext)) return 'image'
  if (document.includes(ext)) return 'document'
  return null
}

export function parseMediaName(file, options = {}) {
  const type = mediaType(file, options)
  const base = path.basename(file, path.extname(file))
  const normalized = normalizeSeparators(base)

  // Documents are named freely (not movie/episode releases), so keep the whole
  // filename as the title instead of running the year/quality-token heuristics.
  if (type === 'document') return { kind: 'document', title: normalized }

  const episode = parseEpisode(normalized)
  if (episode) return episode

  const movie = parseMovie(normalized)
  if (movie) return movie

  return {
    kind: type || 'unknown',
    title: cleanTitle(normalized),
  }
}

export async function* scanMediaFiles(root, options = {}) {
  const ignore = new Set(options.ignoreNames || IGNORE_NAMES)
  yield* scanDirectory(path.resolve(root), options, ignore)
}

export async function serveRange(r, file, options = {}) {
  const info = await stat(file)
  const size = info.size
  const type = options.type || MIME_TYPES.get(path.extname(file).toLowerCase()) || 'application/octet-stream'
  const range = parseRange(r.headers.range, size)

  if (range === false) {
    r.end('', 416, {
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes */${size}`,
      'Content-Length': 0,
    })
    return
  }

  if (!range) {
    r.header(200, {
      'Accept-Ranges': 'bytes',
      'Content-Type': type,
      'Content-Length': size,
    })
    if (r.method === 'head') {
      r.end()
      return
    }
    await pipeFile(file, r)
    return
  }

  const { start, end } = range
  r.header(206, {
    'Accept-Ranges': 'bytes',
    'Content-Type': type,
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': end - start + 1,
  })
  if (r.method === 'head') {
    r.end()
    return
  }
  await pipeFile(file, r, { start, end })
}

async function* scanDirectory(dir, options, ignore) {
  let entries
  try {
    entries = await opendir(dir)
  } catch (err) {
    if (options.ignoreErrors) return
    throw err
  }

  for await (const entry of entries) {
    if (ignore.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* scanDirectory(fullPath, options, ignore)
      continue
    }
    if (!entry.isFile() || !isMediaFile(fullPath, options)) continue
    yield {
      path: fullPath,
      type: mediaType(fullPath, options),
      parsed: parseMediaName(fullPath, options),
    }
  }
}

function parseEpisode(name) {
  const match = name.match(/^(.*?)\s+s(\d{1,2})e(\d{1,3})(?:\s*-?\s*(.*))?$/i)
    || name.match(/^(.*?)\s+(\d{1,2})x(\d{1,3})(?:\s*-?\s*(.*))?$/i)
  if (!match) return null

  return {
    kind: 'episode',
    show: cleanTitle(match[1]),
    season: Number(match[2]),
    episode: Number(match[3]),
    title: cleanTitle(match[4] || ''),
  }
}

function parseMovie(name) {
  const match = name.match(/^(.*?)\s*[\[(]?(19\d{2}|20\d{2})[\])]?(?:\s+(.*))?$/)
  if (!match) return null
  const title = cleanTitle(match[1])
  if (!title || /screen recording/i.test(title)) return null

  return {
    kind: 'movie',
    title,
    year: Number(match[2]),
  }
}

function parseRange(header, size) {
  if (!header) return null
  const match = String(header).match(/^bytes=(\d*)-(\d*)$/)
  if (!match) return false

  let start
  let end

  if (match[1] === '' && match[2] === '') return false
  if (match[1] === '') {
    const suffix = Number(match[2])
    if (!Number.isInteger(suffix) || suffix <= 0) return false
    start = Math.max(size - suffix, 0)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Number(match[2])
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) return false
    if (start >= size) return false
    end = Math.min(end, size - 1)
  }

  return { start, end }
}

function pipeFile(file, r, options) {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(file, options)
    stream.on('error', reject)
    r.writable.on('error', reject)
    r.writable.on('finish', resolve)
    stream.pipe(r.writable)
  })
}

function normalizeSeparators(value) {
  return String(value)
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanTitle(value) {
  let title = normalizeSeparators(value || '')
  for (const token of DROP_TOKENS) {
    title = title.replace(new RegExp(`\\b${escapeRegex(token)}\\b`, 'ig'), ' ')
  }
  return title
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*(?:rip|x264|x265|h264|h265|hevc|aac|dts)[^)]*\)/ig, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s*$/g, '')
    .trim()
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
