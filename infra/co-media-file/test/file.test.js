import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  isMediaFile,
  mediaType,
  parseMediaName,
  scanMediaFiles,
  serveRange,
} from '../index.js'

test('detects video and audio media extensions', () => {
  assert.equal(isMediaFile('/media/movie.mp4'), true)
  assert.equal(isMediaFile('/media/movie.MKV'), true)
  assert.equal(isMediaFile('/media/song.flac'), true)
  assert.equal(isMediaFile('/media/poster.png'), false)
  assert.equal(mediaType('/media/movie.webm'), 'video')
  assert.equal(mediaType('/media/song.mp3'), 'audio')
})

test('parses common movie filenames', () => {
  assert.deepEqual(parseMediaName('The Matrix (1999).mkv'), {
    kind: 'movie',
    title: 'The Matrix',
    year: 1999,
  })

  assert.deepEqual(parseMediaName('The.Matrix.1999.1080p.BluRay.x264.mkv'), {
    kind: 'movie',
    title: 'The Matrix',
    year: 1999,
  })
})

test('parses common episode filenames', () => {
  assert.deepEqual(parseMediaName('Breaking Bad S03E07 - One Minute.mkv'), {
    kind: 'episode',
    show: 'Breaking Bad',
    season: 3,
    episode: 7,
    title: 'One Minute',
  })

  assert.deepEqual(parseMediaName('Severance.2x03.Who Is Alive.1080p.webm'), {
    kind: 'episode',
    show: 'Severance',
    season: 2,
    episode: 3,
    title: 'Who Is Alive',
  })
})

test('falls back for unknown media names', () => {
  assert.deepEqual(parseMediaName('Screen Recording 2026-06-04 at 2.00.29 AM.mov'), {
    kind: 'video',
    title: 'Screen Recording 2026-06-04 at 2 00 29 AM',
  })

  assert.deepEqual(parseMediaName('12 The Rite Of Spring.m4a'), {
    kind: 'audio',
    title: '12 The Rite Of Spring',
  })
})

test('scanMediaFiles yields only allowlisted media and ignores junk directories', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-file-'))
  await mkdir(path.join(dir, 'season'))
  await mkdir(path.join(dir, 'metadata'))
  await writeFile(path.join(dir, 'The Matrix (1999).mkv'), 'video')
  await writeFile(path.join(dir, 'season', 'Breaking Bad S03E07 - One Minute.mp4'), 'video')
  await writeFile(path.join(dir, 'song.mp3'), 'audio')
  await writeFile(path.join(dir, 'poster.png'), 'image')
  await writeFile(path.join(dir, 'metadata', 'hidden.mp4'), 'ignored')

  const files = []
  for await (const file of scanMediaFiles(dir)) files.push(file)
  files.sort((a, b) => a.path.localeCompare(b.path))

  assert.equal(files.length, 3)
  assert.deepEqual(files.map(file => path.basename(file.path)), [
    'song.mp3',
    'The Matrix (1999).mkv',
    'Breaking Bad S03E07 - One Minute.mp4',
  ].sort((a, b) => a.localeCompare(b)))
  assert.deepEqual(files.map(file => file.type).sort(), ['audio', 'video', 'video'])
})

test('serveRange returns a full response without Range', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-range-'))
  const file = path.join(dir, 'clip.mp4')
  await writeFile(file, '0123456789')

  const result = await withServer(file)

  assert.equal(result.status, 200)
  assert.equal(result.headers['accept-ranges'], 'bytes')
  assert.equal(result.headers['content-type'], 'video/mp4')
  assert.equal(result.headers['content-length'], '10')
  assert.equal(result.body, '0123456789')
})

test('serveRange returns a valid single range', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-range-'))
  const file = path.join(dir, 'clip.mp4')
  await writeFile(file, '0123456789')

  const result = await withServer(file, { Range: 'bytes=2-5' })

  assert.equal(result.status, 206)
  assert.equal(result.headers['content-range'], 'bytes 2-5/10')
  assert.equal(result.headers['content-length'], '4')
  assert.equal(result.body, '2345')
})

test('serveRange returns a suffix range', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-range-'))
  const file = path.join(dir, 'clip.mp4')
  await writeFile(file, '0123456789')

  const result = await withServer(file, { Range: 'bytes=-4' })

  assert.equal(result.status, 206)
  assert.equal(result.headers['content-range'], 'bytes 6-9/10')
  assert.equal(result.body, '6789')
})

test('serveRange rejects invalid and unsatisfiable ranges', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-range-'))
  const file = path.join(dir, 'clip.mp4')
  await writeFile(file, '0123456789')

  const invalid = await withServer(file, { Range: 'bytes=8-2' })
  assert.equal(invalid.status, 416)
  assert.equal(invalid.headers['content-range'], 'bytes */10')

  const unsatisfiable = await withServer(file, { Range: 'bytes=100-200' })
  assert.equal(unsatisfiable.status, 416)
  assert.equal(unsatisfiable.headers['content-range'], 'bytes */10')
})

async function withServer(file, headers = {}) {
  const server = http.createServer((req, res) => {
    serveRange(req, res, file).catch(err => {
      res.writeHead(500)
      res.end(err.message)
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  try {
    return await request({ port, headers })
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

function request({ port, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/', headers, agent: false }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })
    req.on('error', reject)
    req.end()
  })
}
