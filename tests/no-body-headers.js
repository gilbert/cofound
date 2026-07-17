import t from 'cofound/test'
import { makeTestServer } from '../shared/server/test-utils.js'

// Regression: the node adapter's endWithoutBody() never flushed accumulated
// headers, so every no-body response (204/205/304 and HEAD) lost ALL of its
// headers — e.g. a tus PATCH 204 dropped Upload-Offset and Tus-Resumable.
// The uws adapter always kept them; the two must match.
async function noBodyServer() {
  return makeTestServer(app => {
    app.patch('/upload', r => {
      r.end('', 204, {
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '4',
        'X-Custom': 'kept',
      })
    })
    app.head('/asset', r => {
      r.end('', 200, {
        'Content-Length': '10',
        'X-Custom': 'kept',
      })
    })
  })
}

t`no-body responses keep headers`(
  t`204 responses keep their headers through the node adapter`(async () => {
    const server = await noBodyServer()
    try {
      const res = await fetch('http://localhost:' + server.port + '/upload', {
        method: 'PATCH',
        signal: AbortSignal.timeout(300),
      })
      t.is(204, res.status)
      t.is('1.0.0', res.headers.get('tus-resumable'))
      t.is('4', res.headers.get('upload-offset'))
      t.is('kept', res.headers.get('x-custom'))
    } finally {
      await server.close()
    }
  }),

  t`HEAD responses keep their headers through the node adapter`(async () => {
    const server = await noBodyServer()
    try {
      const res = await fetch('http://localhost:' + server.port + '/asset', {
        method: 'HEAD',
        signal: AbortSignal.timeout(300),
      })
      t.is(200, res.status)
      t.is('kept', res.headers.get('x-custom'))
    } finally {
      await server.close()
    }
  }),
)
