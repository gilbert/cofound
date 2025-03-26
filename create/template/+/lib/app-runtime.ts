import { CF_Runtime, makeRuntime, migrateAppDatabase } from 'cofound/backend'

import { Models, makeModels } from '../models'
import { PodsAnonSessionData, PodsSessionData } from '../pods'
import { schema } from '../schema'
import { db } from './db'
import { cofoundEnv as env } from './env'

let runtime: AppRuntime | undefined

export type AppRuntime = CF_Runtime<Models>
export function getAppRuntime(): AppRuntime {
  return (runtime ||= makeRuntime(db, makeModels(db), env))
}

export function checkMigrationStatus() {
  migrateAppDatabase({ db, env, schema, targetVersion: false })
}

//
// Session data definitions for authenticated and anonymous users.
// Add your own fields here as needed.
//
export type SessionData = PodsSessionData & {}
export type AnonSessionData = PodsAnonSessionData & {}
