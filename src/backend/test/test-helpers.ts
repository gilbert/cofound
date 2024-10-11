import o from 'ospec'

import { ErrResult, OkResult, Result } from '../../shared/result'
import { makeBaseDb } from '../db/make-db'
import { migrateAppDatabase } from '../db/migrations'
import { SchemaDef, SchemaExtra } from '../db/schema'
import { makeRuntime } from '../runtime'

export const TEST_SEED = process.env.TEST_SEED || Math.floor(Math.random() * 800) + 120
console.log('Using seed', TEST_SEED)

export type CF_TestRuntime = ReturnType<typeof cf_makeTestRuntime>

const globalTestDb = makeBaseDb(':memory:')
let hasMigrated = false

export type CF_TestEnv = {
  name: string
}
export function cf_makeTestRuntime<Schema extends SchemaDef, Models>(params: {
  env: CF_TestEnv
  models: Models
  schema: Schema
  schemaExtra: SchemaExtra<Schema>

  fresh?: boolean
  jobQueueConcurrency?: number
}) {
  const { env, schema, schemaExtra, models } = params
  const db = params.fresh ? makeBaseDb(':memory:') : globalTestDb
  if (params.fresh || !hasMigrated) {
    migrateAppDatabase({ db, env, schema, schemaExtra })
    if (!params.fresh) hasMigrated = true
  }
  return makeRuntime(db, models, env)
}

export function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}

export function assertOk<T>(result: Result<T>): asserts result is OkResult<T> {
  if (!result.ok) {
    throw new Error(`Expected Ok, got Err: ${JSON.stringify(result)}`)
  }
  o(result.ok).equals(true) // Add assertion just to make test numbers more accurate
}

export function assertNotOk<E extends ErrResult>(result: OkResult<any> | E): asserts result is E {
  if (result.ok) {
    throw new Error(`Expected Err, got Ok: ${JSON.stringify(result)}`)
  }
  o(result.ok).equals(false) // Add assertion just to make test numbers more accurate
}
