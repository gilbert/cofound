import { spawn } from 'node:child_process'
import { mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'

const THUMBNAIL_TYPES = new Set(['video', 'image'])
const CURRENT_STATUSES = new Set(['queued', 'generating', 'ready', 'failed'])

export async function ensureThumbnails({ library, queue, job, now = isoNow }) {
  let queued = 0
  for (const item of library.items()) {
    if (!needsThumbnail(item)) continue
    await library.update(item.id, {
      metadata: {
        thumbnail: {
          status: 'queued',
          sourceFingerprint: item.fingerprint,
          updatedAt: now(),
        },
      },
    })
    queue.push(job, { id: item.id, fingerprint: item.fingerprint })
      .catch(err => console.error('Failed to enqueue thumbnail job', err))
    queued++
  }
  return queued
}

export function needsThumbnail(item) {
  if (!item || !THUMBNAIL_TYPES.has(item.type)) return false
  const thumbnail = item.metadata?.thumbnail
  return !(thumbnail?.sourceFingerprint === item.fingerprint && CURRENT_STATUSES.has(thumbnail.status))
}

export function publicThumbnail(item) {
  const thumbnail = item?.metadata?.thumbnail
  if (!thumbnail?.status) return null
  const out = { status: thumbnail.status }
  if (thumbnail.href) out.href = thumbnail.href
  if (thumbnail.generatedAt) out.generatedAt = thumbnail.generatedAt
  if (thumbnail.error) out.error = thumbnail.error
  return out
}

export async function generateThumbnail({
  library,
  id,
  fingerprint,
  thumbDir,
  thumbWidth,
  ffmpeg,
  runFfmpeg = run,
  now = isoNow,
}) {
  const item = library.get(id)
  if (!isCurrent(item, fingerprint)) return { ok: false, meta: { abort: true } }

  await mkdir(thumbDir, { recursive: true })
  await library.update(id, {
    metadata: {
      thumbnail: {
        status: 'generating',
        sourceFingerprint: fingerprint,
        updatedAt: now(),
      },
    },
  })

  const tmp = path.join(thumbDir, `${id}.tmp.jpg`)
  const file = thumbnailPath(thumbDir, id)
  await rm(tmp, { force: true })

  try {
    await runFfmpeg(ffmpeg, thumbnailArgs(item, tmp, thumbWidth))
    await rename(tmp, file)
  } catch (err) {
    await rm(tmp, { force: true })
    throw err
  }

  await library.update(id, {
    metadata: {
      thumbnail: {
        status: 'ready',
        href: thumbnailHref(id),
        sourceFingerprint: fingerprint,
        generatedAt: now(),
        updatedAt: now(),
        error: null,
      },
    },
  })
  return { ok: true }
}

export async function markThumbnailFailed({ library, id, fingerprint, error, now = isoNow }) {
  const item = library.get(id)
  if (!isCurrent(item, fingerprint)) return
  await library.update(id, {
    metadata: {
      thumbnail: {
        status: 'failed',
        sourceFingerprint: fingerprint,
        error: errorMessage(error),
        updatedAt: now(),
      },
    },
  })
}

export function thumbnailHref(id) {
  return '/thumbs/' + encodeURIComponent(id) + '.jpg'
}

export function thumbnailPath(dir, id) {
  return path.join(dir, `${id}.jpg`)
}

export function thumbnailNameToId(name) {
  const match = String(name || '').match(/^([a-f0-9]{40})\.jpg$/i)
  return match?.[1] || null
}

export function thumbnailArgs(item, output, width) {
  const scale = `scale=${width}:-2:force_original_aspect_ratio=decrease`
  const common = [
    '-i', item.path,
    '-frames:v', '1',
    '-vf', scale,
    '-q:v', '4',
    output,
  ]
  return item.type === 'video'
    ? ['-y', ...common]
    : ['-y', ...common]
}

function isCurrent(item, fingerprint) {
  return !!item && item.fingerprint === fingerprint && THUMBNAIL_TYPES.has(item.type)
}

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) return resolve()
      reject(new Error(`${bin} failed: ${stderr.trim() || `exit code ${code}`}`))
    })
  })
}

function errorMessage(error) {
  return String(error?.message || error || 'Thumbnail generation failed')
}

function isoNow() {
  return new Date().toISOString()
}
