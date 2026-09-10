import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import test from 'node:test'

import { makeTestServer } from '../shared/server/test-utils.js'

async function listen(server) {
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  return 'http://127.0.0.1:' + server.address().port
}

async function close(server) {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

test('proxy dechunks upstream responses', async () => {
  const upstream = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.write('hello')
    res.end(' world')
  })
  const target = await listen(upstream)
  const proxy = await makeTestServer(app => app.all(r => r.proxy(target + r.url)))

  try {
    const res = await fetch('http://localhost:' + proxy.port + '/chunked', {
      signal: AbortSignal.timeout(1000),
    })
    assert.equal(res.status, 200)
    assert.equal(await res.text(), 'hello world')
  } finally {
    await proxy.close()
    await close(upstream)
  }
})

test('proxy completes upstream responses with no body', async () => {
  const upstream = http.createServer((req, res) => {
    if (req.url === '/no-content')
      return res.writeHead(204, { 'X-Upstream': 'kept' }).end()

    res.writeHead(200, { 'Content-Length': '0', 'X-Upstream': 'kept' }).end()
  })
  const target = await listen(upstream)
  const proxy = await makeTestServer(app => app.all(r => r.proxy(target + r.url)))

  try {
    for (const [path, status] of [['/empty', 200], ['/no-content', 204]]) {
      const res = await fetch('http://localhost:' + proxy.port + path, {
        signal: AbortSignal.timeout(1000),
      })
      assert.equal(res.status, status)
      assert.equal(res.headers.get('x-upstream'), 'kept')
      assert.equal(await res.text(), '')
    }
  } finally {
    await proxy.close()
    await close(upstream)
  }
})

test('proxy parses response headers split across socket reads', async () => {
  const upstream = net.createServer(socket => {
    socket.once('data', () => {
      socket.write('HTTP/1.1 200 OK\r\nContent-Type: text/pl')
      setTimeout(() => socket.end('ain\r\nContent-Length: 5\r\nConnection: close\r\n\r\nhello'), 10)
    })
  })
  const target = await listen(upstream)
  const proxy = await makeTestServer(app => app.all(r => r.proxy(target + r.url)))

  try {
    const res = await fetch('http://localhost:' + proxy.port + '/split', {
      signal: AbortSignal.timeout(1000),
    })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'text/plain')
    assert.equal(await res.text(), 'hello')
  } finally {
    await proxy.close()
    await close(upstream)
  }
})
