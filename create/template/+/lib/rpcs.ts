//
// Every app will inevitably differ when it comes to RPC context.
// That's why Cofound puts this file and other rpc files in your app's /lib folder.
//
// You'll only need to update this file if you're including pods in your app.
//
import { MakeRpcTypes } from 'cofound'

import { OtpAuthPod, PasskeyPod } from '../pods'
import * as Procs from '../rpcs'
import { AppRpcCtx, RpcDef } from './rpc-context'

/**
 * All RPCs defined on the server, exported as a lookup object.
 */
const allRpcsTyped = {
  ...Procs,
  // TODO: Make this better (aggregate at composePods site)
  ...OtpAuthPod.makeRpcs<AppRpcCtx>(),
  ...PasskeyPod.makeRpcs<AppRpcCtx>(),
}
export type RpcTypes = MakeRpcTypes<typeof allRpcsTyped>

/**
 * Export generically for rpc-router
 */
export const rpcByName: Record<string, RpcDef> = allRpcsTyped
