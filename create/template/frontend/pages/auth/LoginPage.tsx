import { activateLoginPasskeyAutofill, getLoginAttestation, ok } from 'cofound'
import { ClientActions, cc } from 'cofound/frontend'
import s from 'sin'

import { Layout } from '../../Layout'
import { client } from '../../lib/rpc-client'
import { routes } from '../../routes'

type Attrs = {}
export const LoginPage = cc<Attrs>(function () {
  let email = ''

  setupAutofill()

  const actions = ClientActions({
    async loginWithPasskey() {
      const res1 = await client.public_rpc_getUsePasskeyOptions({})
      if (!res1.ok) return res1

      const res2 = await getLoginAttestation('e9558272', res1.value)
      if (!res2.ok) return res2

      const res3 = await client.public_rpc_loginWithPasskey({
        attestation: res2.value,
      })
      if (!res3.ok) return res3

      routes.dashboard.visit()

      return ok({})
    },
    async login(e: Event) {
      e.preventDefault()
      const form = e.target as HTMLFormElement
      email = form.email.value
      const res = await client.public_rpc_sendLoginOtp({ email })
      if (!res.ok) return res
      routes.auth.login.verify.visit()
      return ok({})
    },
    async verify(e: Event) {
      e.preventDefault()
      const form = e.target as HTMLFormElement
      const code = form.code.value
      const res = await client.public_rpc_verifyLoginOtp({ code })
      if (!res.ok) return res
      routes.auth.connect.visit()
      return ok({})
    },
  })

  async function setupAutofill() {
    const res1 = await client.public_rpc_getUsePasskeyOptions({})
    if (!res1.ok) return res1
    const res2 = await activateLoginPasskeyAutofill('e9558273', res1.value)
    console.log('Got', res2)
  }

  return ({}) => {
    if (routes.auth.login.verify.isCurrent() && !email) {
      routes.auth.login.replace()
      return null
    }
    const e = actions.error.any
    return (
      <Layout>
        <h1>Login</h1>

        {e && (
          <div class="bg-red-100 border border-red-300">
            {e.reason === 'expired_code' ? (
              <p>Code is expired. ({e.code})</p>
            ) : e.reason === 'too_many_otps' || e.reason === 'resend_too_soon' ? (
              <p>
                Too many attempts. Please wait {e.meta.minutesLeft} minutes. ({e.code})
              </p>
            ) : e.reason === 'email_not_registered' ? (
              <p>
                Email not found. Did you mean to{' '}
                <a href={routes.auth.login()} class="underline">
                  sign up
                </a>{' '}
                instead?
              </p>
            ) : (
              <p>
                {e.reason} ({e.code})
              </p>
            )}
          </div>
        )}

        <div class="mt-2 p-4 border max-w-xs flex flex-col">
          {this.ctx.route({
            '/': () => (
              <form onsubmit={actions.login} class="flex flex-col gap-4">
                <fieldset class="flex flex-col gap-2">
                  <label for="email">Email address:</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    class="px-1 block border border-gray-800"
                    autocomplete="email webauthn"
                  />
                </fieldset>
                <button type="submit" class="px-3 py-1 bg-indigo-500 text-white rounded">
                  Send One-Time Password
                </button>

                <p class="text-center text-xs font-bold">OR</p>

                <button
                  onclick={actions.loginWithPasskey}
                  class="px-3 py-1 bg-indigo-500 text-white rounded"
                  type="button"
                >
                  Login with Passkey
                </button>
              </form>
            ),
            '/verify': () => (
              <form onsubmit={actions.verify} class="flex flex-col gap-4">
                <fieldset class="flex flex-col gap-2">
                  <p>
                    Email sent to <small>{email}</small>
                  </p>
                  <label for="code">Enter verification code:</label>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    required
                    class="px-1 block border border-gray-800"
                    autocomplete="one-time-code"
                  />
                </fieldset>
                <button type="submit" class="px-3 py-1 bg-indigo-500 text-white rounded">
                  Verify
                </button>
              </form>
            ),
          })}
        </div>

        <div class="mt-2 max-w-xs text-center text-sm">
          Don't have an account?{' '}
          <a href={routes.auth.signup()} class="underline">
            Sign up instead.
          </a>
        </div>
      </Layout>
    )
  }
})
