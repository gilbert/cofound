import { ClientActions, cc } from 'cofound/frontend'
import { getNewPasskeyAttestation } from 'cofound/frontend/pods/passkey'
import { ok } from 'cofound/result'
import s from 'sin'

import { Layout } from '../../Layout'
import { getBrowserSession } from '../../lib/browser-session'
import { client } from '../../lib/rpc-client'
import { routes } from '../../routes'

type Attrs = {}
export const ConnectPasskeyPage = cc<Attrs>(function () {
  if (getBrowserSession()!.user.hasPasskey) {
    routes.dashboard.replace()
    return null
  }

  const actions = ClientActions({
    async connect() {
      const sess = getBrowserSession()!

      const res1 = await client.rpc_getNewPasskeyOptions({ email: sess.user.email })
      if (!res1.ok) return res1

      const res2 = await getNewPasskeyAttestation('e475013754', res1.value)
      if (!res2.ok) return res2

      const res3 = await client.rpc_connectNewPasskey({ attestation: res2.value })
      if (!res3.ok) return res3

      routes.auth.connect.success.replace()
      return ok({})
    },
  })

  return ({}) => (
    <Layout>
      <h1>Create Passkey</h1>

      {actions.error.any && (
        <div class="bg-red-100 border border-red-300">
          {actions.error.any.reason} ({actions.error.any.code})
        </div>
      )}

      <div class="mt-2 p-4 pb-2 border max-w-sm flex flex-col gap-4">
        {this.ctx.route({
          '/': () => (
            <>
              <p class="text-sm">
                You're all signed up! Now create a passkey so you can sign in without emails:
              </p>
              <div class="flex flex-col gap-2">
                <button onclick={actions.connect} class="px-3 py-1 bg-indigo-500 text-white rounded">
                  Create Passkey
                </button>
                <button onclick={routes.dashboard.visit} class="px-3 py-1 hover:bg-gray-100">
                  Skip for now
                </button>
              </div>
            </>
          ),

          '/success': () => (
            <>
              <p class="text-sm">Success! You can now sign in with your passkey.</p>
              <button onclick={routes.dashboard.replace} class="px-3 py-1 bg-indigo-500 text-white rounded">
                Continue to dashboard
              </button>
            </>
          ),
        })}
      </div>
    </Layout>
  )
})
