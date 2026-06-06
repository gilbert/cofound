import assert from 'node:assert/strict'
import test from 'node:test'
import { col, makeDb, migrate } from 'cofound/db'
import {
  HttpSession,
  SessionModel,
  normalizeCookieOptions,
  sessionSchema,
} from 'cofound/sessions'

test('sessionSchema migrates alongside app tables', () => {
  const db = makeDb(':memory:')
  migrate(db, {
    ...sessionSchema,
    users: {
      cols: {
        id: col.id(),
        email: col.text(),
      },
    },
  }, { silent: true })

  const tables = db
    .prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name != 'sqlite_sequence'")
    .all()
    .map(row => row.name)
    .sort()

  assert.deepEqual(tables, ['sessions', 'users'])
})

test('SessionModel creates, patches, and puts session data', () => {
  const model = freshModel()
  const { sid, expires_at } = model.create({ user_id: 'user-1' })

  assert.equal(typeof sid, 'string')
  assert.equal(model.findBy({ sid }).user_id, 'user-1')
  assert.equal(model.findBy({ sid }).expires_at, expires_at)
  assert.deepEqual(model.findBy({ sid }).data, {})

  model.patch(sid, { theme: 'dark' })
  model.patch(sid, { volume: 7 })
  assert.deepEqual(model.findBy({ sid }).data, { theme: 'dark', volume: 7 })

  model.put(sid, { theme: 'light' })
  assert.deepEqual(model.findBy({ sid }).data, { theme: 'light' })
})

test('HttpSession creates user sessions and reads active data', () => {
  const model = freshModel()
  const req = fakeRequest()
  const session = new HttpSession(model, req, {
    userCookieName: 'canister_sid',
    anonCookieName: 'canister_anon',
    sessionSecret: 'secret',
  })

  const sid = session.create('user-1')
  model.patch(sid, { role: 'admin' })

  assert.deepEqual(session.get(), { user_id: 'user-1', role: 'admin' })
  assert.equal(req.cookies.canister_sid, sid)
})

test('HttpSession ignores expired user sessions', () => {
  const model = freshModel()
  const req = fakeRequest()
  const { sid } = model.create({
    user_id: 'user-1',
    expires_at: Date.now() - 1000,
  })
  req.cookies.sid = sid

  assert.equal(new HttpSession(model, req, { sessionSecret: 'secret' }).get(), null)
})

test('HttpSession stores signed anonymous session cookies', async () => {
  const model = freshModel()
  const req = fakeRequest()
  const session = new HttpSession(model, req, {
    anonCookieName: 'anon',
    sessionSecret: 'secret',
  })

  await session.setAnon({ flow: 'signup' })
  await session.setAnon({ step: 2 })

  assert.deepEqual(await session.getAnon(), { flow: 'signup', step: 2 })

  req.cookies.anon += 'tamper'
  assert.equal(await session.getAnon(), null)
})

test('HttpSession clears cookies with Max-Age zero', () => {
  const model = freshModel()
  const req = fakeRequest()
  const session = new HttpSession(model, req, {
    userCookieName: 'sid',
    anonCookieName: 'anon',
    sessionSecret: 'secret',
  })

  session.clear('anon')

  assert.equal(req.setCookies.at(-1).name, 'anon')
  assert.equal(req.setCookies.at(-1).value, '')
  assert.equal(req.setCookies.at(-1).options['Max-Age'], 0)
})

test('normalizeCookieOptions keeps cookie compatibility fence', () => {
  assert.deepEqual(normalizeCookieOptions({
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 60,
    secure: false,
    domain: '',
    path: '/',
    expires: new Date('2026-06-05T00:00:00.000Z'),
  }), {
    HttpOnly: true,
    SameSite: 'Lax',
    'Max-Age': 60,
    Path: '/',
    Expires: 'Fri, 05 Jun 2026 00:00:00 GMT',
  })

  assert.deepEqual(normalizeCookieOptions({
    HttpOnly: true,
    SameSite: 'Strict',
    Secure: true,
    Domain: 'example.com',
  }), {
    HttpOnly: true,
    SameSite: 'Strict',
    Secure: true,
    Domain: 'example.com',
  })
})

function freshModel() {
  const db = makeDb(':memory:')
  migrate(db, sessionSchema, { silent: true })
  return new SessionModel(db)
}

function fakeRequest() {
  return {
    cookies: {},
    setCookies: [],
    cookie(name, value, options) {
      if (arguments.length === 1) return this.cookies[name] || null
      this.cookies[name] = value
      this.setCookies.push({ name, value, options })
    },
  }
}
