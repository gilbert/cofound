import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdir, mkdtemp } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
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

  const scanned = []
  for await (const file of scanMediaFiles(generated)) scanned.push(file)
  assert.equal(scanned.length, 4)
  assert.deepEqual(scanned.map(file => path.extname(file.path)).sort(), [
    '.mkv',
    '.mp3',
    '.wav',
    '.webm',
  ])

  for (const file of files) {
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
  const server = http.createServer((req, res) => {
    serveRange(req, res, file).catch(err => {
      res.writeHead(500)
      res.end(err.message)
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  try {
    return await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/',
        agent: false,
        headers: { Range: range },
      }, res => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        })
      })
      req.on('error', reject)
      req.end()
    })
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}
