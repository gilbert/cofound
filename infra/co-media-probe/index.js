import { spawn } from 'node:child_process'

export class MediaProbeError extends Error {
  constructor(message, cause) {
    super(message)
    this.name = 'MediaProbeError'
    if (cause) this.cause = cause
  }
}

export async function probe(path, options = {}) {
  const bin = options.ffprobe || process.env.FFPROBE_PATH || 'ffprobe'
  const args = [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    '-show_chapters',
    path,
  ]

  const json = await runJson(bin, args)
  return normalizeProbe(json, { path, raw: options.raw })
}

export function normalizeProbe(input, options = {}) {
  const streams = Array.isArray(input.streams) ? input.streams : []
  const format = input.format || {}
  const videoStream = streams.find(stream => stream.codec_type === 'video') || null

  const result = {
    path: options.path,
    container: stringOrNull(format.format_name),
    duration: numberOrNull(format.duration) ?? maxStreamNumber(streams, 'duration'),
    bitrate: integerOrNull(format.bit_rate),
    video: videoStream ? normalizeVideo(videoStream) : null,
    audio: streams
      .filter(stream => stream.codec_type === 'audio')
      .map(normalizeAudio),
    subtitles: streams
      .filter(stream => stream.codec_type === 'subtitle')
      .map(normalizeSubtitle),
    chapters: Array.isArray(input.chapters)
      ? input.chapters.map(normalizeChapter).filter(Boolean)
      : [],
  }

  if (options.raw) result.raw = input
  return result
}

function normalizeVideo(stream) {
  return {
    index: stream.index,
    codec: stringOrNull(stream.codec_name),
    profile: stringOrNull(stream.profile),
    width: integerOrNull(stream.width),
    height: integerOrNull(stream.height),
    fps: parseRate(stream.avg_frame_rate) ?? parseRate(stream.r_frame_rate),
    hdr: isHdr(stream),
  }
}

function normalizeAudio(stream) {
  return {
    index: stream.index,
    codec: stringOrNull(stream.codec_name),
    channels: integerOrNull(stream.channels),
    language: stream.tags?.language || null,
  }
}

function normalizeSubtitle(stream) {
  return {
    index: stream.index,
    codec: stringOrNull(stream.codec_name),
    language: stream.tags?.language || null,
    forced: Boolean(stream.disposition?.forced),
  }
}

function normalizeChapter(chapter) {
  const start = numberOrNull(chapter.start_time)
  if (start == null) return null
  return {
    start,
    title: chapter.tags?.title || null,
  }
}

function runJson(bin, args) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      reject(new MediaProbeError(`Failed to start ${bin}`, err))
      return
    }

    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })

    child.on('error', err => {
      reject(new MediaProbeError(`Failed to start ${bin}`, err))
    })

    child.on('close', code => {
      if (code !== 0) {
        const detail = stderr.trim() || `exit code ${code}`
        reject(new MediaProbeError(`ffprobe failed: ${detail}`))
        return
      }

      try {
        resolve(JSON.parse(stdout))
      } catch (err) {
        reject(new MediaProbeError('ffprobe returned invalid JSON', err))
      }
    })
  })
}

function parseRate(value) {
  if (!value || value === '0/0') return null
  const parts = String(value).split('/')
  if (parts.length === 1) return numberOrNull(value)
  const numerator = Number(parts[0])
  const denominator = Number(parts[1])
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null
  }
  return numerator / denominator
}

function isHdr(stream) {
  const transfer = String(stream.color_transfer || '').toLowerCase()
  const primaries = String(stream.color_primaries || '').toLowerCase()
  if (transfer === 'smpte2084' || transfer === 'arib-std-b67') return true
  if (primaries === 'bt2020' && /10|12/.test(String(stream.pix_fmt || ''))) return true
  return false
}

function maxStreamNumber(streams, field) {
  let max = null
  for (const stream of streams) {
    const value = numberOrNull(stream[field])
    if (value != null && (max == null || value > max)) max = value
  }
  return max
}

function stringOrNull(value) {
  return value == null || value === '' ? null : String(value)
}

function numberOrNull(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function integerOrNull(value) {
  const number = numberOrNull(value)
  return number == null ? null : Math.trunc(number)
}
