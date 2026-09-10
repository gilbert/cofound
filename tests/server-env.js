import assert from 'node:assert/strict'
import test from 'node:test'

process.env.COFOUND_MIN_COMPRESS_SIZE = '1'

const { makeTestServer } = await import('../shared/server/test-utils.js')

test('COFOUND_MIN_COMPRESS_SIZE configures file response compression', async () => {
  const server = await makeTestServer(app => {
    app.get('/window.js', r => r.file('src/window.js', { cache: false }))
  })

  try {
    const res = await fetch('http://localhost:' + server.port + '/window.js', {
      headers: { 'Accept-Encoding': 'gzip' },
      signal: AbortSignal.timeout(1000),
    })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-encoding'), 'gzip')
  } finally {
    await server.close()
  }
})
