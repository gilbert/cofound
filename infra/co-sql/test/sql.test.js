import assert from 'node:assert/strict'
import test from 'node:test'
import { SqlParseError, parseSelect, tokenize } from '../index.js'

function parsed(sql) {
  const result = parseSelect(sql)
  return {
    tables: [...result.tables].sort(),
    aliases: [...result.aliases.entries()].sort(),
    params: [...result.params].sort(),
  }
}

function rejects(sql, pattern) {
  assert.throws(() => parseSelect(sql), err => {
    assert.ok(err instanceof SqlParseError)
    assert.match(err.message, pattern)
    return true
  })
}

test('tokenize rejects unsupported SQL surface', () => {
  assert.throws(() => tokenize("SELECT 'x' FROM tasks"), /Quoted strings/)
  assert.throws(() => tokenize('SELECT * FROM "tasks"'), /Quoted strings/)
  assert.throws(() => tokenize('SELECT * FROM tasks;'), /Semicolons/)
  assert.throws(() => tokenize('SELECT * FROM tasks -- comment'), /Comments/)
  assert.throws(() => tokenize('SELECT * FROM tasks WHERE id = ?'), /Positional/)
})

test('single table query', () => {
  assert.deepEqual(parsed('SELECT * FROM tasks'), {
    tables: ['tasks'],
    aliases: [],
    params: [],
  })
})

test('joined query with aliases and params', () => {
  assert.deepEqual(parsed(`
    SELECT t.*, m.name AS assignee
    FROM tasks t
    LEFT JOIN team_members m ON t.assignee_id = m.id
    WHERE t.status != @done
    ORDER BY t.created_at DESC
    LIMIT @limit OFFSET 10
  `), {
    tables: ['tasks', 'team_members'],
    aliases: [['m', 'team_members'], ['t', 'tasks']],
    params: ['done', 'limit'],
  })
})

test('supports table aliases using AS and bare select aliases', () => {
  assert.deepEqual(parsed(`
    SELECT m.name assignee
    FROM team_members AS m
    INNER JOIN tasks AS t ON t.assignee_id = m.id
    WHERE (m.id = @id OR t.priority >= @priority) AND t.deleted_at IS NULL
  `), {
    tables: ['tasks', 'team_members'],
    aliases: [['m', 'team_members'], ['t', 'tasks']],
    params: ['id', 'priority'],
  })
})

test('supports IN, NOT IN, IS NOT NULL, and unqualified columns', () => {
  assert.deepEqual(parsed(`
    SELECT id, title
    FROM tasks
    WHERE status IN (@todo, @doing) OR assignee_id NOT IN (1, 2)
    ORDER BY created_at ASC
  `), {
    tables: ['tasks'],
    aliases: [],
    params: ['doing', 'todo'],
  })

  assert.deepEqual(parsed('SELECT id FROM tasks WHERE assignee_id IS NOT NULL'), {
    tables: ['tasks'],
    aliases: [],
    params: [],
  })
})

test('rejects non-select statements and client CTEs', () => {
  rejects('INSERT INTO tasks(title) VALUES (@title)', /Expected SELECT/)
  rejects('UPDATE tasks SET title = @title', /Expected SELECT/)
  rejects('WITH active AS (SELECT * FROM tasks) SELECT * FROM active', /Expected SELECT/)
})

test('rejects schema-qualified table and column bypass attempts', () => {
  rejects('SELECT * FROM main.tasks', /Schema-qualified table/)
  rejects('SELECT main.tasks FROM tasks', /Unknown table or alias/)
  rejects('SELECT main.tasks.id FROM tasks', /Three-part column/)
})

test('rejects unsupported expressions and subqueries', () => {
  rejects('SELECT count(*) FROM tasks', /Expected FROM/)
  rejects('SELECT t.* AS task FROM tasks t', /Star select items/)
  rejects('SELECT * FROM tasks WHERE id IN (SELECT task_id FROM comments)', /Expected parameter/)
  rejects('SELECT * FROM tasks GROUP BY status', /Expected end/)
  rejects('SELECT * FROM tasks UNION SELECT * FROM archived_tasks', /Expected end/)
  rejects("SELECT * FROM tasks WHERE status = 'done'", /Quoted strings/)
})

test('rejects unsupported join forms', () => {
  rejects('SELECT * FROM tasks RIGHT JOIN team_members ON tasks.assignee_id = team_members.id', /Expected end/)
  rejects('SELECT * FROM tasks FULL JOIN team_members ON tasks.assignee_id = team_members.id', /Expected end/)
  rejects('SELECT * FROM tasks JOIN team_members USING (id)', /Expected ON/)
})

test('rejects unknown aliases and duplicate aliases', () => {
  rejects('SELECT x.title FROM tasks t', /Unknown table or alias `x`/)
  rejects('SELECT * FROM tasks t JOIN team_members t ON t.id = t.id', /Duplicate table alias `t`/)
})

test('rejects reserved auth parameter prefix', () => {
  rejects('SELECT * FROM tasks WHERE org_id = @__auth_0', /reserved/)
})
