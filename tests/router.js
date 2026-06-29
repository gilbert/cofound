import t from 'cofound/test'
import { makeTestServer } from '../shared/server/test-utils.js'

t`router`(
  // Regression: param names used to be extracted with /:[a-z][a-z0-9_]*/, which
  // truncated at the first uppercase letter — so `:thingId` parsed as `thing`
  // and r.params.thingId was undefined. Names may contain uppercase now.
  t`extracts mixed-case and snake_case path params`(async () => {
    const server = await makeTestServer(app => {
      app.get('/things/:thingId/sub/:other_id', r => r.json(r.params))
    })
    try {
      const res = await server.get('/things/abc/sub/XYZ')
      t.is(200, res.status)
      t.is('abc', res.body.thingId)
      t.is('XYZ', res.body.other_id)
    } finally {
      await server.close()
    }
  }),

  // Regression: the node adapter wrote response headers with setHeader, which
  // replaces same-named headers — so of HttpSession's two Set-Cookie headers
  // (create sid + clear anon) only the last survived. They must all arrive,
  // matching the uws adapter's per-header writes.
  t`keeps repeated Set-Cookie headers`(async () => {
    const server = await makeTestServer(app => {
      app.get('/cookies', r => {
        r.cookie('first', 'one', { Path: '/' })
        r.cookie('second', 'two', { Path: '/', 'Max-Age': 0 })
        r.json({ ok: true })
      })
    })
    try {
      const res = await fetch('http://localhost:' + server.port + '/cookies')
      t.is(200, res.status)
      const cookies = res.headers.getSetCookie()
      t.is(2, cookies.length)
      t.is(true, cookies.some(line => line.startsWith('first=one')))
      t.is(true, cookies.some(line => line.startsWith('second=two')))
    } finally {
      await server.close()
    }
  }),
)
