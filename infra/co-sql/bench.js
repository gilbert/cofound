import { performance } from 'node:perf_hooks'
import { parseSelect } from './index.js'

const DEFAULT_DURATION_MS = 1000
const WARMUP_MS = 250

const queries = [
  {
    name: 'single-table',
    sql: 'SELECT * FROM tasks',
  },
  {
    name: 'filtered-list',
    sql: `
      SELECT id, title, status
      FROM tasks
      WHERE status != @done AND priority >= @priority
      ORDER BY created_at DESC
      LIMIT @limit OFFSET @offset
    `,
  },
  {
    name: 'left-join',
    sql: `
      SELECT t.*, m.name AS assignee
      FROM tasks t
      LEFT JOIN team_members m ON t.assignee_id = m.id
      WHERE t.status != @done
      ORDER BY t.created_at DESC
    `,
  },
  {
    name: 'multi-join',
    sql: `
      SELECT t.id, t.title, m.name assignee, p.name project
      FROM tasks t
      JOIN team_members m ON t.assignee_id = m.id
      INNER JOIN projects p ON t.project_id = p.id
      WHERE (t.status IN (@todo, @doing) OR t.priority >= @priority)
        AND m.deleted_at IS NULL
      ORDER BY p.name ASC, t.created_at DESC
      LIMIT 100
    `,
  },
]

const durationMs = readDuration()
let sink = 0

for (const query of queries) {
  parseSelect(query.sql)
}

runMixed(WARMUP_MS)

const mixed = runMixed(durationMs)
sink += mixed.checksum
console.log('co-sql parser benchmark')
console.log('node:', process.version)
console.log('duration:', durationMs + 'ms')
console.log('')
console.log(formatRow('mixed corpus', mixed.iterations, mixed.elapsedMs))

for (const query of queries) {
  const result = runOne(query.sql, durationMs)
  sink += result.checksum
  console.log(formatRow(query.name, result.iterations, result.elapsedMs))
}

if (sink === 0) process.stdout.write('')

function runMixed(ms) {
  const start = performance.now()
  const end = start + ms
  let iterations = 0
  let checksum = 0

  while (performance.now() < end) {
    const query = queries[iterations % queries.length]
    checksum += consume(parseSelect(query.sql))
    iterations++
  }

  return { iterations, elapsedMs: performance.now() - start, checksum }
}

function runOne(sql, ms) {
  const start = performance.now()
  const end = start + ms
  let iterations = 0
  let checksum = 0

  while (performance.now() < end) {
    checksum += consume(parseSelect(sql))
    iterations++
  }

  return { iterations, elapsedMs: performance.now() - start, checksum }
}

function consume(result) {
  return result.tables.size + result.aliases.size + result.params.size
}

function formatRow(name, iterations, elapsedMs) {
  const perSecond = Math.round(iterations / (elapsedMs / 1000))
  return name.padEnd(14) + ' ' + perSecond.toLocaleString('en-US').padStart(12) + ' queries/sec'
}

function readDuration() {
  const raw = process.argv[2]
  if (raw == null) return DEFAULT_DURATION_MS

  const duration = Number(raw)
  if (!Number.isFinite(duration) || duration <= 0) {
    console.error('Usage: npm run bench -- [duration-ms]')
    process.exit(1)
  }

  return duration
}
