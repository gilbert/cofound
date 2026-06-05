import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdir, mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { probe } from '../../co-media-probe/index.js'
import { scanMediaFiles, serveRange } from '../index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')

function hasCommand(command) {
  return spawnSync(command, ['-version'], { stdio: 'ignore' }).status === 0
}

test('phase 1 smoke test scans, probes, and range-serves several media types', {
  skip: !hasCommand('ffmpeg') || !hasCommand('ffprobe'),
}, async () => {
  const generated = await mkdtemp(path.join(os.tmpdir(), 'co-media-smoke-'))
  await mkdir(path.join(generated, 'Season 01'))

  const files = [
    path.join(root, 'tmp-samples/cartjam.mp4'),
    path.join(root, 'tmp-samples/Screen Recording 2026-06-04 at 2.00.29\u202fAM.mov'),
    path.join(root, 'tmp-samples/rite.m4a'),
    path.join(root, 'tmp-samples/clip.wav'),
    path.join(generated, 'Test Movie (2026).mkv'),
    path.join(generated, 'Season 01', 'Test Show S01E01 - Pilot.webm'),
    path.join(generated, 'Test Track.mp3'),
    path.join(generated, 'Test Tone.wav'),
    path.join(generated, 'Poster.png'),
  ]

  for (const file of files.slice(0, 4)) await access(file)

  ffmpeg([
    '-f', 'lavfi',
    '-i', 'testsrc=size=160x90:rate=10',
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:sample_rate=44100',
    '-t', '1',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-pix_fmt', 'yuv420p',
    files[4],
  ])

  ffmpeg([
    '-f', 'lavfi',
    '-i', 'testsrc=size=160x90:rate=10',
    '-t', '1',
    '-c:v', 'libvpx-vp9',
    '-an',
    files[5],
  ])

  ffmpeg([
    '-f', 'lavfi',
    '-i', 'sine=frequency=330:sample_rate=44100',
    '-t', '1',
    '-c:a', 'libmp3lame',
    files[6],
  ])

  ffmpeg([
    '-f', 'lavfi',
    '-i', 'sine=frequency=220:sample_rate=44100',
    '-t', '1',
    files[7],
  ])

  ffmpeg([
    '-f', 'lavfi',
    '-i', 'testsrc=size=160x90',
    '-frames:v', '1',
    files[8],
  ])

  const scanned = []
  for await (const file of scanMediaFiles(generated)) scanned.push(file)
  assert.equal(scanned.length, 5)
  assert.deepEqual(scanned.map(file => path.extname(file.path)).sort(), [
    '.mkv',
    '.mp3',
    '.png',
    '.wav',
    '.webm',
  ])

  for (const file of files.slice(0, 8)) {
    const info = await probe(file)
    assert.ok(info.video || info.audio.length > 0, file)
  }

  const range = await requestRange(files[4], 'bytes=0-31')
  assert.equal(range.status, 206)
  assert.match(range.headers['content-range'], /^bytes 0-31\//)
  assert.equal(range.body.length, 32)
})

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
    stdio: 'pipe',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr.toString('utf8') || `ffmpeg exited ${result.status}`)
  }
}

async function requestRange(file, range) {
  const r = cofoundRangeRequest({ Range: range })
  await serveRange(r, file)
  return {
    status: r.statusCode,
    headers: r.responseHeaders,
    body: Buffer.concat(r.chunks),
  }
}

function cofoundRangeRequest(headers = {}) {
  const r = {
    method: 'get',
    headers: lowerHeaders(headers),
    chunks: [],
    statusCode: null,
    responseHeaders: {},
    writable: new Writable({
      write(chunk, encoding, callback) {
        r.chunks.push(Buffer.from(chunk))
        callback()
      },
    }),
    status(status) {
      this.statusCode = status
      return this
    },
    header(h, v, x) {
      if (typeof h === 'number') {
        this.status(h)
        h = v
        v = x
      }
      if (typeof h === 'object') {
        Object.entries(h).forEach(([name, value]) => this.header(name, value))
      } else if (v != null) {
        this.responseHeaders[h.toLowerCase()] = String(v)
      }
      return this
    },
    end(body = '', status, headers) {
      if (typeof status === 'object') {
        headers = status
        status = null
      }
      if (status) this.status(status)
      if (headers) this.header(headers)
      if (body) this.chunks.push(Buffer.from(body))
    },
  }
  return r
}

function lowerHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
}
