import { ErrResult, OkResult, Result } from '../result'

export type MakeRpcTypes<
  AllRpcsTyped extends Record<string, { run: (...args: any[]) => Promise<Result<any, any>> }>,
> = RpcHelpers<{
  [K in keyof AllRpcsTyped]: OmitThisParameter<AllRpcsTyped[K]['run']>
}>

/**
 * Helper types to get the parameters and return types of an RPC
 */
type RpcHelpers<Rpcs> = {
  Rpcs: Rpcs
  Params: {
    [K in keyof Rpcs]: {
      params: Rpcs[K] extends (args: infer P) => any ? P : never
    }
  }
  Results: {
    [K in keyof Rpcs]: Rpcs[K] extends (args: any) => Promise<infer R> ? R : never
  }
  Oks: {
    [K in keyof Rpcs]: Rpcs[K] extends (args: any) => Promise<infer R>
      ? R extends OkResult
        ? R
        : never
      : never
  }
  Errs: {
    [K in keyof Rpcs]: Rpcs[K] extends (args: any) => Promise<infer R>
      ? R extends ErrResult
        ? R
        : never
      : never
  }
  Values: {
    [K in keyof Rpcs]: Rpcs[K] extends (args: any) => Promise<infer R>
      ? R extends OkResult
        ? R['value']
        : never
      : never
  }
}
