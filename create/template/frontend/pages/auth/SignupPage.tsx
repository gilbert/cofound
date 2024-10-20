import { ClientActions, cc } from 'cofound/frontend'
import { getNewPasskeyAttestation } from 'cofound/frontend/pods/passkey'
import { ok } from 'cofound/shared/result'
import s from 'sin'

import { Layout } from '../../Layout'
import { client } from '../../lib/rpc-client'
import { routes } from '../../routes'

type Attrs = {}
export const SignupPage = cc<Attrs>(function () {
  let email = ''

  const actions = ClientActions({
    async signup(e: Event) {
      e.preventDefault()
      const form = e.target as HTMLFormElement
      email = form.email.value
      const res = await client.public_rpc_sendRegisterOtp({ email })
      if (!res.ok) return res
      routes.auth.signup.verify.visit()
      return ok({})
    },
    async verify(e: Event) {
      e.preventDefault()
      const form = e.target as HTMLFormElement
      const code = form.code.value
      const res = await client.public_rpc_verifyRegisterOtp({ code })
      if (!res.ok) return res
      routes.auth.connect.visit()
      return ok({})
    },
  })

  return () => {
    if (routes.auth.signup.verify.isCurrent() && !email) {
      routes.auth.signup.replace()
      return null
    }
    const e = actions.error.any
    return (
      <Layout>
        <h1>Signup</h1>

        {e && (
          <div class="bg-red-100 border border-red-300">
            {e.reason === 'expired_code' ? (
              <p>Code is expired. ({e.code})</p>
            ) : e.reason === 'too_many_otps' || e.reason === 'resend_too_soon' ? (
              <p>
                Too many attempts. Please wait {e.meta.minutesLeft} minutes. ({e.code})
              </p>
            ) : e.reason === 'email_taken' ? (
              <p>
                Email already exists. Did you mean to{' '}
                <a href={routes.auth.login()} class="underline">
                  login
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

        <div class="mt-2 p-4 border max-w-xs">
          {this.ctx.route({
            '/': () => (
              <form onsubmit={actions.signup} class="flex flex-col gap-4">
                <fieldset class="flex flex-col gap-2">
                  <label for="email">Email address:</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    class="px-1 block border border-gray-800"
                  />
                </fieldset>
                <button type="submit" class="px-3 py-1 bg-indigo-500 text-white rounded">
                  Sign up
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
                  />
                </fieldset>
                <button type="submit" class="px-3 py-1 bg-indigo-500 text-white rounded">
                  Verify
                </button>
              </form>
            ),
          })}

          <div class="mt-2 max-w-xs text-center text-sm">
            Already have an account?{' '}
            <a href={routes.auth.login()} class="underline">
              Log in instead.
            </a>
          </div>
        </div>
      </Layout>
    )
  }
})
