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

export class HttpSession<AnonSessionData, SessionData> {
  constructor(
    private Session: SessionModel<SessionData>,
    private req: SinRequest,
    private env: HttpSessionEnv,
  ) {}

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
      removeFalseyValues({
        httpOnly: true,
        secure: this.env.secure || false,
        // Cookie expiration time (in seconds)
        // Subtract a few seconds to ensure the cookie expires before the session
        maxAge: (Date.now() - expires_at) / 1000 - 5,
        sameSite: 'strict',
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
      removeFalseyValues({
        HttpOnly: true,
        secure: this.env.secure || false,
        'Max-Age': this.env.cookieExpirationSeconds || ONE_DAY * 30, // Cookie expiration time (in seconds)
        sameSite: 'strict',
      }),
    )
  }

  clear(type: 'user' | 'anon'): void {
    this.req.cookie(
      type === 'user' ? this.env.userCookieName : this.env.anonCookieName,
      '',
      removeFalseyValues({
        HttpOnly: true,
        secure: this.env.secure || false,
        'Max-Age': 0, // Set the cookie expiration to the past
        sameSite: 'strict',
      }),
    )
  }
}

const ONE_DAY = 24 * 60 * 60

function removeFalseyValues(obj: any): any {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v))
}
