# Frontend Client Actions

Cofound provides powerful helpers for interacting with the backend. `ClientActions` is an object constructor that allows you to define a client-side action that mutates data via one of your predefined RPCs.

Using `ClientActions` gives you several features for free:

- Integrated loading states
- Typed error handling
- Auto interaction blocking (prevents double-click issues)

## ClientActions Example

The included SignupPage component is a great example of the utility of ClientActions. Simplified a bit:

```tsx
import { ClientActions, cc } from 'cofound/frontend'
import { ok } from 'cofound/result'
import s from 'sin'

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
    //
    // FEATURE: actions.error[prop] is defined for each action you define.
    // In this case, actions.error.signup and actions.error.verify
    //
    const exampleErr = actions.error.signup //=> ErrResult<...> | undefined

    //
    // FEATURE: actions.error.any is a special key that will return ANY error
    // that is present amongst ANY of the actions you have defined.
    // In this case, it includes (typed!) errors from both signup and verify
    //
    const e = actions.error.any
    return (
      <div>
        <h1>Signup</h1>

        {e && (
          <div class="bg-red-100 border border-red-300">
            {
              /*
               * FEATURE: This is how you can handle specific errors.
               * Notive how .reason is correctly typed! 😎
               */
            }
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

        {
          /*
           * FEATURE: This is how you call your actions.
           * Calling ANY defined action while another is running will be a no-op.
           */
        }
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

          {
            /*
             * FEATURE: You can use loading states to disable or animate your buttons.
             *
             * ADVANCED: This value is not just a boolean, but the parameters you called
             * the action with!
             */
          }
          <button
            type="submit"
            class="px-3 py-1 bg-indigo-500 text-white rounded"
            disabled={!!actions.loading.signup}
          >
            Sign up
          </button>
        </form>
      </div>
    )
  }
})

```
