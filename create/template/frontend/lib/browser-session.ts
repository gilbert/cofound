import s from 'sin'

import { routes } from '../routes'
import { Values, client } from './rpc-client'

/**
 * BrowserSession is a class that represents the current session of the user, in the browser.
 * Add methods to this class to interact with the session data.
 */
export class BrowserSession {
  user: SessData['user']

  constructor(data: SessData) {
    this.user = data.user
  }
}

type SessData = Values['rpc_getSessionData']

let sess: BrowserSession | null = null
let sessPromise: Promise<BrowserSession> | null = null

export async function fetchBrowserSession() {
  if (!sessPromise) {
    sessPromise = client.rpc_getSessionData({}).then(async (res) => {
      if (!res.ok) {
        sessPromise = null
        sessionStorage.setItem('redirect_back_to', window.location.pathname)
        routes.auth.login.visit()
        throw new Error(`[fetchBrowserSession] ${res.reason}`)
      }
      sess = new BrowserSession(res.unwrap())

      // If you want to force users to have a passkey, you can uncomment this block
      // if (!sess.user.hasPasskey && !routes.auth.connect.isCurrent()) {
      //   routes.auth.connect.visit()
      // }
      s.redraw()
      return sess
    })
  }
  return sessPromise
}

/** Feel free to ! this type if your component is under a signedIn() wrapper */
export function getBrowserSession() {
  return sess
}

export function clearBrowserSession() {
  sess = null
  sessPromise = null
}
