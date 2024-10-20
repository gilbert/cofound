import { cc } from 'cofound/frontend'
import s from 'sin'

import { clearBrowserSession, getBrowserSession } from './lib/browser-session'
import { client } from './lib/rpc-client'
import { routes } from './routes'

type Attrs = {}
export const Layout = cc<Attrs>(function () {
  async function logout() {
    await client.rpc_signout({})
    clearBrowserSession()
    routes.auth.login.visit()
  }
  return () => {
    const sess = getBrowserSession()
    return (
      <div class="p-4">
        <nav class="flex gap-2">
          {sess ? (
            <>
              <a class="underline" href={routes.dashboard()}>
                Dashboard
              </a>
              <a class="underline" href={routes.settings()}>
                Settings
              </a>
              <div class="flex-1"></div>
              <button class="underline" onclick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <a class="underline" href="/">
                Home
              </a>
              <a class="underline" href={routes.auth.signup()}>
                Signup
              </a>
              <a class="underline" href={routes.auth.login()}>
                Login
              </a>
            </>
          )}
        </nav>
        <main class="pt-8">{this.children}</main>
      </div>
    )
  }
})
