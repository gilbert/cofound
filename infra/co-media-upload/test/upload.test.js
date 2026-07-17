import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'
import {
  decodeMetadata,
  encodeMetadata,
  handleUpload,
  uploadFile,
} from '../index.js'

test('encodes and decodes tus upload metadata', () => {
  const encoded = encodeMetadata({
    filename: 'Movie (2026).mkv',
    type: 'video/x-matroska',
  })

  assert.deepEqual(decodeMetadata(encoded), {
    filename: 'Movie (2026).mkv',
    type: 'video/x-matroska',
  })
})

test('OPTIONS advertises the supported tus subset', async () => {
  const server = await uploadTestServer({ maxSize: 100 })
  try {
    const res = await request(server, 'OPTIONS', '/upload')
    assert.equal(res.status, 204)
    assert.equal(res.headers['tus-resumable'], '1.0.0')
    assert.equal(res.headers['tus-version'], '1.0.0')
    assert.equal(res.headers['tus-extension'], 'creation,termination,expiration')
    assert.equal(res.headers['tus-max-size'], '100')
  } finally {
    await server.close()
  }
})

test('creates upload, reports offset, patches bytes, and completes once', async () => {
  const completed = []
  const server = await uploadTestServer({
    id: () => 'abc123',
    onComplete: info => completed.push(info),
  })

  try {
    const created = await request(server, 'POST', '/upload', {
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Length': '10',
        'Upload-Metadata': encodeMetadata({ filename: 'clip.mp4' }),
      },
    })
    assert.equal(created.status, 201)
    assert.equal(created.headers.location, '/upload/abc123')
    assert.equal(created.headers['upload-offset'], '0')
    assert.ok(created.headers['upload-expires'])

    const head0 = await request(server, 'HEAD', '/upload/abc123', {
      headers: { 'Tus-Resumable': '1.0.0' },
    })
    assert.equal(head0.status, 200)
    assert.equal(head0.headers['cache-control'], 'no-store')
    assert.equal(head0.headers['upload-offset'], '0')
    assert.equal(head0.headers['upload-length'], '10')
    assert.deepEqual(decodeMetadata(head0.headers['upload-metadata']), { filename: 'clip.mp4' })

    const first = await request(server, 'PATCH', '/upload/abc123', {
      headers: patchHeaders(0, 5),
      body: 'hello',
    })
    assert.equal(first.status, 204)
    assert.equal(first.headers['upload-offset'], '5')
    assert.equal(completed.length, 0)

    const second = await request(server, 'PATCH', '/upload/abc123', {
      headers: patchHeaders(5, 5),
      body: 'world',
    })
    assert.equal(second.status, 204)
    assert.equal(second.headers['upload-offset'], '10')
    assert.equal(completed.length, 1)
    assert.equal(completed[0].id, 'abc123')
    assert.deepEqual(completed[0].metadata, { filename: 'clip.mp4' })
    assert.equal(await readFile(path.join(server.dir, 'abc123.bin'), 'utf8'), 'helloworld')

    const duplicate = await request(server, 'PATCH', '/upload/abc123', {
      headers: patchHeaders(10, 0),
      body: '',
    })
    assert.equal(duplicate.status, 409)
    assert.equal(completed.length, 1)
  } finally {
    await server.close()
  }
})

test('rejects wrong offsets and unsupported patch content types', async () => {
  const server = await uploadTestServer({ id: () => 'wrong' })
  try {
    await request(server, 'POST', '/upload', {
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Length': '4',
      },
    })

    const wrongOffset = await request(server, 'PATCH', '/upload/wrong', {
      headers: patchHeaders(2, 2),
      body: 'no',
    })
    assert.equal(wrongOffset.status, 409)

    const wrongType = await request(server, 'PATCH', '/upload/wrong', {
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '0',
        'Content-Type': 'application/octet-stream',
        'Content-Length': '2',
      },
      body: 'no',
    })
    assert.equal(wrongType.status, 415)
  } finally {
    await server.close()
  }
})

test('rejects uploads above max size', async () => {
  const server = await uploadTestServer({ maxSize: 3 })
  try {
    const res = await request(server, 'POST', '/upload', {
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Length': '4',
      },
    })
    assert.equal(res.status, 413)
  } finally {
    await server.close()
  }
})

test('DELETE removes upload files', async () => {
  const server = await uploadTestServer({ id: () => 'delete-me' })
  try {
    await request(server, 'POST', '/upload', {
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Length': '4',
      },
    })

    const deleted = await request(server, 'DELETE', '/upload/delete-me', {
      headers: { 'Tus-Resumable': '1.0.0' },
    })
    assert.equal(deleted.status, 204)

    await assert.rejects(() => stat(path.join(server.dir, 'delete-me.bin')), /ENOENT/)
    await assert.rejects(() => stat(path.join(server.dir, 'delete-me.json')), /ENOENT/)
  } finally {
    await server.close()
  }
})

test('expired uploads return 410 and are cleaned up', async () => {
  const server = await uploadTestServer({ id: () => 'expired', ttl: -1 })
  try {
    await request(server, 'POST', '/upload', {
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Length': '4',
      },
    })

    const res = await request(server, 'HEAD', '/upload/expired', {
      headers: { 'Tus-Resumable': '1.0.0' },
    })
    assert.equal(res.status, 410)
    await assert.rejects(() => stat(path.join(server.dir, 'expired.bin')), /ENOENT/)
  } finally {
    await server.close()
  }
})

test('completeHeaders adds headers from the onComplete result to the final PATCH only', async () => {
  const server = await uploadTestServer({
    id: () => 'withheaders',
    onComplete: () => ({ id: 'record-42' }),
    completeHeaders: result => ({ 'Upload-Media-Id': result.id }),
  })

  try {
    await request(server, 'POST', '/upload', {
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Length': '10',
        'Upload-Metadata': encodeMetadata({ filename: 'clip.mp4' }),
      },
    })

    const first = await request(server, 'PATCH', '/upload/withheaders', {
      headers: patchHeaders(0, 5),
      body: 'hello',
    })
    assert.equal(first.status, 204)
    assert.equal(first.headers['upload-media-id'], undefined)

    const second = await request(server, 'PATCH', '/upload/withheaders', {
      headers: patchHeaders(5, 5),
      body: 'world',
    })
    assert.equal(second.status, 204)
    assert.equal(second.headers['upload-media-id'], 'record-42')
  } finally {
    await server.close()
  }
})

test('uploadFile creates, resumes by HEAD, patches chunks, and clears storage', async () => {
  const completed = []
  const server = await uploadTestServer({
    id: () => 'client',
    onComplete: info => completed.push(info),
  })
  const storage = memoryStorage()
  const fetch = globalThis.fetch

  try {
    globalThis.fetch = uploadFetch(server)
    const file = new File(['abcdef'], 'client.txt', { lastModified: 123 })
    const progress = []
    const upload = uploadFile(file, {
      endpoint: server.url('/upload'),
      chunkSize: 2,
      storage,
      metadata: { filename: file.name },
      onProgress: value => progress.push(value),
    })

    await upload.start()

    assert.deepEqual(progress, [
      { uploaded: 2, total: 6 },
      { uploaded: 4, total: 6 },
      { uploaded: 6, total: 6 },
    ])
    assert.equal(storage.size, 0)
    assert.equal(completed.length, 1)
    assert.equal(await readFile(path.join(server.dir, 'client.bin'), 'utf8'), 'abcdef')
  } finally {
    globalThis.fetch = fetch
    await server.close()
  }
})

function patchHeaders(offset, length) {
  return {
    'Tus-Resumable': '1.0.0',
    'Upload-Offset': String(offset),
    'Content-Type': 'application/offset+octet-stream',
    'Content-Length': String(length),
  }
}

function cofoundUploadRequest(method, url, headers = {}, body = '') {
  const parsed = new URL(url, 'http://local')
  return {
    method: method.toLowerCase(),
    url: parsed.pathname,
    rawQuery: parsed.search.slice(1),
    headers: lowerHeaders(headers),
    readable: Readable.from(body ? [body] : []),
    statusCode: null,
    responseHeaders: {},
    responseBody: '',
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
}

function lowerHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
}

async function uploadTestServer(options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-upload-'))
  const uploadOptions = {
    dir,
    prefix: '/upload',
    ttl: 60 * 60 * 1000,
    ...options,
  }
  return {
    dir,
    url(pathname) {
      return pathname
    },
    async request(method, pathname, options = {}) {
      const r = cofoundUploadRequest(method, pathname, options.headers || {}, options.body || '')
      await handleUpload(r, uploadOptions)
      return {
        status: r.statusCode,
        headers: r.responseHeaders,
        body: r.responseBody,
      }
    },
    close() {
      return Promise.resolve()
    },
  }
}

function request(server, method, pathname, options = {}) {
  return server.request(method, pathname, options)
}

function uploadFetch(server) {
  return async(url, options = {}) => {
    const body = options.body ? await bodyBuffer(options.body) : ''
    const res = await request(server, options.method || 'GET', new URL(url, 'http://local').pathname, {
      headers: options.headers,
      body,
    })
    return {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      headers: {
        get(name) {
          return res.headers[name.toLowerCase()] || null
        },
      },
      text() {
        return Promise.resolve(res.body)
      },
    }
  }
}

async function bodyBuffer(body) {
  if (body == null) return ''
  if (typeof body === 'string' || Buffer.isBuffer(body)) return body
  if (body instanceof Uint8Array) return Buffer.from(body)
  if (typeof body.arrayBuffer === 'function') return Buffer.from(await body.arrayBuffer())
  throw new Error('Unsupported test body')
}

function memoryStorage() {
  const map = new Map()
  return {
    get size() {
      return map.size
    },
    getItem(key) {
      return map.get(key) || null
    },
    setItem(key, value) {
      map.set(key, value)
    },
    removeItem(key) {
      map.delete(key)
    },
  }
}
