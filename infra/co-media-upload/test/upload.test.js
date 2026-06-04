import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
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

test('uploadFile creates, resumes by HEAD, patches chunks, and clears storage', async () => {
  const completed = []
  const server = await uploadTestServer({
    id: () => 'client',
    onComplete: info => completed.push(info),
  })
  const storage = memoryStorage()

  try {
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

async function uploadTestServer(options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'co-media-upload-'))
  const nodeServer = http.createServer((req, res) => {
    handleUpload(req, res, {
      dir,
      prefix: '/upload',
      ttl: 60 * 60 * 1000,
      ...options,
    })
  })
  await new Promise(resolve => nodeServer.listen(0, '127.0.0.1', resolve))
  const port = nodeServer.address().port
  return {
    dir,
    url(pathname) {
      return `http://127.0.0.1:${port}${pathname}`
    },
    close() {
      return new Promise(resolve => nodeServer.close(resolve))
    },
  }
}

function request(server, method, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body || ''
    const req = http.request(server.url(pathname), {
      method,
      headers: options.headers || {},
      agent: false,
    }, res => {
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
    req.end(body)
  })
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
