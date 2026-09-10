import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'

import s from '../ssr/cofound.js'

async function serve(handler) {
  const server = http.createServer(handler)
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  return server
}

async function close(server) {
  server.closeAllConnections()
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

test('node s.http arraybuffer responses expose only received bytes', async () => {
  const expected = Buffer.from([1, 2, 3])
  const server = await serve((req, res) => res.end(expected))

  try {
    const { port } = server.address()
    const body = await s.http('http://127.0.0.1:' + port, { responseType: 'arraybuffer' })
    assert.deepEqual(Buffer.from(body), expected)
  } finally {
    await close(server)
  }
})

test('node s.http supports AbortSignal', async () => {
  const server = await serve(() => {})
  const controller = new AbortController()

  try {
    const request = s.http('http://127.0.0.1:' + server.address().port, {
      signal: controller.signal,
    })
    controller.abort()
    await assert.rejects(request, /ABORTED/)
  } finally {
    await close(server)
  }
})

test('node s.http promises can abort themselves', async () => {
  const server = await serve(() => {})

  try {
    const request = s.http('http://127.0.0.1:' + server.address().port)
    assert.equal(typeof request.abort, 'function')
    request.abort()
    await assert.rejects(request, /ABORTED/)
  } finally {
    await close(server)
  }
})

test('node s.http distinguishes timeouts from aborts', async () => {
  const server = await serve(() => {})

  try {
    const request = s.http('http://127.0.0.1:' + server.address().port, { timeout: 20 })
    await assert.rejects(request, /TIMEOUT/)
  } finally {
    await close(server)
  }
})
