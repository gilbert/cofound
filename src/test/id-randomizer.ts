import { SQLiteDatabase } from 'better-sqlite3'

import { seededRandomInt } from './index'

export type IdRandomizer = {
  randomizeIdsForTesting: (table: string, id: number) => number
}

/** WARNING: Mutates db object! */
export function useIdRandomizer<T extends SQLiteDatabase>(db: T): T & IdRandomizer {
  const tableIdStarts = new Map<string, number>()
  return Object.assign(db, { randomizeIdsForTesting })

  /** Expected to be called after an insert */
  function randomizeIdsForTesting(table: string, id: number): number {
    if (process.env.NODE_ENV !== 'test') return id
    if (tableIdStarts.has(table)) {
      // Table has already been randomized
      return id
    }
    do {
      var start = seededRandomInt(1, 1000) * 500
    } while ([...tableIdStarts.values()].includes(start))

    // Sqlite chooses next rowid based on the largest rowid in the table
    // After this update, the next rows will start incrementing from this point on
    db.exec(`UPDATE ${table} SET id = id + ${start}`)
    tableIdStarts.set(table, start)
    return id + start
  }
}
