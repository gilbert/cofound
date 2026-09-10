import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'

import s from '../ssr/cofound.js'

test('node s.http arraybuffer responses expose only received bytes', async () => {
  const expected = Buffer.from([1, 2, 3])
  const server = http.createServer((req, res) => res.end(expected))
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))

  try {
    const { port } = server.address()
    const body = await s.http('http://127.0.0.1:' + port, { responseType: 'arraybuffer' })
    assert.deepEqual(Buffer.from(body), expected)
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
