import t from 'cofound/test'
import { makeTestDb } from 'cofound/db/test-utils'
import { makeTestServer } from 'cofound/server/test-utils'
import { createRoutes } from '../server/index.js'

function eq(a, b) {
  const as = JSON.stringify(a), bs = JSON.stringify(b)
  if (as !== bs) throw new Error('expected `' + as + '` but got `' + bs + '`')
}

t`todo-app`({
  async run(test) {
    const db = makeTestDb()
    const routes = createRoutes(db)
    const api = await makeTestServer(routes)
    try { return await test(api) }
    finally { api.close() }
  }
},

  t`GET /api/todos returns empty array initially`(async (api) => {
    const { status, body } = await api.get('/api/todos')
    t.is(200, status)
    eq([], body)
  }),

  t`POST /api/todos creates a todo`(async (api) => {
    const { status, body } = await api.post('/api/todos', { text: 'Buy milk' })
    t.is(201, status)
    t.is('Buy milk', body.text)
    t.is(false, body.done)
    return ['number', typeof body.id]
  }),

  t`GET /api/todos returns created todos`(async (api) => {
    await api.post('/api/todos', { text: 'First' })
    await api.post('/api/todos', { text: 'Second' })
    const { status, body } = await api.get('/api/todos')
    t.is(200, status)
    t.is(2, body.length)
    t.is('First', body[0].text)
    return ['Second', body[1].text]
  }),

  t`PATCH /api/todos/:id toggles done`(async (api) => {
    const { body: created } = await api.post('/api/todos', { text: 'Toggle me' })
    t.is(false, created.done)
    const { status, body } = await api.patch('/api/todos/' + created.id)
    t.is(200, status)
    t.is(true, body.done)
    const { body: toggled } = await api.patch('/api/todos/' + created.id)
    return [false, toggled.done]
  }),

  t`DELETE /api/todos/:id removes a todo`(async (api) => {
    const { body: created } = await api.post('/api/todos', { text: 'Delete me' })
    const { status, body } = await api.delete('/api/todos/' + created.id)
    t.is(200, status)
    t.is(true, body.ok)
    const { body: remaining } = await api.get('/api/todos')
    return [0, remaining.length]
  }),

  t`PATCH with invalid id returns 404`(async (api) => {
    const { status, body } = await api.patch('/api/todos/99999')
    t.is(404, status)
    return ['Not found', body.error]
  }),

  t`DELETE with invalid id returns 404`(async (api) => {
    const { status, body } = await api.delete('/api/todos/99999')
    t.is(404, status)
    return ['Not found', body.error]
  }),
)
