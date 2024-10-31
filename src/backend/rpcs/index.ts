import { z } from 'zod'

import { ErrResult, Result } from '../../result'
import { SinRequest } from '../../types/sin-types'
import { HttpSession } from '../http/http-session'
import { CF_Runtime } from '../runtime'

export type BaseRpcCtx<
  AppRuntime extends CF_Runtime<any>,
  SessionData = {},
  AnonSessionData = {},
> = {
  r: SinRequest
  get: AppRuntime['get']
  models: AppRuntime['models']
  /** WARNING: Using this in a public_ rpc will break at runtime */
  session: SessionData & { user_id: number }
  jobQueue: AppRuntime['jobQueue']
  httpSession: HttpSession<AnonSessionData, SessionData>
}

export function makeRpcDefiner<ProcCtx extends BaseRpcCtx<any, any, any>>() {
  return function rpc<Params extends z.ZodTypeAny, Return extends Result>(
    schema: Params,
    run: (this: ProcCtx, args: z.infer<Params>) => Promise<Return>,
  ) {
    return {
      schema,
      run: run as (
        this: ProcCtx,
        args: z.infer<Params>,
      ) => Promise<Return | ErrResult<'unexpected'>>,
    }
  }
}
