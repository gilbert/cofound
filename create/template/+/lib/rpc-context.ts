//
// Every app will inevitably differ when it comes to RPC context.
// That's why Cofound puts this file and rpc-router.ts in your app's /lib folder.
// As you need more context in your RPCs, you can add it below.
//
import { BaseRpcCtx, makeRpcDefiner } from 'cofound/backend'
import { z } from 'zod'

import { AnonSessionData, AppRuntime, SessionData } from './app-runtime'

export { z }

//
// All fields accessible via `this` within an rpc's execute function.
// Add your own fields here as needed, though do so sparingly.
// This is probably the only spot in this file you might need to edit.
//
export type AppRpcCtx = BaseRpcCtx<AppRuntime, SessionData, AnonSessionData>

type MakeRpcCtxParams = Pick<AppRpcCtx, 'r' | 'session' | 'httpSession'> & {
  runtime: AppRuntime
}
export function makeProcCtx(params: MakeRpcCtxParams): AppRpcCtx {
  return {
    ...params,
    get: params.runtime.get,
    models: params.runtime.models,
    jobQueue: params.runtime.jobQueue,
  }
}

//
// Rpc definition function.
//
export type RpcDef = ReturnType<typeof rpc>
export const rpc = makeRpcDefiner<AppRpcCtx>()
