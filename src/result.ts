export type Result<T = any, Errs = any> = OkResult<T> | ErrResult<Errs>

export class OkResult<T = any> {
  ok: true = true
  code?: undefined
  meta?: undefined
  statusCode?: undefined
  reason?: undefined
  sensitive?: boolean
  constructor(public value: T) {}
  unwrap() {
    return this.value
  }
  unwrapMaybe() {
    return this.value
  }
  map<U>(fn: (value: T) => U): OkResult<U> {
    return new OkResult(fn(this.value))
  }
}

export class ErrResult<Errs = any, Meta extends ErrMeta = ErrMeta> {
  ok: false = false
  constructor(
    public reason: Errs,
    public code: string,
    public statusCode: number,
    public meta: Meta,
  ) {}
  unwrap(): never {
    throw new UnwrapError(this)
  }
  unwrapMaybe() {
    return undefined
  }
  map<U>(_fn: (value: any) => U): ErrResult<Errs, Meta> {
    return this
  }
}

export type ErrMeta = { cause?: Error; [other: string]: any }

export function ok<T>(value: T): OkResult<T> {
  return new OkResult(value)
}

ok.sensitive = function sensitive<T>(value: T): OkResult<T> {
  const res = new OkResult(value)
  res.sensitive = true
  return res
}

export function err<Errs extends string, Meta extends ErrMeta = ErrMeta>(
  reason: Errs,
  code: string,
  opts: { status?: number; meta?: Meta } = {},
): ErrResult<Errs, Meta> {
  const { status, meta } = opts
  return new ErrResult(reason, code, status || 400, meta || ({} as any))
}

err.catch = function catchToErr<T, Err extends string>(
  reason: Err,
  code: string,
  promise: Promise<T> | (() => Promise<T>),
): Promise<Result<T, Err>> {
  return (typeof promise === 'function' ? promise() : promise).then(ok, (cause) => {
    if (cause) console.error(reason, code, cause)
    return err(reason, code, { meta: { cause } })
  })
}

/**
 * Useful for the rarer times you want to expose the error message to the outside world
 * */
err.catchWithMessage = async function catchToErrWithMessage<T, Err extends string>(
  reason: Err,
  code: string,
  promise: Promise<T> | (() => Promise<T>),
): Promise<OkResult<T> | ErrResult<Err, { message?: string }>> {
  const result = await err.catch(reason, code, promise)
  if (result.ok) return result
  const cause = result.meta.cause
  return err(reason, code, {
    meta: { cause, message: cause?.message || undefined },
  })
}
export class UnwrapError extends Error {
  constructor(public result: ErrResult) {
    super(`ErrResult (${result.statusCode}/${result.code}: ${result.reason})`)
  }
}

//
// Type helpers
//
export type Errs<T> = T extends ErrResult ? T : never
export type AwaitedErrs<T> = T extends Promise<infer R> ? Errs<R> : Errs<T>
export type ErrsOf<T> = T extends (args: any) => infer R ? AwaitedErrs<R> : never
