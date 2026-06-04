import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'
import { MediaProbeError, normalizeProbe, probe } from '../index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')

async function fixture(name) {
  const url = new URL(`./fixtures/${name}.json`, import.meta.url)
  return JSON.parse(await (await import('node:fs/promises')).readFile(url, 'utf8'))
}

function hasCommand(command) {
  return spawnSync(command, ['-version'], { stdio: 'ignore' }).status === 0
}

test('normalizes mp4 video, audio, and chapters', async () => {
  const info = normalizeProbe(await fixture('mp4'), { path: '/media/movie.mp4' })

  assert.equal(info.path, '/media/movie.mp4')
  assert.equal(info.container, 'mov,mp4,m4a,3gp,3g2,mj2')
  assert.equal(info.duration, 123.456)
  assert.equal(info.bitrate, 2500000)
  assert.deepEqual(info.video, {
    index: 0,
    codec: 'h264',
    profile: 'High',
    width: 1920,
    height: 1080,
    fps: 30000 / 1001,
    hdr: false,
  })
  assert.deepEqual(info.audio, [
    { index: 1, codec: 'aac', channels: 2, language: 'eng' },
  ])
  assert.deepEqual(info.chapters, [
    { start: 10.5, title: 'Opening' },
  ])
})

test('normalizes mkv with multiple audio tracks and forced subtitles', async () => {
  const info = normalizeProbe(await fixture('mkv'), { path: '/media/show.mkv' })

  assert.equal(info.bitrate, null)
  assert.equal(info.video.codec, 'hevc')
  assert.equal(info.video.hdr, true)
  assert.deepEqual(info.audio, [
    { index: 1, codec: 'opus', channels: 6, language: 'eng' },
    { index: 2, codec: 'aac', channels: 2, language: 'jpn' },
  ])
  assert.deepEqual(info.subtitles, [
    { index: 3, codec: 'subrip', language: 'eng', forced: true },
  ])
})

test('handles missing streams and format fields', () => {
  const info = normalizeProbe({}, { path: '/media/audio.m4a', raw: true })

  assert.equal(info.path, '/media/audio.m4a')
  assert.equal(info.container, null)
  assert.equal(info.duration, null)
  assert.equal(info.bitrate, null)
  assert.equal(info.video, null)
  assert.deepEqual(info.audio, [])
  assert.deepEqual(info.subtitles, [])
  assert.deepEqual(info.chapters, [])
  assert.deepEqual(info.raw, {})
})

test('probe reports spawn failures clearly', async () => {
  await assert.rejects(
    () => probe('/nope.mp4', { ffprobe: '/definitely/missing/ffprobe' }),
    err => {
      assert.ok(err instanceof MediaProbeError)
      assert.match(err.message, /Failed to start/)
      return true
    }
  )
})

test('probe smoke test covers local sample media when ffprobe is available', { skip: !hasCommand('ffprobe') }, async () => {
  const samples = [
    'tmp-samples/cartjam.mp4',
    'tmp-samples/Screen Recording 2026-06-04 at 2.00.29\u202fAM.mov',
    'tmp-samples/rite.m4a',
    'tmp-samples/clip.wav',
  ]

  for (const relative of samples) {
    const file = path.join(root, relative)
    await access(file)
    const info = await probe(file)
    assert.equal(info.path, file)
    assert.ok(info.duration == null || info.duration >= 0)
    assert.ok(info.video || info.audio.length > 0)
  }
})
