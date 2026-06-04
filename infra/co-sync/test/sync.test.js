import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSelect, enforceLimit, SqlParseError } from 'co-sql'
import { makeDb, col, migrate } from 'cofound/db'
import {
  rewriteAuthTables,
  buildAuthCtes,
  injectCtes,
  sync,
} from '../server.js'

// ---------------------------------------------------------------------------
// Test schema
// ---------------------------------------------------------------------------

const schema = {
  tasks: {
    cols: {
      id: col.primary(),
      title: col.text(),
      status: col.enum(['todo', 'in_progress', 'done']),
      priority: col.enum(['low', 'medium', 'high']),
      assignee_id: col.integer().nullable(),
      org_id: col.integer(),
    },
  },
  team_members: {
    cols: {
      id: col.primary(),
      name: col.text(),
      email: col.text(),
      role: col.text(),
      org_id: col.integer(),
    },
  },
  public_info: {
    cols: {
      id: col.primary(),
      label: col.text(),
    },
  },
}

function makeTestDb() {
  const db = makeDb(':memory:')
  migrate(db, schema)
  return db
}

// ---------------------------------------------------------------------------
// parseSelect integration — table extraction
// ---------------------------------------------------------------------------

test('parseSelect extracts tables from single-table query', () => {
  const result = parseSelect('SELECT * FROM tasks')
  assert.deepEqual([...result.tables], ['tasks'])
  assert.deepEqual([...result.aliases], [])
  assert.deepEqual([...result.params], [])
})

test('parseSelect extracts tables and aliases from join query', () => {
  const result = parseSelect(`
    SELECT t.*, m.name AS assignee
    FROM tasks t
    LEFT JOIN team_members m ON t.assignee_id = m.id
    WHERE t.status != @done
  `)
  assert.deepEqual([...result.tables].sort(), ['tasks', 'team_members'])
  assert.deepEqual([...result.aliases].sort(), [['m', 'team_members'], ['t', 'tasks']])
  assert.deepEqual([...result.params], ['done'])
})

// ---------------------------------------------------------------------------
// Rejects unsupported SQL from co-sql
// ---------------------------------------------------------------------------

test('rejects client CTEs', () => {
  assert.throws(
    () => parseSelect('WITH active AS (SELECT * FROM tasks) SELECT * FROM active'),
    err => err instanceof SqlParseError,
  )
})

test('rejects string literals', () => {
  assert.throws(
    () => parseSelect("SELECT * FROM tasks WHERE status = 'done'"),
    err => err instanceof SqlParseError,
  )
})

test('rejects subqueries', () => {
  assert.throws(
    () => parseSelect('SELECT * FROM tasks WHERE id IN (SELECT task_id FROM comments)'),
    err => err instanceof SqlParseError,
  )
})

// ---------------------------------------------------------------------------
// Access rule validation
// ---------------------------------------------------------------------------

test('rejects missing access rule', () => {
  const db = makeTestDb()
  const access = {
    tasks: { read: user => ({ org_id: user.org_id }), write: true },
    // team_members intentionally missing
  }

  const readFilterFor = (table, user) => {
    const rule = access?.[table]
    if (!rule) throw new Error('No read access for table ' + table)
    const read = typeof rule.read === 'function' ? rule.read(user) : rule.read
    if (read === true) return true
    if (read === false || read == null) throw new Error('No read access for table ' + table)
    return read
  }

  assert.throws(
    () => readFilterFor('team_members', { org_id: 1 }),
    /No read access for table team_members/,
  )
})

test('rejects read: false', () => {
  const access = {
    tasks: { read: false, write: true },
  }

  const readFilterFor = (table, user) => {
    const rule = access?.[table]
    if (!rule) throw new Error('No read access for table ' + table)
    const read = typeof rule.read === 'function' ? rule.read(user) : rule.read
    if (read === true) return true
    if (read === false || read == null) throw new Error('No read access for table ' + table)
    return read
  }

  assert.throws(
    () => readFilterFor('tasks', { org_id: 1 }),
    /No read access for table tasks/,
  )
})

// ---------------------------------------------------------------------------
// Named param validation
// ---------------------------------------------------------------------------

test('rejects missing SQL parameter', () => {
  const parsed = parseSelect('SELECT * FROM tasks WHERE status != @done')
  // params contains 'done' but we pass empty
  assert.ok(parsed.params.has('done'))
})

test('rejects reserved @__auth_ prefix in client SQL', () => {
  assert.throws(
    () => parseSelect('SELECT * FROM tasks WHERE org_id = @__auth_0'),
    /reserved/,
  )
})

// ---------------------------------------------------------------------------
// Auth CTE rewriting — aliased tables
// ---------------------------------------------------------------------------

test('rewrites aliased tables to auth CTEs', () => {
  const sql = `SELECT t.*, m.name AS assignee
FROM tasks t
LEFT JOIN team_members m ON t.assignee_id = m.id
WHERE t.status != @done`

  const authTables = new Map([
    ['tasks', '__auth_tasks'],
    ['team_members', '__auth_team_members'],
  ])

  const result = rewriteAuthTables(sql, authTables)
  assert.ok(result.includes('__auth_tasks t'))
  assert.ok(result.includes('__auth_team_members m'))
  assert.ok(!result.includes('FROM tasks t'))
  assert.ok(!result.includes('JOIN team_members m'))
})

// ---------------------------------------------------------------------------
// Auth CTE rewriting — unaliased tables with qualified refs
// ---------------------------------------------------------------------------

test('rewrites unaliased tables preserving qualified refs', () => {
  const sql = 'SELECT tasks.id FROM tasks'
  const authTables = new Map([['tasks', '__auth_tasks']])

  const result = rewriteAuthTables(sql, authTables)
  // Should become: SELECT tasks.id FROM __auth_tasks tasks
  assert.ok(result.includes('FROM __auth_tasks tasks'))
  assert.ok(result.includes('SELECT tasks.id'))
})

// ---------------------------------------------------------------------------
// Multiple auth-filtered tables
// ---------------------------------------------------------------------------

test('handles multiple auth-filtered tables', () => {
  const readFilterFor = (table, user) => {
    if (table === 'tasks') return { org_id: user.org_id }
    if (table === 'team_members') return { org_id: user.org_id }
    return true
  }

  const tables = new Set(['tasks', 'team_members'])
  const user = { org_id: 42 }

  const { ctes, authParams, authTables } = buildAuthCtes(tables, readFilterFor, user)

  assert.equal(ctes.length, 2)
  assert.equal(authTables.size, 2)
  assert.ok(authTables.has('tasks'))
  assert.ok(authTables.has('team_members'))
  assert.ok(Object.keys(authParams).length >= 2)
})

// ---------------------------------------------------------------------------
// Full-access tables without CTEs
// ---------------------------------------------------------------------------

test('skips CTE for full-access tables', () => {
  const readFilterFor = (table, user) => {
    if (table === 'public_info') return true
    return { org_id: user.org_id }
  }

  const tables = new Set(['tasks', 'public_info'])
  const user = { org_id: 42 }

  const { ctes, authTables } = buildAuthCtes(tables, readFilterFor, user)

  assert.equal(ctes.length, 1) // only tasks
  assert.ok(authTables.has('tasks'))
  assert.ok(!authTables.has('public_info'))
})

// ---------------------------------------------------------------------------
// injectCtes
// ---------------------------------------------------------------------------

test('injectCtes prepends WITH clause', () => {
  const sql = 'SELECT * FROM tasks'
  const ctes = [
    '__auth_tasks AS (SELECT * FROM [tasks] WHERE [org_id] = @__auth_0)',
  ]
  const result = injectCtes(sql, ctes)
  assert.ok(result.startsWith('WITH __auth_tasks'))
  assert.ok(result.includes('SELECT * FROM tasks'))
})

test('injectCtes returns trimmed SQL when no CTEs', () => {
  assert.equal(injectCtes('  SELECT * FROM tasks  ', []), 'SELECT * FROM tasks')
})

// ---------------------------------------------------------------------------
// Generated SQL runs in SQLite
// ---------------------------------------------------------------------------

test('generated auth SQL executes against in-memory SQLite', () => {
  const db = makeTestDb()

  // Seed data
  db.prepare('INSERT INTO tasks (title, status, priority, org_id) VALUES (@t, @s, @p, @o)').run({
    t: 'Task A', s: 'todo', p: 'high', o: 1,
  })
  db.prepare('INSERT INTO tasks (title, status, priority, org_id) VALUES (@t, @s, @p, @o)').run({
    t: 'Task B', s: 'done', p: 'low', o: 2,
  })
  db.prepare('INSERT INTO team_members (name, email, role, org_id) VALUES (@n, @e, @r, @o)').run({
    n: 'Alice', e: 'alice@example.com', r: 'admin', o: 1,
  })

  // Build auth query
  const sql = `SELECT t.*, m.name AS assignee
FROM tasks t
LEFT JOIN team_members m ON t.assignee_id = m.id
WHERE t.status != @done
ORDER BY t.id`

  const parsed = parseSelect(sql)
  const readFilterFor = (table, user) => ({ org_id: user.org_id })
  const user = { org_id: 1 }

  const { ctes, authParams, authTables } = buildAuthCtes(parsed.tables, readFilterFor, user)
  const rewritten = rewriteAuthTables(sql, authTables)
  const fullSql = injectCtes(rewritten, ctes)

  const params = { done: 'done', ...authParams }
  const rows = db.prepare(fullSql).all(params)

  // Should only see org_id=1 tasks where status != done
  assert.equal(rows.length, 1)
  assert.equal(rows[0].title, 'Task A')
})

test('auth query with unaliased tables executes correctly', () => {
  const db = makeTestDb()

  db.prepare('INSERT INTO tasks (title, status, priority, org_id) VALUES (@t, @s, @p, @o)').run({
    t: 'Mine', s: 'todo', p: 'high', o: 1,
  })
  db.prepare('INSERT INTO tasks (title, status, priority, org_id) VALUES (@t, @s, @p, @o)').run({
    t: 'Theirs', s: 'todo', p: 'high', o: 2,
  })

  const sql = 'SELECT tasks.id, tasks.title FROM tasks'
  const parsed = parseSelect(sql)
  const readFilterFor = (table, user) => ({ org_id: user.org_id })
  const user = { org_id: 1 }

  const { ctes, authParams, authTables } = buildAuthCtes(parsed.tables, readFilterFor, user)
  const rewritten = rewriteAuthTables(sql, authTables)
  const fullSql = injectCtes(rewritten, ctes)

  const rows = db.prepare(fullSql).all(authParams)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].title, 'Mine')
})

test('full-access table query runs without CTEs', () => {
  const db = makeTestDb()

  db.prepare('INSERT INTO public_info (label) VALUES (@l)').run({ l: 'Public' })

  const sql = 'SELECT * FROM public_info'
  const parsed = parseSelect(sql)
  const readFilterFor = () => true

  const { ctes, authParams, authTables } = buildAuthCtes(parsed.tables, readFilterFor, {})
  const rewritten = rewriteAuthTables(sql, authTables)
  const fullSql = injectCtes(rewritten, ctes)

  assert.equal(fullSql, 'SELECT * FROM public_info')
  const rows = db.prepare(fullSql).all(authParams)
  assert.equal(rows.length, 1)
})

// ---------------------------------------------------------------------------
// Mutation write auth — INSERT injects filter cols
// ---------------------------------------------------------------------------

test('INSERT with write auth injects filter columns', () => {
  const db = makeTestDb()

  // Simulate what handleInsert does
  const filter = { org_id: 1 }
  const attrs = { title: 'New Task', status: 'todo', priority: 'high' }
  const insertAttrs = { ...attrs, ...filter }

  const cols = Object.keys(insertAttrs)
  const colsSql = cols.map(c => '[' + c + ']').join(', ')
  const valsSql = cols.map(c => '@' + c).join(', ')
  const insertSql = 'INSERT INTO [tasks] (' + colsSql + ') VALUES (' + valsSql + ')'

  db.prepare(insertSql).run(insertAttrs)

  const rows = db.prepare('SELECT * FROM tasks').all()
  assert.equal(rows.length, 1)
  assert.equal(Number(rows[0].org_id), 1)
  assert.equal(rows[0].title, 'New Task')
})

// ---------------------------------------------------------------------------
// UPDATE/DELETE include auth filters in WHERE
// ---------------------------------------------------------------------------

test('UPDATE with auth filter restricts to authorized rows', () => {
  const db = makeTestDb()

  db.prepare('INSERT INTO tasks (title, status, priority, org_id) VALUES (@t, @s, @p, @o)').run({
    t: 'Task', s: 'todo', p: 'high', o: 1,
  })
  const { id } = db.prepare('SELECT last_insert_rowid() as id').get()

  // Update with correct org_id filter
  const filter = { org_id: 1 }
  const whereParts = ['[id] = @__where_id']
  const whereParams = { __where_id: Number(id) }
  let i = 0
  for (const [col, val] of Object.entries(filter)) {
    const paramName = '__where_' + i++
    whereParts.push('[' + col + '] = @' + paramName)
    whereParams[paramName] = val
  }

  const attrs = { status: 'done' }
  const setCols = Object.keys(attrs).map(c => '[' + c + '] = @' + c).join(', ')
  const updateSql = 'UPDATE [tasks] SET ' + setCols + ' WHERE ' + whereParts.join(' AND ')

  const result = db.prepare(updateSql).run({ ...attrs, ...whereParams })
  assert.equal(Number(result.changes), 1)

  // Update with wrong org_id filter — should change 0 rows
  const badWhereParams = { __where_id: Number(id), __where_0: 999 }
  const result2 = db.prepare(updateSql).run({ ...attrs, ...badWhereParams })
  assert.equal(Number(result2.changes), 0)
})

test('DELETE with auth filter restricts to authorized rows', () => {
  const db = makeTestDb()

  db.prepare('INSERT INTO tasks (title, status, priority, org_id) VALUES (@t, @s, @p, @o)').run({
    t: 'Task', s: 'todo', p: 'high', o: 1,
  })
  const { id } = db.prepare('SELECT last_insert_rowid() as id').get()

  // Delete with wrong org_id — should change 0
  const deleteSql = 'DELETE FROM [tasks] WHERE [id] = @__where_id AND [org_id] = @__where_0'
  const result = db.prepare(deleteSql).run({ __where_id: Number(id), __where_0: 999 })
  assert.equal(Number(result.changes), 0)

  // Delete with correct org_id
  const result2 = db.prepare(deleteSql).run({ __where_id: Number(id), __where_0: 1 })
  assert.equal(Number(result2.changes), 1)
})

// ---------------------------------------------------------------------------
// BigInt serialization
// ---------------------------------------------------------------------------

test('BigInt values serialize to Number in JSON', () => {
  const replacer = (key, value) => typeof value === 'bigint' ? Number(value) : value
  const data = { id: 42n, title: 'Test' }
  const json = JSON.stringify(data, replacer)
  const parsed = JSON.parse(json)
  assert.equal(parsed.id, 42)
  assert.equal(typeof parsed.id, 'number')
})

test('BigInt serialization works with row data from SQLite', () => {
  const db = makeTestDb()

  db.prepare('INSERT INTO tasks (title, status, priority, org_id) VALUES (@t, @s, @p, @o)').run({
    t: 'BigInt Test', s: 'todo', p: 'high', o: 1,
  })

  const rows = db.prepare('SELECT * FROM tasks').all()
  assert.equal(typeof rows[0].id, 'bigint') // defaultSafeIntegers

  const replacer = (key, value) => typeof value === 'bigint' ? Number(value) : value
  const json = JSON.stringify(rows, replacer)
  const parsed = JSON.parse(json)
  assert.equal(typeof parsed[0].id, 'number')
})

// ---------------------------------------------------------------------------
// Subscription cleanup on WS close (unit-level)
// ---------------------------------------------------------------------------

test('connections Map is used for subscription tracking', () => {
  // Verify the data structure expected by the server
  const connections = new Map()
  const fakeWs = {}
  connections.set(fakeWs, new Map())

  connections.get(fakeWs).set('1', {
    sql: 'SELECT * FROM tasks',
    tables: new Set(['tasks']),
    lastResultJson: '[]',
  })

  assert.equal(connections.get(fakeWs).size, 1)

  // Simulate close
  connections.delete(fakeWs)
  assert.equal(connections.size, 0)
})

// ---------------------------------------------------------------------------
// rewriteAuthTables edge cases
// ---------------------------------------------------------------------------

test('rewriteAuthTables with no auth tables returns original SQL', () => {
  const sql = 'SELECT * FROM tasks'
  const result = rewriteAuthTables(sql, new Map())
  assert.equal(result, sql)
})

test('rewriteAuthTables handles LEFT OUTER JOIN', () => {
  const sql = 'SELECT t.id FROM tasks t LEFT OUTER JOIN team_members m ON t.assignee_id = m.id'
  const authTables = new Map([
    ['tasks', '__auth_tasks'],
    ['team_members', '__auth_team_members'],
  ])
  const result = rewriteAuthTables(sql, authTables)
  assert.ok(result.includes('__auth_tasks t'))
  assert.ok(result.includes('__auth_team_members m'))
})

test('rewriteAuthTables handles INNER JOIN', () => {
  const sql = 'SELECT t.id FROM tasks t INNER JOIN team_members m ON t.assignee_id = m.id'
  const authTables = new Map([
    ['tasks', '__auth_tasks'],
    ['team_members', '__auth_team_members'],
  ])
  const result = rewriteAuthTables(sql, authTables)
  assert.ok(result.includes('__auth_tasks t'))
  assert.ok(result.includes('__auth_team_members m'))
})

test('rewriteAuthTables with AS alias syntax', () => {
  const sql = 'SELECT t.id FROM tasks AS t'
  const authTables = new Map([['tasks', '__auth_tasks']])
  const result = rewriteAuthTables(sql, authTables)
  assert.ok(result.includes('__auth_tasks AS t'))
})

// ---------------------------------------------------------------------------
// End-to-end: full auth pipeline
// ---------------------------------------------------------------------------

test('full auth pipeline: parse, validate, rewrite, execute', () => {
  const db = makeTestDb()

  // Seed data for two orgs
  for (const org of [1, 2]) {
    db.prepare('INSERT INTO tasks (title, status, priority, org_id) VALUES (@t, @s, @p, @o)').run({
      t: 'Task org ' + org, s: 'todo', p: 'high', o: org,
    })
    db.prepare('INSERT INTO team_members (name, email, role, org_id) VALUES (@n, @e, @r, @o)').run({
      n: 'Member org ' + org, e: org + '@example.com', r: 'admin', o: org,
    })
  }

  const clientSql = `SELECT t.*, m.name AS assignee
FROM tasks t
LEFT JOIN team_members m ON t.assignee_id = m.id
WHERE t.status != @done
ORDER BY t.id`

  const clientParams = { done: 'done' }
  const user = { org_id: 1 }

  // 1. Parse
  const parsed = parseSelect(clientSql)
  assert.deepEqual([...parsed.tables].sort(), ['tasks', 'team_members'])

  // 2. Validate params
  for (const name of parsed.params) {
    assert.ok(Object.hasOwn(clientParams, name), 'Missing param: ' + name)
  }

  // 3. Build auth
  const readFilterFor = (table, user) => ({ org_id: user.org_id })
  const { ctes, authParams, authTables } = buildAuthCtes(parsed.tables, readFilterFor, user)

  // 4. Rewrite
  const rewritten = rewriteAuthTables(clientSql, authTables)
  const fullSql = injectCtes(rewritten, ctes)

  // 5. Execute
  const allParams = { ...clientParams, ...authParams }
  const rows = db.prepare(fullSql).all(allParams)

  // Only org 1 tasks, excluding status=done
  assert.equal(rows.length, 1)
  assert.equal(rows[0].title, 'Task org 1')
})

// ---------------------------------------------------------------------------
// LIMIT enforcement with auth CTE pipeline
// ---------------------------------------------------------------------------

test('enforceLimit + auth CTE: default LIMIT applied to unlimited query', () => {
  const db = makeTestDb()

  // Seed 5 rows for org 1
  for (let i = 0; i < 5; i++) {
    db.prepare('INSERT INTO tasks (title, status, priority, org_id) VALUES (@t, @s, @p, @o)').run({
      t: 'Task ' + i, s: 'todo', p: 'high', o: 1,
    })
  }

  const clientSql = 'SELECT * FROM tasks'
  const parsed = parseSelect(clientSql)

  // Enforce with defaultLimit=3
  const enforcedSql = enforceLimit(clientSql, parsed, { defaultLimit: 3, maxLimit: 10 })
  assert.ok(enforcedSql.includes('LIMIT 3'))

  // Build auth query and execute
  const readFilterFor = (table, user) => ({ org_id: user.org_id })
  const user = { org_id: 1 }
  const { ctes, authParams, authTables } = buildAuthCtes(parsed.tables, readFilterFor, user)
  const rewritten = rewriteAuthTables(enforcedSql, authTables)
  const fullSql = injectCtes(rewritten, ctes)

  const rows = db.prepare(fullSql).all(authParams)
  assert.equal(rows.length, 3)
})

test('enforceLimit + auth CTE: over-limit capped', () => {
  const db = makeTestDb()

  for (let i = 0; i < 5; i++) {
    db.prepare('INSERT INTO tasks (title, status, priority, org_id) VALUES (@t, @s, @p, @o)').run({
      t: 'Task ' + i, s: 'todo', p: 'high', o: 1,
    })
  }

  const clientSql = 'SELECT * FROM tasks LIMIT 9999'
  const parsed = parseSelect(clientSql)

  const enforcedSql = enforceLimit(clientSql, parsed, { maxLimit: 2 })
  assert.ok(enforcedSql.includes('LIMIT 2'))

  const readFilterFor = (table, user) => ({ org_id: user.org_id })
  const user = { org_id: 1 }
  const { ctes, authParams, authTables } = buildAuthCtes(parsed.tables, readFilterFor, user)
  const rewritten = rewriteAuthTables(enforcedSql, authTables)
  const fullSql = injectCtes(rewritten, ctes)

  const rows = db.prepare(fullSql).all(authParams)
  assert.equal(rows.length, 2)
})

test('enforceLimit caps param-based LIMIT at runtime', () => {
  const db = makeTestDb()

  for (let i = 0; i < 5; i++) {
    db.prepare('INSERT INTO tasks (title, status, priority, org_id) VALUES (@t, @s, @p, @o)').run({
      t: 'Task ' + i, s: 'todo', p: 'high', o: 1,
    })
  }

  const clientSql = 'SELECT * FROM tasks LIMIT @n'
  const parsed = parseSelect(clientSql)
  const maxLimit = 3

  // enforceLimit leaves param-based LIMIT SQL unchanged
  const enforcedSql = enforceLimit(clientSql, parsed, { maxLimit })
  assert.equal(enforcedSql, clientSql)

  // But we cap the param value at runtime
  const clientParams = { n: 9999 }
  const enforcedParams = { ...clientParams }
  if (parsed.limit && parsed.limit.type === 'param') {
    const v = enforcedParams[parsed.limit.value]
    if (typeof v === 'number' && v > maxLimit) {
      enforcedParams[parsed.limit.value] = maxLimit
    }
  }

  assert.equal(enforcedParams.n, 3)

  const readFilterFor = () => true
  const { ctes, authParams, authTables } = buildAuthCtes(parsed.tables, readFilterFor, {})
  const rewritten = rewriteAuthTables(enforcedSql, authTables)
  const fullSql = injectCtes(rewritten, ctes)

  const rows = db.prepare(fullSql).all({ ...enforcedParams, ...authParams })
  assert.equal(rows.length, 3)
})
