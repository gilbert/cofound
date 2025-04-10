import { webcrypto } from 'crypto'
import * as Iron from 'iron-webcrypto'

import { SinRequest } from '../../types/sin-types'

type SessionRow<Data> = { user_id: number; expires_at: number; data: Data }

type SessionModel<SessionData> = {
  create(attrs: { user_id: number }): { sid: string; expires_at: number }
  put(sid: string, attrs: SessionData): void
  patch(sid: string, attrs: Partial<SessionData>): void
  findByOptional(where: { sid: string }): SessionRow<SessionData> | null
}

export type HttpSessionEnv = {
  secure?: boolean
  sessionSecret: string
  userCookieName: string
  anonCookieName: string
  cookieMaxAgeSeconds?: number
  cookieExpirationSeconds?: number
}

/**
 * Options for setting cookies. Based on standard Set-Cookie attributes.
 */
export type CookieOptions = {
  /** The maximum duration (in seconds) the cookie should be stored. */
  maxAge?: number
  /** The specific date/time when the cookie should expire. (maxAge is often preferred) */
  // expires?: Date; // uncomment if you need this specifically
  /** Restricts the cookie to a specific domain. */
  domain?: string
  /** Restricts the cookie to a specific path. Defaults to '/' in most cases. */
  path?: string
  /** If true, the cookie is only sent over HTTPS. */
  secure?: boolean
  /** If true, the cookie cannot be accessed via client-side JavaScript. Recommended. */
  httpOnly?: boolean
  /** Controls cross-site request behavior ('strict', 'lax', 'none'). */
  sameSite?: 'strict' | 'lax' | 'none'
}

export class HttpSession<AnonSessionData, SessionData> {
  constructor(
    private Session: SessionModel<SessionData>,
    private req: SinRequest,
    private env: HttpSessionEnv,
    private cookieOptions: CookieOptions = {},
  ) {
    this.cookieOptions = {
      httpOnly: true,
      secure: this.env.secure || false, // Should be true in production over HTTPS
      sameSite: 'lax', // Default to lax to avoid session redirect issues
      path: '/',
      domain: '', // Default: no domain attribute (browser uses current host)
      ...this.cookieOptions,
    }
  }

  get(): (SessionData & { user_id: number }) | null {
    const sid = this.req.cookie(this.env.userCookieName)
    if (!sid) return null

    const sess = this.Session.findByOptional({ sid })
    return sess && { user_id: sess.user_id, ...sess.data }
  }

  put(attrs: SessionData) {
    const sid = this.req.cookie(this.env.userCookieName)
    sid && this.Session.put(sid, attrs)
  }

  patch(attrs: Partial<SessionData>) {
    const sid = this.req.cookie(this.env.userCookieName)
    sid && this.Session.patch(sid, attrs)
  }

  create(user_id: number) {
    const { sid, expires_at } = this.Session.create({ user_id })
    this.req.cookie(
      this.env.userCookieName,
      sid,
      removeNullyValues({
        ...this.cookieOptions,
        maxAge: Math.max(0, Math.floor((expires_at - Date.now()) / 1000) - 5), // 5 sec buffer
      }),
    )
    this.clear('anon')
  }

  async getAnon(): Promise<AnonSessionData | null> {
    const cookieValue = this.req.cookie(this.env.anonCookieName)
    if (!cookieValue) return null

    let session: AnonSessionData | undefined
    try {
      const sess = await Iron.unseal(webcrypto, cookieValue, this.env.sessionSecret, Iron.defaults)
      session = sess as AnonSessionData
    } catch {}

    return session || null
  }

  async setAnon(attrs: AnonSessionData) {
    const newSess = { ...(await this.getAnon()), ...attrs }
    const sealedSession = await Iron.seal(webcrypto, newSess, this.env.sessionSecret, Iron.defaults)
    this.req.cookie(
      this.env.anonCookieName,
      sealedSession,
      removeNullyValues({
        ...this.cookieOptions,
        maxAge: this.env.cookieExpirationSeconds || ONE_DAY * 30, // Cookie expiration time (in seconds)
      }),
    )
  }

  clear(type: 'user' | 'anon'): void {
    this.req.cookie(
      type === 'user' ? this.env.userCookieName : this.env.anonCookieName,
      '',
      removeNullyValues({
        ...this.cookieOptions,
        maxAge: 0, // Set the cookie expiration to the past
      }),
    )
  }
}

const ONE_DAY = 24 * 60 * 60

function removeNullyValues(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v || typeof v === 'number' || typeof v === 'boolean'),
  )
}
