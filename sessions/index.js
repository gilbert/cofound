import crypto from 'node:crypto'
import { col } from '../db/schema.js'
import { Model } from '../db/index.js'

const DAY = 1000 * 60 * 60 * 24
const DEFAULT_SESSION_MS = DAY * 30
const DEFAULT_COOKIE_SECONDS = 60 * 60 * 24 * 30
const DEFAULT_SID_BYTES = 128

export const sessionSchema = {
  sessions: {
    cols: {
      id: col.primary(),
      sid: col.text().index('unique'),
      user_id: col.text().index(),
      expires_at: col.timestamp().index(),
      data: col.json(),
    },
  },
}

export class SessionModel extends Model {
  constructor(db, options = {}) {
    super(db, 'sessions', sessionSchema.sessions)
    this.sidBytes = options.sidBytes || DEFAULT_SID_BYTES
    this.sessionMs = options.sessionMs || DEFAULT_SESSION_MS
  }

  create({ user_id, expires_at, data = {} }) {
    expires_at ||= Date.now() + this.sessionMs
    const sid = crypto.randomBytes(this.sidBytes).toString('base64url')
    this.insert({ sid, user_id: String(user_id), expires_at, data })
    return { sid, expires_at }
  }

  put(sid, attrs) {
    this.updateWhere({ sid }, { data: attrs })
  }

  patch(sid, attrs) {
    const session = this.findByOptional({ sid })
    if (!session) return
    this.updateWhere({ sid }, { data: { ...session.data, ...attrs } })
  }
}

export class HttpSession {
  constructor(Session, req, env, cookieOptions = {}) {
    this.Session = Session
    this.req = req
    this.env = {
      userCookieName: 'sid',
      anonCookieName: 'anon',
      ...env,
    }
    this.cookieOptions = {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      secure: !!this.env.secure,
      ...cookieOptions,
    }
  }

  get() {
    const sid = this.req.cookie(this.env.userCookieName)
    if (!sid) return null

    const session = this.Session.findByOptional({ sid })
    if (!session || session.expires_at <= Date.now()) return null
    return { user_id: session.user_id, ...session.data }
  }

  put(attrs) {
    const sid = this.req.cookie(this.env.userCookieName)
    if (sid) this.Session.put(sid, attrs)
  }

  patch(attrs) {
    const sid = this.req.cookie(this.env.userCookieName)
    if (sid) this.Session.patch(sid, attrs)
  }

  create(user_id) {
    const { sid, expires_at } = this.Session.create({ user_id })
    this.req.cookie(this.env.userCookieName, sid, normalizeCookieOptions({
      ...this.cookieOptions,
      maxAge: Math.max(0, Math.floor((expires_at - Date.now()) / 1000) - 5),
    }))
    this.clear('anon')
    return sid
  }

  async getAnon() {
    const value = this.req.cookie(this.env.anonCookieName)
    if (!value) return null
    return verify(value, this.requireSecret())
  }

  async setAnon(attrs) {
    const session = { ...(await this.getAnon()), ...attrs }
    this.req.cookie(this.env.anonCookieName, sign(session, this.requireSecret()), normalizeCookieOptions({
      ...this.cookieOptions,
      maxAge: this.env.cookieExpirationSeconds || DEFAULT_COOKIE_SECONDS,
    }))
  }

  clear(type = 'user') {
    this.req.cookie(
      type === 'anon' ? this.env.anonCookieName : this.env.userCookieName,
      '',
      normalizeCookieOptions({ ...this.cookieOptions, maxAge: 0 }),
    )
  }

  requireSecret() {
    if (!this.env.sessionSecret) throw new Error('HttpSession requires sessionSecret for anonymous sessions')
    return this.env.sessionSecret
  }
}

export function normalizeCookieOptions(options = {}) {
  const out = {}
  const pairs = {
    httpOnly: 'HttpOnly',
    httponly: 'HttpOnly',
    HttpOnly: 'HttpOnly',
    path: 'Path',
    Path: 'Path',
    sameSite: 'SameSite',
    samesite: 'SameSite',
    SameSite: 'SameSite',
    maxAge: 'Max-Age',
    maxage: 'Max-Age',
    'Max-Age': 'Max-Age',
    domain: 'Domain',
    Domain: 'Domain',
    expires: 'Expires',
    Expires: 'Expires',
    secure: 'Secure',
    Secure: 'Secure',
  }

  for (const [key, value] of Object.entries(options)) {
    if (value == null || value === false || value === '') continue
    const name = pairs[key] || key
    if (name === 'Secure' && value !== true) continue
    out[name] = value instanceof Date ? value.toUTCString() : value
  }
  return out
}

function sign(value, secret) {
  const body = Buffer.from(JSON.stringify(value)).toString('base64url')
  return body + '.' + mac(body, secret)
}

function verify(value, secret) {
  const [body, signature] = String(value).split('.')
  if (!body || !signature || !safeEqual(signature, mac(body, secret))) return null

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function mac(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url')
}

function safeEqual(a, b) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}
