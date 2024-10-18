import SQLite from 'better-sqlite3'

import { newUuidV4, newUuidV4Buffer } from '../../shared/buffer-utils'
import { useIdRandomizer } from '../../test/id-randomizer'

export type BaseDbConn = ReturnType<typeof makeBaseDb>

export function makeBaseDb(path: string) {
  const db = new SQLite(path)
  db.defaultSafeIntegers()
  db.prepare('PRAGMA journal_mode = wal').run()
  db.prepare('PRAGMA foreign_keys = ON').run()
  db.function('uuid_v4', () => newUuidV4())
  db.function('uuid_v4_binary', () => newUuidV4Buffer())
  return useIdRandomizer(db)
}
