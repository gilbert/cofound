import s from 'sin'

import { ErrResult, Result, err } from '../result'

/**
 *
 * Defines a set of UI actions.
 *
 * Handles loading and error states.
 *
 * Example usage:
 * const actions = ClientActions({
 *  async getPasskeys() {
 *   return await client.rpc_getPasskeys({})
 *  },
 *   async deletePasskey(id: string) {
 *    return await client.rpc_deletePasskey({ id })
 *   },
 * })
 *
 * actions.loading //=> 'getPasskeys' | 'deletePasskey' | null
 * actions.error //=> ErrResult | undefined
 * actions.getPasskeys() //=> Promise<Result<Passkey[]>>
 */
export function ClientActions<T extends Record<string, (...args: any) => Promise<Result<any>>>>(
  actions: T,
): T & {
  loading: {
    [K in keyof T]: (Parameters<T[K]>[0] extends {} ? Parameters<T[K]>[0] : {}) | undefined
  } & { any: boolean }
  error: {
    [K in keyof T]: T[K] extends (args: any) => Promise<infer R>
      ? R extends ErrResult
        ? R
        : never
      : never
  } & {
    clear(): void
    any:
      | undefined
      | (T[keyof T] extends (...args: any[]) => Promise<infer U>
          ? U extends ErrResult
            ? U
            : never
          : never)
  }
} {
  let loading: Record<any, any> = {
    get any() {
      for (let key in loading) {
        if (key !== 'any' && loading[key]) return true
      }
    },
  }
  let errors: Record<any, any> = {
    get any() {
      for (let key in errors) {
        if (key in actions && errors[key]) return errors[key]
      }
    },
    clear() {
      for (let key in errors) {
        if (key in actions) errors[key] = undefined
      }
    },
  }

  return new Proxy(actions, {
    get(_target, prop) {
      if (prop === 'loading') return loading
      if (prop === 'error') return errors
      if (!(prop in actions)) return undefined
      let p = prop as keyof T
      return async (...args: any) => {
        errors.clear()
        loading[p] = args[0] === undefined ? {} : args[0]
        try {
          const res = await actions[p]!(...args)
          loading[p] = undefined
          if (!res.ok && res.reason !== 'noop') {
            errors[p] = res
          }
          s.redraw()
          return res
        } catch (e) {
          errors[p] = err('unknown', 'e570582347c', { meta: { error: e } })
          console.log(`Error in ClientAction.${String(p)}:`, e)
          loading[p] = undefined
          s.redraw()
        }
      }
    },
  }) as any
}
