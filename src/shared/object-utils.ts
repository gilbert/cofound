export const objectKeys: <T>(obj: T) => (keyof T)[] = Object.keys as any
export const objectEntries: <T>(obj: T) => [keyof T, T[keyof T]][] = Object.entries as any

export function mapKeys<T extends object, K extends string>(
  obj: T,
  callback: (key: keyof T) => K,
): Record<K, T[keyof T]> {
  return Object.keys(obj).reduce((result, key) => {
    const newKey = callback(key as keyof T)
    result[newKey] = obj[key as keyof T]
    return result
  }, {} as Record<K, T[keyof T]>)
}

export function pick<T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result: any = {}
  for (const key of keys) {
    result[key] = obj[key]
  }
  return result
}

export type Falsey = null | undefined | false | 0 | ''
export type NonFalsey<T> = T extends Falsey ? never : T

export function pickMaybe<T, K extends keyof NonFalsey<T>>(
  obj: T,
  keys: readonly K[],
): Pick<NonFalsey<T>, K> | (T extends Falsey ? null : never) {
  if (!obj) return null as any
  return (pick as any)(obj, keys)
}

export function deepEqualBasic(a: any, b: any): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  const keys1 = Object.keys(a)
  const keys2 = Object.keys(b)
  if (keys1.length !== keys2.length) return false
  for (const key of keys1) {
    if (!b.hasOwnProperty(key) || !deepEqualBasic(a[key], b[key])) return false
  }
  return true
}

export function cloneUpdate<T>(baseState: T, mutator: (draft: T) => void): T {
  const draft = structuredClone(baseState)
  mutator(draft)
  return draft
}

// Stringify, but handle values that would normally throw an error
export function stringifyDebug(obj: any): string {
  try {
    return JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  } catch (err) {
    console.log('Error stringifying', err)
    return `{error-stringifying}`
  }
}

//
// Taken from https://github.com/kysely-org/kysely/blob/deea8e22aae3dc4e142f055b6ec4d9a50a402bda/src/util/object-utils.ts
//
export function isEmpty(obj: ArrayLike<unknown> | string | object): boolean {
  if (Array.isArray(obj) || isString(obj) || isBuffer(obj)) {
    return obj.length === 0
  } else if (obj) {
    return Object.keys(obj).length === 0
  }

  return false
}

export function isUndefined(obj: unknown): obj is undefined {
  return typeof obj === 'undefined' || obj === undefined
}

export function isString(obj: unknown): obj is string {
  return typeof obj === 'string'
}

export function isNumber(obj: unknown): obj is number {
  return typeof obj === 'number'
}

export function isBoolean(obj: unknown): obj is boolean {
  return typeof obj === 'boolean'
}

export function isNull(obj: unknown): obj is null {
  return obj === null
}

export function isDate(obj: unknown): obj is Date {
  return obj instanceof Date
}

export function isBigInt(obj: unknown): obj is bigint {
  return typeof obj === 'bigint'
}

// Don't change the returnd type to `obj is Buffer` to not create a
// hard dependency to node.
export function isBuffer(obj: unknown): obj is { length: number } {
  return typeof Buffer !== 'undefined' && Buffer.isBuffer(obj)
}

export function isFunction(obj: unknown): obj is Function {
  return typeof obj === 'function'
}

export function isObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null
}

export function isArrayBufferOrView(obj: unknown): obj is ArrayBuffer | ArrayBufferView {
  return obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)
}

export function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return (
    isObject(obj) &&
    !Array.isArray(obj) &&
    !isDate(obj) &&
    !isBuffer(obj) &&
    !isArrayBufferOrView(obj)
  )
}

export function getLast<T>(arr: ArrayLike<T>): T | undefined {
  return arr[arr.length - 1]
}

export function freeze<T>(obj: T): Readonly<T> {
  return Object.freeze(obj)
}

export function asArray<T>(arg: T | ReadonlyArray<T>): ReadonlyArray<T> {
  if (isReadonlyArray(arg)) {
    return arg
  } else {
    return [arg]
  }
}

export function asReadonlyArray<T>(arg: T | ReadonlyArray<T>): ReadonlyArray<T> {
  if (isReadonlyArray(arg)) {
    return arg
  } else {
    return freeze([arg])
  }
}

export function isReadonlyArray(arg: unknown): arg is ReadonlyArray<unknown> {
  return Array.isArray(arg)
}

export function noop<T>(obj: T): T {
  return obj
}

export function compare(obj1: unknown, obj2: unknown): boolean {
  if (isReadonlyArray(obj1) && isReadonlyArray(obj2)) {
    return compareArrays(obj1, obj2)
  } else if (isObject(obj1) && isObject(obj2)) {
    return compareObjects(obj1, obj2)
  }

  return obj1 === obj2
}

function compareArrays(arr1: ReadonlyArray<unknown>, arr2: ReadonlyArray<unknown>): boolean {
  if (arr1.length !== arr2.length) {
    return false
  }

  for (let i = 0; i < arr1.length; ++i) {
    if (!compare(arr1[i], arr2[i])) {
      return false
    }
  }

  return true
}

function compareObjects(obj1: Record<string, unknown>, obj2: Record<string, unknown>): boolean {
  if (isBuffer(obj1) && isBuffer(obj2)) {
    return compareBuffers(obj1, obj2)
  } else if (isDate(obj1) && isDate(obj2)) {
    return compareDates(obj1, obj2)
  }

  return compareGenericObjects(obj1, obj2)
}

function compareBuffers(buf1: unknown, buf2: unknown): boolean {
  return Buffer.compare(buf1 as any, buf2 as any) === 0
}

function compareDates(date1: Date, date2: Date) {
  return date1.getTime() === date2.getTime()
}

function compareGenericObjects(
  obj1: Record<string, unknown>,
  obj2: Record<string, unknown>,
): boolean {
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) {
    return false
  }

  for (const key of keys1) {
    if (!compare(obj1[key], obj2[key])) {
      return false
    }
  }

  return true
}
