import type { RpcTypes } from '../+/lib/rpcs'

/**
 * All RPCs defined on the server in one type
 */
export type Rpcs = RpcTypes['Rpcs']

/**
 * Convenience types to get the parameters and return types of an RPC
 */
export type Params = RpcTypes['Params']
export type Results = RpcTypes['Results']
export type Oks = RpcTypes['Oks']
export type Errs = RpcTypes['Errs']
export type Values = RpcTypes['Values']
