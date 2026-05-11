import t from 'cofound/test'
import { makeTestDb } from 'cofound/db/test-utils'
import { makeTestServer } from 'cofound/server/test-utils'
import { createRoutes } from '../server/index.js'

function eq(a, b) {
  const as = JSON.stringify(a), bs = JSON.stringify(b)
  if (as !== bs) throw new Error('expected `' + as + '` but got `' + bs + '`')
}

t`co-sheets email-list`({
  async run(test) {
    const db = makeTestDb()
    const mountRoutes = createRoutes(db)
    const api = await makeTestServer(app => mountRoutes(app, '/api'))
    try { return await test(api) }
    finally { api.close() }
  }
},

  t`GET /api/_schema/subscribers returns schema info`(async (api) => {
    const { status, body } = await api.get('/api/_schema/subscribers')
    t.is(200, status)
    t.is('integer', body.cols.id.type)
    t.is(true, body.cols.id.primary)
    t.is('text', body.cols.name.type)
    t.is('text', body.cols.email.type)
    eq(['name', 'email'], body.editable)
    eq({}, body.labels)
  }),

  t`GET /api/_schema/unknown returns 404`(async (api) => {
    const { status, body } = await api.get('/api/_schema/unknown')
    t.is(404, status)
    return ['Unknown table', body.error]
  }),

  t`GET /api/subscribers returns empty array initially`(async (api) => {
    const { status, body } = await api.get('/api/subscribers')
    t.is(200, status)
    eq([], body)
  }),

  t`POST /api/subscribers creates a subscriber`(async (api) => {
    const { status, body } = await api.post('/api/subscribers', { name: 'Alice', email: 'alice@example.com' })
    t.is(201, status)
    t.is('Alice', body.name)
    t.is('alice@example.com', body.email)
    return ['number', typeof body.id]
  }),

  t`GET /api/subscribers returns created subscribers`(async (api) => {
    await api.post('/api/subscribers', { name: 'Alice', email: 'alice@example.com' })
    await api.post('/api/subscribers', { name: 'Bob', email: 'bob@example.com' })
    const { status, body } = await api.get('/api/subscribers')
    t.is(200, status)
    t.is(2, body.length)
    t.is('Alice', body[0].name)
    return ['Bob', body[1].name]
  }),

  t`PATCH /api/subscribers/:id updates a subscriber`(async (api) => {
    const { body: created } = await api.post('/api/subscribers', { name: 'Alice', email: 'alice@example.com' })
    const { status, body } = await api.patch('/api/subscribers/' + created.id, { name: 'Alicia' })
    t.is(200, status)
    t.is('Alicia', body.name)
    return ['alice@example.com', body.email]
  }),

  t`DELETE /api/subscribers/:id removes a subscriber`(async (api) => {
    const { body: created } = await api.post('/api/subscribers', { name: 'Alice', email: 'alice@example.com' })
    const { status, body } = await api.delete('/api/subscribers/' + created.id)
    t.is(200, status)
    t.is(true, body.ok)
    const { body: remaining } = await api.get('/api/subscribers')
    return [0, remaining.length]
  }),

  t`PATCH with invalid id returns 404`(async (api) => {
    const { status, body } = await api.patch('/api/subscribers/99999', { name: 'Ghost' })
    t.is(404, status)
    return ['Not found', body.error]
  }),

  t`DELETE with invalid id returns 404`(async (api) => {
    const { status, body } = await api.delete('/api/subscribers/99999')
    t.is(404, status)
    return ['Not found', body.error]
  }),

  t`POST ignores extra fields like id and created_at`(async (api) => {
    const { status, body } = await api.post('/api/subscribers', {
      id: 999,
      name: 'Charlie',
      email: 'charlie@example.com',
      created_at: 0,
    })
    t.is(201, status)
    t.is('Charlie', body.name)
    // id should be auto-assigned, not 999
    if (body.id === 999) throw new Error('id should not be settable via POST')
  }),
)
