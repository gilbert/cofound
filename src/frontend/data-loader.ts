import s from 'sin'

import { ErrResult, OkResult } from '../shared/result'

export function DataLoader<T>(fn: () => Promise<T>) {
  let data: T
  let error: any
  let loading = true

  const handle = {
    get data() {
      if (loading || error) return undefined
      return data
    },
    get error() {
      return error
    },
    get loading() {
      return loading
    },

    reload() {
      return fn()
        .then(
          (res) => {
            data = res
            loading = false
          },
          (err) => {
            error = err
            loading = false
          },
        )
        .finally(() => s.redraw())
    },
  }
  handle.reload()
  return handle
}

export function ResultLoader<T extends OkResult<any> | ErrResult<any>>(fn: () => Promise<T>) {
  const loader = DataLoader(fn)
  return {
    get data() {
      if (loader.data?.ok) {
        return loader.data.value as T extends OkResult<infer U> ? U : never
      }
      return undefined
    },
    get error() {
      if (loader.data && !loader.data.ok) {
        return loader.data as T extends ErrResult<any> ? T : never
      }
      return undefined
    },
    get loading() {
      return loader.loading
    },
    reload() {
      return loader.reload()
    },
  }
}
