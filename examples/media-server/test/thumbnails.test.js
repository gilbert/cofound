import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { makeDb, migrate } from 'cofound/db'
import { BaseJob, JobQueue, jobQueueSchema } from 'cofound/jobs'
import {
  ensureThumbnails,
  needsThumbnail,
  publicThumbnail,
} from '../+server/thumbnails.js'

test('ensureThumbnails queues missing thumbnails for video and image entries', async () => {
  const library = fakeLibrary([
    media({ id: 'video', type: 'video', fingerprint: 'v1' }),
    media({ id: 'image', type: 'image', fingerprint: 'i1' }),
    media({ id: 'audio', type: 'audio', fingerprint: 'a1' }),
  ])
  const pushed = []
  const queue = {
    async push(job, args) {
      pushed.push(args)
    },
  }

  const count = await ensureThumbnails({ library, queue, job: 'thumb.generate', now: () => 'now' })

  assert.equal(count, 2)
  assert.deepEqual(pushed, [
    { id: 'video', fingerprint: 'v1' },
    { id: 'image', fingerprint: 'i1' },
  ])
  assert.equal(library.get('video').metadata.thumbnail.status, 'queued')
  assert.equal(library.get('video').metadata.thumbnail.sourceFingerprint, 'v1')
})

test('needsThumbnail skips current statuses and requeues stale fingerprints', () => {
  for (const status of ['ready', 'queued', 'generating', 'failed']) {
    assert.equal(needsThumbnail(media({
      type: 'video',
      fingerprint: 'same',
      metadata: { thumbnail: { status, sourceFingerprint: 'same' } },
    })), false)
  }

  assert.equal(needsThumbnail(media({
    type: 'video',
    fingerprint: 'new',
    metadata: { thumbnail: { status: 'ready', sourceFingerprint: 'old' } },
  })), true)
  assert.equal(needsThumbnail(media({ type: 'audio', fingerprint: 'a1' })), false)
})

test('publicThumbnail exposes only browser-safe fields', () => {
  assert.deepEqual(publicThumbnail(media({
    metadata: {
      thumbnail: {
        status: 'ready',
        href: '/thumbs/a.jpg',
        generatedAt: 'then',
        error: null,
        sourceFingerprint: 'private',
      },
    },
  })), {
    status: 'ready',
    href: '/thumbs/a.jpg',
    generatedAt: 'then',
  })
})

test('GenerateThumbnailJob respects concurrency 2', async () => {
  const db = makeDb(':memory:')
  migrate(db, jobQueueSchema, { silent: true })

  let active = 0
  let maxActive = 0

  class GenerateThumbnailJob extends BaseJob {
    getConcurrency() {
      return { queue: 'thumbnails', limit: 2 }
    }

    async run() {
      active++
      maxActive = Math.max(maxActive, active)
      await sleep(20)
      active--
    }
  }

  const queue = new JobQueue({ db, env: 'test' }).register(GenerateThumbnailJob)

  await Promise.all([
    queue.push(GenerateThumbnailJob, { id: 'one', fingerprint: '1' }),
    queue.push(GenerateThumbnailJob, { id: 'two', fingerprint: '2' }),
    queue.push(GenerateThumbnailJob, { id: 'three', fingerprint: '3' }),
  ])

  assert.equal(maxActive, 2)
})

function media(attrs = {}) {
  return {
    id: attrs.id || 'id',
    type: attrs.type || 'video',
    fingerprint: attrs.fingerprint || 'fp',
    path: attrs.path || path.join(os.tmpdir(), 'media.mp4'),
    metadata: attrs.metadata || {},
  }
}

function fakeLibrary(records) {
  const map = new Map(records.map(record => [record.id, record]))
  return {
    items() {
      return [...map.values()]
    },
    get(id) {
      return map.get(id) || null
    },
    async update(id, patch) {
      const current = map.get(id)
      const next = {
        ...current,
        ...patch,
        metadata: merge(current.metadata || {}, patch.metadata || {}),
      }
      map.set(id, next)
      return next
    },
  }
}

function merge(a, b) {
  const out = { ...a }
  for (const [key, value] of Object.entries(b)) {
    out[key] = value && typeof value === 'object' && !Array.isArray(value) && out[key]
      ? merge(out[key], value)
      : value
  }
  return out
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
