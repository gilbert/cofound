import t from 'cos/test'
import { makeTestServer } from 'cos/server/test-utils'
import routes from '../server/index.js'

function eq(a, b) {
  const as = JSON.stringify(a), bs = JSON.stringify(b)
  if (as !== bs) throw new Error('expected `' + as + '` but got `' + bs + '`')
}

t`api`({
  async run(test) {
    const api = await makeTestServer(routes)
    try { return await test(api) }
    finally { api.close() }
  }
},

  t`GET /api/hello returns greeting`(async (api) => {
    const { status, body } = await api.get('/api/hello')
    t.is(200, status)
    eq({ hello: 'world' }, body)
  }),
)
