import { ClientActions, ResultLoader, cc } from 'cofound/frontend'
import { getNewPasskeyAttestation } from 'cofound/frontend/pods/passkey'
import { formatDate } from 'cofound/shared/date-utils'
import { ok } from 'cofound/shared/result'
import s from 'sin'

import { Layout } from '../../Layout'
import { getBrowserSession } from '../../lib/browser-session'
import { client } from '../../lib/rpc-client'
import { routes } from '../../routes'

type Attrs = {}
export const PasskeySettingsPage = cc<Attrs>(function () {
  const passkeys = ResultLoader(() => client.rpc_getPasskeys({}))

  const actions = ClientActions({
    async createPasskey() {
      const sess = getBrowserSession()!
      const res1 = await client.rpc_getNewPasskeyOptions({ email: sess.user.email })
      if (!res1.ok) return res1

      const res2 = await getNewPasskeyAttestation('e475013754', res1.value)
      if (!res2.ok) return res2

      const res3 = await client.rpc_connectNewPasskey({ attestation: res2.value })
      if (!res3.ok) return res3

      await passkeys.reload()
      return ok({})
    },

    async deletePasskey(credential_id: string) {
      if (!confirm('Are you SURE you want to delete this passkey?')) return ok({})

      const res = await client.rpc_deletePasskey({ credential_id })
      if (!res.ok && res.reason !== 'no_such_passkey') return res

      await passkeys.reload()
      return ok({})
    },
  })

  return ({}) => {
    const e = actions.error.any
    return (
      <Layout>
        <h1>Passkey Settings</h1>

        <div class="mt-2 p-4 flex flex-col gap-4 border max-w-lg">
          <h1>Connected Passkeys</h1>
          {passkeys.loading && !passkeys.data && <p class="animate-spin">⏳</p>}
          {passkeys.error && <div>Error loading passkeys</div>}
          {passkeys.data && passkeys.data.length === 0 && <div>No passkeys found</div>}
          {passkeys.data?.length && (
            <div class="overflow-x-scroll">
              <table class="w-full text-left">
                <thead>
                  <tr>
                    <th>Created At</th>
                    <th>Credential Id</th>
                    <th>Device Type</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {passkeys.data.map((passkey) => (
                    <tr>
                      <td>{formatDate('yyyy-MM-dd HH:mm:ss', new Date(passkey.created_at))}</td>
                      <td>
                        <code class="inline-block w-[12ch] text-ellipsis overflow-hidden">
                          {passkey.credential_id}
                        </code>
                      </td>
                      <td>{passkey.device_type}</td>
                      <td>
                        <button
                          disabled={actions.loading.deletePasskey === passkey.credential_id}
                          onclick={() => actions.deletePasskey(passkey.credential_id)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {e && (
            <div class="bg-red-100 border border-red-300">
              {e.reason} ({e.code})
            </div>
          )}

          <div class="flex flex-col sm:flex-row justify-end gap-4">
            <button onclick={actions.createPasskey} class="px-3 py-1 bg-indigo-500 text-white rounded">
              Create New Passkey
            </button>
          </div>
        </div>
      </Layout>
    )
  }
})
