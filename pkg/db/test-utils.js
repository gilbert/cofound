import { makeDb } from './index.js'

// ---------------------------------------------------------------------------
// Seeded random (for deterministic test ID offsets)
// ---------------------------------------------------------------------------

function makeRandom(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x9e3779b9) | 0
    let t = seed ^ (seed >>> 16)
    t = Math.imul(t, 0x21f0aaad)
    t = t ^ (t >>> 15)
    t = Math.imul(t, 0x735a2d97)
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296
  }
}

const seed = +process.env.TEST_SEED || Math.floor(Math.random() * 800) + 120
const seededRandom = makeRandom(seed)
const seededRandomInt = (min, max) =>
  Math.floor(seededRandom() * (max - min + 1)) + min

// ---------------------------------------------------------------------------
// ID randomizer — offsets auto-increment IDs per table to prevent
// order-dependent test failures
// ---------------------------------------------------------------------------

/**
 * Mutates the db object, adding `randomizeIdsForTesting`.
 * Only active when NODE_ENV=test.
 */
export function useIdRandomizer(db) {
  const tableIdStarts = new Map()

  db.randomizeIdsForTesting = function randomizeIdsForTesting(table, id) {
    if (process.env.NODE_ENV !== 'test') return id
    if (tableIdStarts.has(table)) return id

    let start
    do {
      start = seededRandomInt(1, 1000) * 500
    } while ([...tableIdStarts.values()].includes(start))

    // SQLite chooses next rowid based on the largest rowid in the table.
    // After this update, the next rows will start incrementing from this point.
    db.exec(`UPDATE ${table} SET id = id + ${start}`)
    tableIdStarts.set(table, start)
    return id + start
  }

  return db
}

// ---------------------------------------------------------------------------
// Test DB factory
// ---------------------------------------------------------------------------

export function makeTestDb() {
  const db = makeDb(':memory:')
  useIdRandomizer(db)
  return db
}
