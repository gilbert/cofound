//
// Every app will inevitably differ when it comes to RPC context.
// That's why Cofound puts this file and other rpc files in your app's /lib folder.
// As you need to update the auth logic for your RPCs, feel free to add it below.
//
import { HttpSession, SinRequest } from 'cofound/backend'
import { err } from 'cofound/result'

import { AppRuntime, getAppRuntime } from './app-runtime'
import { CORS } from './cors'
import { APP_NAME, SESSION_SECRET, env } from './env'
import { makeProcCtx } from './rpc-context'
import { RpcTypes, rpcByName } from './rpcs'

const USER_RPC_ENDPOINT = new RegExp('^/rpc/(rpc_[a-zA-Z0-9_]+)$')
const PUBLIC_RPC_ENDPOINT = new RegExp('^/rpc/(public_rpc_[a-zA-Z0-9_]+)$')

export function makeRpcRouter() {
  return rpcRouter.bind(null, getAppRuntime())
}

const rpcRouter = async (runtime: AppRuntime, r: SinRequest) => {
  if (r.method.toUpperCase() === 'OPTIONS') {
    return r.statusEnd(200, CORS)
  } else if (r.method.toUpperCase() !== 'POST') {
    return r.statusEnd(404)
  }

  // Mutually exclusive
  const userMatch = r.pathname.match(USER_RPC_ENDPOINT)
  const publicMatch = r.pathname.match(PUBLIC_RPC_ENDPOINT)

  const procName = userMatch?.[1] || publicMatch?.[1]
  const proc = procName && rpcByName.hasOwnProperty(procName) && rpcByName[procName]
  if (!proc) {
    return r.status(404).end(JSON.stringify(err('proc_not_found', 'rr404', { status: 404 })))
  }

  const httpSession = new HttpSession<any, any>(runtime.models.Session, r, {
    anonCookieName: `${APP_NAME}-anon`,
    userCookieName: `${APP_NAME}-sess`,
    sessionSecret: SESSION_SECRET,
  })
  const session = await httpSession.get()
  if (userMatch && !session) {
    return r.status(401).end(JSON.stringify(err('unauthorized', 'e401', { status: 401 })))
  }

  const dirtyArgs = await r.body('json')
  const argsResult = proc.schema.safeParse((dirtyArgs as any).args)

  if (!argsResult.success) {
    const error = err('unexpected', 'e400', {
      status: 400,
      meta: { issues: argsResult.error.issues },
    })
    return r.end(JSON.stringify(error), 400, jsonCORS)
  }

  const ctx = makeProcCtx({ r, runtime, session, httpSession })

  const argsDebug = Object.keys(argsResult.data)
  if (!excludeRpcLogs.includes(procName)) {
    console.log(`[rpc] ${procName}({ ${argsDebug.join(', ')} })`)
  }

  try {
    var result = await proc.run.call(ctx, argsResult.data)
  } catch (cause: any) {
    if (env.name === 'development') {
      console.error(cause)
    }
    result = err(env.name === 'development' ? cause.message : 'unexpected', 'e500', {
      status: 500,
    })
  }

  if (!result.ok && result.meta.cause) {
    // Log error but don't expose to client
    console.error(result.reason, result.code, result.meta.cause, result.meta.cause.stack)
    delete result.meta.cause
  }

  const resultStr = JSON.stringify(result)
  if (!excludeRpcLogs.includes(procName)) {
    console.log('=>', resultStr.slice(0, 100) + (resultStr.length > 100 ? '...' : ''))
  }

  return r.end(resultStr, result.ok ? 200 : result.statusCode, jsonCORS)
}
const jsonType = { 'Content-Type': 'application/json' }
const jsonCORS = { ...CORS, ...jsonType }

const excludeRpcLogs: string[] = [
  // Add rpc names here to exclude them from being logged.
  // Useful for rpcs that are called frequently.
  // e.g.
  // 'rpc_myRpcName',
] satisfies (keyof RpcTypes['Rpcs'])[]
