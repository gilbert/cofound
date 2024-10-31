//
// Every app will inevitably differ when it comes to RPC context.
// That's why Cofound puts this file in your app's frontend/lib folder.
// Update this file as you need to update the auth logic for your RPCs.
//
import { ErrResult, OkResult, err } from 'cofound/result'

import type { Rpcs } from '../../shared/app-types'
import { routes } from '../routes'
import { logError } from './errors'
import { APP_NAME } from './frontend-env'

export const client = makeRpcClient()

export * from 'cofound/result'

export type { Params, Results, Oks, Errs, Values } from '../../shared/app-types'

export type Unexpected = ErrResult<'unexpected'>

function makeRpcClient(): Rpcs {
  return new Proxy(
    {},
    {
      get(_, procName) {
        if (typeof procName === 'symbol') return
        return async (argsObject: any) => {
          if (!procName.startsWith('rpc_') && !procName.startsWith('public_rpc_')) {
            throw new Error(`[rpc] Invalid procName: ${procName}`)
          }

          const res = await fetch(`/rpc/${procName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'Cache-Control': 'no-cache',
              'X-Rpc-From': APP_NAME,
            },
            body: JSON.stringify({
              args: argsObject,
            }),
            credentials: 'include',
          })
          const rawBody = await res.text()

          if (res.status === 401 && rawBody === 'not_signed_in') {
            routes.auth.login.visit()
          }

          try {
            var body = JSON.parse(rawBody)
          } catch (e) {
            // RPCs are always expected to return JSON
            // If not, something went very wrong
            const error = new Error(`[rpc] Failed to parse body: ${JSON.stringify(rawBody)}`)
            console.error(error)
            logError(error)
            body = err('unexpected', 'rpc-client-1', { status: 500 })
          }

          if (res.status === 500 && body.code !== 'rpc-client-1') {
            logError(new Error(`[rpc] Server error: ${rawBody}`))
          }
          // Wrap in instance of Result
          return body.ok
            ? new OkResult(body.value)
            : new ErrResult(body.reason, body.code, body.statusCode, body.meta)
        }
      },
    },
  ) as any
}
