import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Writable } from 'node:stream'
import test from 'node:test'
import {
  DOCUMENT_EXTENSIONS,
  isMediaFile,
  mediaType,
  parseMediaName,
  scanMediaFiles,
  serveRange,
} from '../index.js'

const withDocs = { documentExtensions: DOCUMENT_EXTENSIONS }

test('detects video, audio, and image media extensions', () => {
  assert.equal(isMediaFile('/media/movie.mp4'), true)
  assert.equal(isMediaFile('/media/movie.MKV'), true)
  assert.equal(isMediaFile('/media/song.flac'), true)
  assert.equal(isMediaFile('/media/poster.png'), true)
  assert.equal(mediaType('/media/movie.webm'), 'video')
  assert.equal(mediaType('/media/song.mp3'), 'audio')
  assert.equal(mediaType('/media/poster.png'), 'image')
  // iOS shoots HEIC by default and uploads with uppercase extensions.
  assert.equal(mediaType('/media/IMG_3563.HEIC'), 'image')
  assert.equal(mediaType('/media/IMG_3563.heic'), 'image')
  assert.equal(mediaType('/media/photo.heif'), 'image')
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

  assert.deepEqual(parseMediaName('cover-art.png'), {
    kind: 'image',
    title: 'cover-art',
  })
})

test('documents are opt-in: recognized only when documentExtensions is passed', () => {
  // Default (media-only) behaviour is unchanged — no documentExtensions means
  // PDFs/Office/text are still not media files.
  assert.equal(mediaType('/docs/report.pdf'), null)
  assert.equal(mediaType('/docs/notes.docx'), null)
  assert.equal(isMediaFile('/docs/report.pdf'), false)

  // Opting in classifies the curated allowlist as 'document'.
  assert.equal(mediaType('/docs/report.pdf', withDocs), 'document')
  assert.equal(mediaType('/docs/notes.DOCX', withDocs), 'document')
  assert.equal(mediaType('/docs/sheet.xlsx', withDocs), 'document')
  assert.equal(mediaType('/docs/deck.pptx', withDocs), 'document')
  assert.equal(mediaType('/docs/readme.txt', withDocs), 'document')
  assert.equal(isMediaFile('/docs/report.pdf', withDocs), true)

  // A still-unlisted extension stays unrecognized even with the option on.
  assert.equal(mediaType('/docs/archive.xyz', withDocs), null)
  // Media extensions keep their existing kind regardless of the option.
  assert.equal(mediaType('/media/movie.mp4', withDocs), 'video')
})

test('parseMediaName keeps document titles intact (no movie/year heuristics)', () => {
  assert.deepEqual(parseMediaName('Tax Return 2024.pdf', withDocs), {
    kind: 'document',
    title: 'Tax Return 2024',
  })
  assert.deepEqual(parseMediaName('Q1_report.docx', withDocs), {
    kind: 'document',
    title: 'Q1 report',
  })
})

test('scanMediaFiles includes documents when opted in', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-file-docs-'))
  await writeFile(path.join(dir, 'poster.png'), 'image')
  await writeFile(path.join(dir, 'Tax Return 2024.pdf'), 'pdf')
  await writeFile(path.join(dir, 'archive.xyz'), 'junk')

  const media = []
  for await (const file of scanMediaFiles(dir)) media.push(path.basename(file.path))
  assert.deepEqual(media.sort(), ['poster.png'])

  const withDocuments = []
  for await (const file of scanMediaFiles(dir, withDocs)) withDocuments.push(path.basename(file.path))
  assert.deepEqual(withDocuments.sort(), ['Tax Return 2024.pdf', 'poster.png'])
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

  assert.equal(files.length, 4)
  assert.deepEqual(files.map(file => path.basename(file.path)).sort((a, b) => a.localeCompare(b)), [
    'poster.png',
    'song.mp3',
    'The Matrix (1999).mkv',
    'Breaking Bad S03E07 - One Minute.mp4',
  ].sort((a, b) => a.localeCompare(b)))
  assert.deepEqual(files.map(file => file.type).sort(), ['audio', 'image', 'video', 'video'])
})

test('serveRange returns a full response without Range', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-range-'))
  const file = path.join(dir, 'clip.mp4')
  await writeFile(file, '0123456789')

  const result = await withRange(file)

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

  const result = await withRange(file, { Range: 'bytes=2-5' })

  assert.equal(result.status, 206)
  assert.equal(result.headers['content-range'], 'bytes 2-5/10')
  assert.equal(result.headers['content-length'], '4')
  assert.equal(result.body, '2345')
})

test('serveRange returns a suffix range', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-range-'))
  const file = path.join(dir, 'clip.mp4')
  await writeFile(file, '0123456789')

  const result = await withRange(file, { Range: 'bytes=-4' })

  assert.equal(result.status, 206)
  assert.equal(result.headers['content-range'], 'bytes 6-9/10')
  assert.equal(result.body, '6789')
})

test('serveRange rejects invalid and unsatisfiable ranges', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-range-'))
  const file = path.join(dir, 'clip.mp4')
  await writeFile(file, '0123456789')

  const invalid = await withRange(file, { Range: 'bytes=8-2' })
  assert.equal(invalid.status, 416)
  assert.equal(invalid.headers['content-range'], 'bytes */10')

  const unsatisfiable = await withRange(file, { Range: 'bytes=100-200' })
  assert.equal(unsatisfiable.status, 416)
  assert.equal(unsatisfiable.headers['content-range'], 'bytes */10')
})

test('serveRange handles Cofound HEAD requests without a body', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-range-'))
  const file = path.join(dir, 'clip.mp4')
  await writeFile(file, '0123456789')

  const r = cofoundRangeRequest({ method: 'head' })
  await serveRange(r, file)

  assert.equal(r.statusCode, 200)
  assert.equal(r.responseHeaders['content-length'], '10')
  assert.equal(r.body(), '')
})

async function withRange(file, headers = {}) {
  const r = cofoundRangeRequest({ headers })
  await serveRange(r, file)
  return {
    status: r.statusCode,
    headers: r.responseHeaders,
    body: r.body(),
  }
}

function cofoundRangeRequest({ method = 'get', headers = {} } = {}) {
  const chunks = []
  const r = {
    method,
    headers: lowerHeaders(headers),
    statusCode: null,
    responseHeaders: {},
    writable: new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk))
        callback()
      },
    }),
    body() {
      return Buffer.concat(chunks).toString('utf8') + (this.responseBody || '')
    },
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
      this.responseBody = String(body)
    },
  }
  return r
}

function lowerHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
}
