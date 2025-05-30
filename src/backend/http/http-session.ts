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

    // Calculate the options object that would normally be passed
    let optionsForCookie: Record<string, any> = removeNullyValues({
      ...this.cookieOptions,
      maxAge: Math.max(0, Math.floor((expires_at - Date.now()) / 1000) - 5), // 5 sec buffer
    })

    // --- FIX/WORKAROUND for faulty req.cookie serializer ---

    // Part 1: Fix the secure=false issue (Critical for Safari on HTTP)
    if (optionsForCookie.secure === false) {
      console.log(
        `[HttpSession.create WORKAROUND] secure:false detected for HTTP. Deleting 'secure' key from options.`,
      )
      delete optionsForCookie.secure
    }

    // Part 2: Normalize casing of common attribute keys (Attempt to fix duplicates)
    const normalizeKey = (
      opts: Record<string, any>,
      nonStandardKey: string,
      standardKey: string,
    ) => {
      if (opts.hasOwnProperty(nonStandardKey)) {
        if (!opts.hasOwnProperty(standardKey) || nonStandardKey === standardKey.toLowerCase()) {
          if (!opts.hasOwnProperty(standardKey)) {
            opts[standardKey] = opts[nonStandardKey]
            console.log(
              `[HttpSession.create WORKAROUND] Normalizing key case: Copied '${nonStandardKey}' to '${standardKey}'.`,
            )
          } else {
            console.log(
              `[HttpSession.create WORKAROUND] Normalizing key case: Standard key '${standardKey}' already exists, ignoring '${nonStandardKey}'.`,
            )
          }
        }
        if (nonStandardKey !== standardKey) {
          console.log(
            `[HttpSession.create WORKAROUND] Normalizing key case: Deleting non-standard key '${nonStandardKey}'.`,
          )
          delete opts[nonStandardKey]
        }
      }
    }

    normalizeKey(optionsForCookie, 'httponly', 'HttpOnly')
    normalizeKey(optionsForCookie, 'path', 'Path')
    normalizeKey(optionsForCookie, 'samesite', 'SameSite')
    normalizeKey(optionsForCookie, 'maxAge', 'Max-Age')
    normalizeKey(optionsForCookie, 'maxage', 'Max-Age')
    normalizeKey(optionsForCookie, 'domain', 'Domain')
    normalizeKey(optionsForCookie, 'expires', 'Expires')

    // --- End FIX/WORKAROUND ---

    // Log the final options being passed (for debugging)
    console.log(
      `[HttpSession.create] Calling req.cookie for '${this.env.userCookieName}' with final options:`,
      JSON.stringify(optionsForCookie),
    )

    this.req.cookie(this.env.userCookieName, sid, optionsForCookie)

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

    // Calculate the options object that would normally be passed
    let optionsForCookie: Record<string, any> = removeNullyValues({
      ...this.cookieOptions,
      maxAge: this.env.cookieExpirationSeconds || ONE_DAY * 30,
    })

    // --- FIX/WORKAROUND for faulty req.cookie serializer ---

    // Part 1: Fix the secure=false issue (Critical for Safari on HTTP)
    if (optionsForCookie.secure === false) {
      console.log(
        `[HttpSession.setAnon WORKAROUND] secure:false detected for HTTP. Deleting 'secure' key from options.`,
      )
      delete optionsForCookie.secure
    }

    // Part 2: Normalize casing of common attribute keys (Attempt to fix duplicates)
    const normalizeKey = (
      opts: Record<string, any>,
      nonStandardKey: string,
      standardKey: string,
    ) => {
      if (opts.hasOwnProperty(nonStandardKey)) {
        if (!opts.hasOwnProperty(standardKey) || nonStandardKey === standardKey.toLowerCase()) {
          if (!opts.hasOwnProperty(standardKey)) {
            opts[standardKey] = opts[nonStandardKey]
            console.log(
              `[HttpSession.setAnon WORKAROUND] Normalizing key case: Copied '${nonStandardKey}' to '${standardKey}'.`,
            )
          } else {
            console.log(
              `[HttpSession.setAnon WORKAROUND] Normalizing key case: Standard key '${standardKey}' already exists, ignoring '${nonStandardKey}'.`,
            )
          }
        }
        if (nonStandardKey !== standardKey) {
          console.log(
            `[HttpSession.setAnon WORKAROUND] Normalizing key case: Deleting non-standard key '${nonStandardKey}'.`,
          )
          delete opts[nonStandardKey]
        }
      }
    }

    normalizeKey(optionsForCookie, 'httponly', 'HttpOnly')
    normalizeKey(optionsForCookie, 'path', 'Path')
    normalizeKey(optionsForCookie, 'samesite', 'SameSite')
    normalizeKey(optionsForCookie, 'maxAge', 'Max-Age')
    normalizeKey(optionsForCookie, 'maxage', 'Max-Age')
    normalizeKey(optionsForCookie, 'domain', 'Domain')
    normalizeKey(optionsForCookie, 'expires', 'Expires')

    // --- End FIX/WORKAROUND ---

    // Log the final options being passed (for debugging)
    console.log(
      `[HttpSession.setAnon] Calling req.cookie for '${this.env.anonCookieName}' with final options:`,
      JSON.stringify(optionsForCookie),
    )

    this.req.cookie(this.env.anonCookieName, sealedSession, optionsForCookie)
  }

  clear(type: 'user' | 'anon'): void {
    // Create a properly formatted cookie options object
    const cookieOpts = {
      httpOnly: this.cookieOptions.httpOnly,
      path: this.cookieOptions.path,
      sameSite: this.cookieOptions.sameSite,
      maxAge: 0, // Set the cookie expiration to the past
    }

    // Only add secure attribute if it's true
    if (this.cookieOptions.secure === true) {
      cookieOpts['secure'] = true
    }

    // Only add domain if it's specified
    if (this.cookieOptions.domain) {
      cookieOpts['domain'] = this.cookieOptions.domain
    }

    this.req.cookie(
      type === 'user' ? this.env.userCookieName : this.env.anonCookieName,
      '',
      cookieOpts,
    )
  }
}

const ONE_DAY = 24 * 60 * 60

function removeNullyValues(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v || typeof v === 'number' || typeof v === 'boolean'),
  )
}
