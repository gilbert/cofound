import { Readable } from 'node:stream'
import fs from 'node:fs'
import t from 'cofound/test'
import { makeTestServer } from '../shared/server/test-utils.js'

// Regression: the node adapter's Response never initialized `offset`, so it was
// `undefined`. Any response that sets Content-Length streams through tryEnd,
// where `if (this.offset === 0)` was false on the first chunk (undefined !== 0):
// the status/Content-Range/Content-Length headers were never written, offset
// arithmetic became NaN, `done` never turned true, and the response was never
// cleanly ended. Media players got a malformed non-range response, played the
// first buffered second, then re-requested from byte 0 — an endless loop.
const DATA = Buffer.from(Array.from({ length: 50 }, (_, i) => i))

// Mirror co-media-file's serveRange streaming path: set Content-Length, then
// pipe a Readable into r.writable.
function streamBytes(r, bytes, { status = 200, headers = {} } = {}) {
  r.header(status, { 'Content-Type': 'application/octet-stream', 'Content-Length': bytes.length, ...headers })
  return new Promise((resolve, reject) => {
    const stream = Readable.from(bytes)
    stream.on('error', reject)
    r.writable.on('error', reject)
    r.writable.on('finish', resolve)
    stream.pipe(r.writable)
  })
}

async function serveRangeServer() {
  return makeTestServer(app => {
    app.get('/clip', async r => {
      const match = String(r.headers.range || '').match(/^bytes=(\d+)-(\d+)$/)
      if (!match)
        return streamBytes(r, DATA)
      const start = Number(match[1])
      const end = Number(match[2])
      await streamBytes(r, DATA.subarray(start, end + 1), {
        status: 206,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${DATA.length}`,
        },
      })
    })
  })
}

async function fileServer() {
  return makeTestServer(app => {
    app.get('/package.json', r => r.file('package.json', {
      cache: false,
      compressions: [],
      minStreamSize: 1,
      maxCacheSize: 0,
    }))
  })
}

function fetchRaw(base, path, headers) {
  return fetch(base + path, { headers, signal: AbortSignal.timeout(300) })
}

t`serve-range`(
  t`built-in file serving returns exactly bytes 0-0`(async () => {
    const server = await fileServer()
    try {
      const expected = fs.readFileSync('package.json').subarray(0, 1)
      const res = await fetchRaw('http://localhost:' + server.port, '/package.json', { Range: 'bytes=0-0' })
      const body = Buffer.from(await res.arrayBuffer())
      t.is(206, res.status)
      t.is('bytes 0-0/' + fs.statSync('package.json').size, res.headers.get('content-range'))
      t.is('1', res.headers.get('content-length'))
      t.is(true, body.equals(expected))
    } finally {
      await server.close()
    }
  }),

  t`built-in file serving supports suffix ranges`(async () => {
    const server = await fileServer()
    try {
      const file = fs.readFileSync('package.json')
      const res = await fetchRaw('http://localhost:' + server.port, '/package.json', { Range: 'bytes=-4' })
      const body = Buffer.from(await res.arrayBuffer())
      t.is(206, res.status)
      t.is('bytes ' + (file.length - 4) + '-' + (file.length - 1) + '/' + file.length, res.headers.get('content-range'))
      t.is('4', res.headers.get('content-length'))
      t.is(true, body.equals(file.subarray(-4)))
    } finally {
      await server.close()
    }
  }),

  t`built-in file serving reports the selected length for ranged HEAD`(async () => {
    const server = await fileServer()
    try {
      const size = fs.statSync('package.json').size
      const res = await fetch('http://localhost:' + server.port + '/package.json', {
        method: 'HEAD',
        headers: { Range: 'bytes=2-5' },
        signal: AbortSignal.timeout(300),
      })
      t.is(206, res.status)
      t.is('bytes 2-5/' + size, res.headers.get('content-range'))
      t.is('4', res.headers.get('content-length'))
      t.is('', await res.text())
    } finally {
      await server.close()
    }
  }),

  t`built-in file serving rejects unsupported multi-ranges`(async () => {
    const server = await fileServer()
    try {
      const size = fs.statSync('package.json').size
      const res = await fetchRaw('http://localhost:' + server.port, '/package.json', { Range: 'bytes=0-1,3-4' })
      t.is(416, res.status)
      t.is('bytes */' + size, res.headers.get('content-range'))
    } finally {
      await server.close()
    }
  }),

  t`streams a full Content-Length response through the node adapter`(async () => {
    const server = await serveRangeServer()
    try {
      const res = await fetchRaw('http://localhost:' + server.port, '/clip')
      const body = Buffer.from(await res.arrayBuffer())
      t.is(200, res.status)
      t.is('50', res.headers.get('content-length'))
      t.is(50, body.length)
      t.is(true, body.equals(DATA))
    } finally {
      await server.close()
    }
  }),

  t`serves a byte range with 206 and Content-Range`(async () => {
    const server = await serveRangeServer()
    try {
      const res = await fetchRaw('http://localhost:' + server.port, '/clip', { Range: 'bytes=10-19' })
      const body = Buffer.from(await res.arrayBuffer())
      t.is(206, res.status)
      t.is('bytes 10-19/50', res.headers.get('content-range'))
      t.is('10', res.headers.get('content-length'))
      t.is(10, body.length)
      t.is(true, body.equals(DATA.subarray(10, 20)))
    } finally {
      await server.close()
    }
  }),
)
