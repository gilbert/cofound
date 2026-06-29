import t from 'cofound/test'
import { makeDb, col, Model, Sql, migrate, generateUid } from 'cofound/db'
import { makeTestDb } from 'cofound/db/test-utils'

function eq(a, b) {
  const as = JSON.stringify(a), bs = JSON.stringify(b)
  if (as !== bs) throw new Error('expected `' + as + '` but got `' + bs + '`')
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const contacts = {
  cols: {
    id: col.id(),
    name: col.text(),
    email: col.text().nullable(),
    phone: col.text().nullable(),
    active: col.boolean().default('1'),
    meta: col.json().nullable(),
    last_seen_at: col.timestamp().nullable(),
    status: col.enum(['active', 'inactive']).default("'active'"),
    created_at: col.created_at(),
    updated_at: col.updated_at(),
  },
}

const tasks = {
  cols: {
    id: col.id(),
    title: col.text(),
    due_at: col.timestamp().nullable(),
    done: col.boolean().default('0'),
    contact_id: col.text().references('contacts.id').nullable(),
    created_at: col.created_at(),
    updated_at: col.updated_at(),
  },
}

const schema = { contacts, tasks }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshDb() {
  const db = makeDb(':memory:')
  migrate(db, schema, { silent: true })
  return db
}

class ContactsModel extends Model {
  constructor(db) { super(db, 'contacts', contacts) }
}

class TasksModel extends Model {
  constructor(db) { super(db, 'tasks', tasks) }
}

const withModels = {
  run(test) {
    const db = freshDb()
    return test({
      db,
      C: new ContactsModel(db),
      T: new TasksModel(db),
    })
  }
}

// ===========================================================================
t`Schema & Column builder`(
// ===========================================================================

  t`col.text() creates text column`(() => {
    const c = col.text()
    t.is('text', c.datatype)
    return [1, c.meta.notnull]
  }),

  t`col.nullable() immutable`(() => {
    const a = col.text()
    const b = a.nullable()
    t.is(1, a.meta.notnull)
    return [0, b.meta.notnull]
  }),

  t`col.id() creates text UUID column`(() => {
    const c = col.id()
    t.is('text', c.datatype)
    t.is('uuid_v4()', c.meta.default)
    return ['unique', c.meta.index]
  }),

  t`col.enum() stores options`(() => {
    const c = col.enum(['a', 'b', 'c'])
    t.is('enum', c.datatype)
    eq(['a', 'b', 'c'], c.meta.enums)
  }),

  t`col.references() auto-indexes`(() => {
    const c = col.text().references('contacts.id')
    t.is('contacts.id', c.meta.references)
    return [true, c.meta.index]
  }),

  t`col.timestamp() uses unixepoch`(() =>
    ['unixepoch', col.timestamp().datatype]
  ),
)

// ===========================================================================
t`Migration`(
// ===========================================================================

  t`creates tables from schema`(() => {
    const db = makeDb(':memory:')
    t.is(true, migrate(db, schema, { silent: true }))
    const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name != 'sqlite_sequence'").all()
    eq(['contacts', 'tasks'], tables.map(r => r.name).sort())
  }),

  t`no-op on second migrate`(() => {
    const db = makeDb(':memory:')
    migrate(db, schema, { silent: true })
    return [false, migrate(db, schema, { silent: true })]
  }),

  t`detects new column`(() => {
    const db = makeDb(':memory:')
    migrate(db, schema, { silent: true })
    const schema2 = {
      ...schema,
      contacts: { cols: { ...contacts.cols, nickname: col.text().nullable() } },
    }
    t.is(true, migrate(db, schema2, { silent: true }))
    const cols = db.prepare("SELECT name FROM pragma_table_info('contacts')").all()
    return [true, !!cols.find(c => c.name === 'nickname')]
  }),

  t`detects removed column`(() => {
    const db = makeDb(':memory:')
    migrate(db, schema, { silent: true })
    const { phone, ...restCols } = contacts.cols
    const schema2 = { ...schema, contacts: { cols: restCols } }
    t.is(true, migrate(db, schema2, { silent: true }))
    const cols = db.prepare("SELECT name FROM pragma_table_info('contacts')").all()
    return [false, !!cols.find(c => c.name === 'phone')]
  }),
)

// ===========================================================================
t`Model: insert & find`(withModels,
// ===========================================================================

  t`insert returns rowid`(({ C }) =>
    ['number', typeof C.insert({ name: 'Alice' })]
  ),

  t`findAll returns inserted rows`(({ C }) => {
    C.insert({ name: 'Alice' })
    C.insert({ name: 'Bob' })
    return [2, C.findAll({}).length]
  }),

  t`findBy throws on missing`(({ C }) => {
    let threw = false
    try { C.findBy({ name: 'nonexistent' }) } catch { threw = true }
    return [true, threw]
  }),

  t`findByOptional returns null on missing`(({ C }) =>
    [null, C.findByOptional({ name: 'nonexistent' })]
  ),

  t`findBy returns matching row`(({ C }) => {
    C.insert({ name: 'Alice', email: 'alice@test.com' })
    return ['Alice', C.findBy({ email: 'alice@test.com' }).name]
  }),

  t`count returns correct count`(({ C }) => {
    C.insert({ name: 'Alice' })
    C.insert({ name: 'Bob' })
    C.insert({ name: 'Charlie' })
    return [3, C.count({})]
  }),

  t`exists returns true/false`(({ C }) => {
    C.insert({ name: 'Alice' })
    t.is(true, C.exists({ name: 'Alice' }))
    return [false, C.exists({ name: 'Bob' })]
  }),
)

// ===========================================================================
t`Model: update & delete`(withModels,
// ===========================================================================

  t`updateById updates a record`(({ C }) => {
    C.insert({ name: 'Alice', email: 'old@test.com' })
    const row = C.findBy({ name: 'Alice' })
    C.updateById(row.id, { email: 'new@test.com' })
    return ['new@test.com', C.findBy({ name: 'Alice' }).email]
  }),

  t`updateWhere updates matching records`(({ C }) => {
    C.insert({ name: 'Alice', status: 'active' })
    C.insert({ name: 'Bob', status: 'active' })
    C.updateWhere({ status: 'active' }, { status: 'inactive' })
    return [2, C.findAll({ status: 'inactive' }).length]
  }),

  t`deleteWhere removes matching records`(({ C }) => {
    C.insert({ name: 'Alice' })
    C.insert({ name: 'Bob' })
    C.deleteWhere({ name: 'Alice' })
    t.is(1, C.count({}))
    return ['Bob', C.findBy({}).name]
  }),
)

// ===========================================================================
t`Serialize / Deserialize`(withModels,
// ===========================================================================

  t`boolean: true → 1 → true`(({ C }) => {
    C.insert({ name: 'Alice', active: true })
    return [true, C.findBy({ name: 'Alice' }).active]
  }),

  t`boolean: false → 0 → false`(({ C }) => {
    C.insert({ name: 'Alice', active: false })
    return [false, C.findBy({ name: 'Alice' }).active]
  }),

  t`json: object round-trips`(({ C }) => {
    const meta = { tags: ['vip'], score: 42 }
    C.insert({ name: 'Alice', meta })
    eq(meta, C.findBy({ name: 'Alice' }).meta)
  }),

  t`json: null round-trips`(({ C }) => {
    C.insert({ name: 'Alice', meta: null })
    return [null, C.findBy({ name: 'Alice' }).meta]
  }),

  t`timestamp: ms → seconds → ms`(({ C }) => {
    const ts = 1700000000000
    C.insert({ name: 'Alice', last_seen_at: ts })
    return [ts, C.findBy({ name: 'Alice' }).last_seen_at]
  }),

  t`timestamp: null round-trips`(({ C }) => {
    C.insert({ name: 'Alice', last_seen_at: null })
    return [null, C.findBy({ name: 'Alice' }).last_seen_at]
  }),

  t`enum: valid value accepted`(({ C }) => {
    C.insert({ name: 'Alice', status: 'inactive' })
    return ['inactive', C.findBy({ name: 'Alice' }).status]
  }),

  t`enum: invalid value throws`(({ C }) => {
    let threw = false
    try { C.insert({ name: 'Alice', status: 'bogus' }) } catch { threw = true }
    return [true, threw]
  }),

  t`created_at and updated_at are auto-set`(({ C }) => {
    C.insert({ name: 'Alice' })
    const row = C.findBy({ name: 'Alice' })
    t.is('number', typeof row.created_at)
    t.is(true, row.created_at > 0)
    t.is('number', typeof row.updated_at)
    return [true, row.updated_at > 0]
  }),

  t`integer columns deserialize BigInt to Number`(({ C }) => {
    C.insert({ name: 'Alice' })
    return ['number', typeof C.count({})]
  }),
)

// ===========================================================================
t`SQL operators`(withModels,
// ===========================================================================

  t`Sql.in filters correctly`(({ C }) => {
    C.insert({ name: 'Alice' })
    C.insert({ name: 'Bob' })
    C.insert({ name: 'Charlie' })
    const rows = C.findAll({ name: Sql.in('Alice', 'Charlie') })
    t.is(2, rows.length)
    eq(['Alice', 'Charlie'], rows.map(r => r.name).sort())
  }),

  t`Sql.notEq filters correctly`(({ C }) => {
    C.insert({ name: 'Alice' })
    C.insert({ name: 'Bob' })
    t.is(1, C.findAll({ name: Sql.notEq('Alice') }).length)
    return ['Bob', C.findAll({ name: Sql.notEq('Alice') })[0].name]
  }),

  t`Sql.notNull filters correctly`(({ C }) => {
    C.insert({ name: 'Alice', email: 'a@test.com' })
    C.insert({ name: 'Bob', email: null })
    t.is(1, C.findAll({ email: Sql.notNull }).length)
    return ['Alice', C.findAll({ email: Sql.notNull })[0].name]
  }),

  t`Sql.gt / Sql.lte filter correctly`(({ C }) => {
    C.insert({ name: 'Alice', last_seen_at: 1700000000000 })
    C.insert({ name: 'Bob', last_seen_at: 1700000060000 })
    C.insert({ name: 'Charlie', last_seen_at: 1700000120000 })
    t.is(2, C.findAll({ last_seen_at: Sql.gt(1700000000000) }).length)
    return [2, C.findAll({ last_seen_at: Sql.lte(1700000060000) }).length]
  }),

  t`Sql.like filters correctly`(({ C }) => {
    C.insert({ name: 'Alice' })
    C.insert({ name: 'Alicia' })
    C.insert({ name: 'Bob' })
    return [2, C.findAll({ name: Sql.like('Ali%') }).length]
  }),

  t`null WHERE filters correctly`(({ C }) => {
    C.insert({ name: 'Alice', email: 'a@test.com' })
    C.insert({ name: 'Bob', email: null })
    const rows = C.findAll({ email: null })
    t.is(1, rows.length)
    return ['Bob', rows[0].name]
  }),
)

// ===========================================================================
t`JSON column queries`(withModels,
// ===========================================================================

  t`json sub-key query works`(({ C }) => {
    C.insert({ name: 'Alice', meta: { role: 'admin', level: 5 } })
    C.insert({ name: 'Bob', meta: { role: 'user', level: 1 } })
    const rows = C.findAll({ meta: { role: 'admin' } })
    t.is(1, rows.length)
    return ['Alice', rows[0].name]
  }),
)

// ===========================================================================
t`Transactions`(withModels,
// ===========================================================================

  t`transaction commits atomically`(({ db, C, T }) => {
    db.transaction(() => {
      C.insert({ name: 'Alice' })
      T.insert({ title: 'Call Alice' })
    })()
    t.is(1, C.count({}))
    return [1, T.count({})]
  }),

  t`transaction rolls back on error`(({ db, C }) => {
    try {
      db.transaction(() => {
        C.insert({ name: 'Alice' })
        throw new Error('deliberate')
      })()
    } catch {}
    return [0, C.count({})]
  }),
)

// ===========================================================================
t`defaultWhere`(
// ===========================================================================

  t`defaultWhere filters all queries`(() => {
    const db = freshDb()
    class ActiveContacts extends Model {
      constructor() {
        super(db, 'contacts', contacts)
        this.defaultWhere = { active: true }
      }
    }
    const AC = new ActiveContacts()
    const C = new ContactsModel(db)
    C.insert({ name: 'Alice', active: true })
    C.insert({ name: 'Bob', active: false })
    t.is(1, AC.findAll({}).length)
    t.is('Alice', AC.findAll({})[0].name)
    t.is(1, AC.count({}))
    return [false, AC.exists({ name: 'Bob' })]
  }),
)

// ===========================================================================
t`extraSql`(withModels,
// ===========================================================================

  t`findAll with ORDER BY`(({ C }) => {
    C.insert({ name: 'Charlie' })
    C.insert({ name: 'Alice' })
    C.insert({ name: 'Bob' })
    eq(['Alice', 'Bob', 'Charlie'], C.findAll({}, 'ORDER BY name ASC').map(r => r.name))
  }),

  t`findAll with LIMIT`(({ C }) => {
    C.insert({ name: 'Alice' })
    C.insert({ name: 'Bob' })
    C.insert({ name: 'Charlie' })
    return [2, C.findAll({}, 'LIMIT 2').length]
  }),
)

// ===========================================================================
t`generateUid`(
// ===========================================================================

  t`produces correct length`(() =>
    [12, generateUid(12).length]
  ),

  t`domainFriendly alphabet`(() => {
    const uid = generateUid(8, 'domainFriendly')
    t.is(8, uid.length)
    return [true, /^[0-9a-z]+$/.test(uid)]
  }),

  t`produces unique values`(() => {
    const uids = new Set()
    for (let i = 0; i < 100; i++) uids.add(generateUid(16))
    return [100, uids.size]
  }),
)

// ===========================================================================
t`Foreign keys`(withModels,
// ===========================================================================

  t`foreign key constraint works`(({ C, T }) => {
    C.insert({ name: 'Alice' })
    const alice = C.findBy({ name: 'Alice' })
    T.insert({ title: 'Call Alice', contact_id: alice.id })
    return [alice.id, T.findBy({ title: 'Call Alice' }).contact_id]
  }),
)

// ===========================================================================
t`Text UUID id`(withModels,
// ===========================================================================

  t`col.id() generates UUID on insert`(({ C }) => {
    C.insert({ name: 'Alice' })
    const row = C.findBy({ name: 'Alice' })
    t.is('string', typeof row.id)
    return [true, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row.id)]
  }),

  t`findBy with text id works`(({ C }) => {
    C.insert({ name: 'Alice' })
    const row = C.findBy({ name: 'Alice' })
    return ['Alice', C.findBy({ id: row.id }).name]
  }),

  t`updateById with text id works`(({ C }) => {
    C.insert({ name: 'Alice' })
    const row = C.findBy({ name: 'Alice' })
    C.updateById(row.id, { name: 'Alice Updated' })
    return ['Alice Updated', C.findBy({ id: row.id }).name]
  }),
)

// ===========================================================================
t`Test utilities`(
// ===========================================================================

  t`makeTestDb creates working in-memory db`(() => {
    const db = makeTestDb()
    migrate(db, schema, { silent: true })
    const C = new ContactsModel(db)
    C.insert({ name: 'Test' })
    return [1, C.count({})]
  }),
)
