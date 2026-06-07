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
)
