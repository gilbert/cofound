import { makeBaseDb } from 'cofound/backend'

import { APP_DB_FILE } from './env'

export type DbConn = ReturnType<typeof makeDb>
export const db: DbConn = makeDb(APP_DB_FILE)

export function makeDb(path: string) {
  const db = makeBaseDb(path)
  // Add additional setup here if/when needed
  return db
}
