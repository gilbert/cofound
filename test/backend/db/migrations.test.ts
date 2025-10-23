import o from 'ospec'

import { BaseDbConn, SchemaDef, col, makeBaseDb, migrateAppDatabase } from '../../../src/backend'

o.spec('Database Migrations', () => {
  let db: BaseDbConn
  const env = { name: 'test' }

  o.beforeEach(() => {
    db = makeBaseDb(':memory:')
  })

  function expectCount(num: number, sql: string) {
    ;(o(db.prepare(sql).all().length).equals(num) as any)`${sql}`
  }

  function run(sql: string) {
    try {
      db.exec(sql)
    } catch (e: any) {
      throw new Error(`Error running sql (${sql}):\n  ${e.message}`)
    }
  }

  o('creates table', () => {
    const schema = {
      users: {
        cols: {
          id: col.primary(),
          name: col.text(),
          primary: col.boolean(), // Reserved keyword
        },
      },
    } satisfies SchemaDef
    expectCount(0, `SELECT * FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
    migrateAppDatabase({ db, env, schema })
    expectCount(1, `SELECT * FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
    expectCount(0, `SELECT * FROM users WHERE id = 10 AND name = 'test'`)
  })

  o('does not clash with explicit created_at or updated_at', () => {
    const schema = {
      users: {
        cols: {
          id: col.primary(),
          name: col.text(),
          updated_at: col.updated_at(),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema })
    run(`INSERT INTO users (name, updated_at) VALUES ('alice', 123)`)
    run(`INSERT INTO users (name) VALUES ('bob')`)
    expectCount(1, `SELECT * FROM users WHERE updated_at = 123`)
    expectCount(2, `SELECT * FROM users WHERE created_at > 100`)
  })

  o('no change', () => {
    const schema = {
      users: {
        cols: {
          id: col.primary(),
          name: col.text().index(),
          secret: col.text().index('unique'),
          primary: col.boolean(),
          verified_at: col.timestamp().nullable(),
        },
      },
      hobbies: {
        cols: {
          id: col.primary(),
          user_id: col.integer().references('users.id'),
        },
      },
    } satisfies SchemaDef
    o(migrateAppDatabase({ db, env, schema })).equals(true)
    o(migrateAppDatabase({ db, env, schema })).equals(false)
  })

  o('update nullable', () => {
    const schemaBefore = {
      users: {
        cols: {
          id: col.primary(),
          name: col.text(),
          primary: col.boolean(), // Reserved keyword
        },
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols: {
          id: col.primary(),
          name: col.text().nullable(),
          primary: col.boolean().nullable(),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schemaBefore })
    run(`INSERT INTO users (name, [primary]) VALUES ('alice', 1)`)
    o(() => run(`INSERT INTO users (id) VALUES (99)`)).throws(Error)

    migrateAppDatabase({ db, env, schema: schemaAfter })
    expectCount(1, `SELECT * FROM users WHERE name = 'alice'`)
    run(`INSERT INTO users (id) VALUES (99)`)
  })

  o('adds column', () => {
    const schemaBefore = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
        },
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
          name: col.text().nullable(),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schemaBefore })
    run(`INSERT INTO users (email) VALUES ('alice@example.com')`)

    migrateAppDatabase({ db, env, schema: schemaAfter })
    expectCount(1, `SELECT * FROM users WHERE email = 'alice@example.com'`)
    run(`INSERT INTO users (email) VALUES ('bob')`)
    run(`INSERT INTO users (name, email) VALUES ('carly', 'carly@example.com')`)
  })

  o('adds column with foreign key', () => {
    const schema = {
      users: {
        cols: {
          id: col.primary(),
        },
      },
      pets: {
        cols: {
          id: col.primary(),
          user_id: col.integer().references('users.id'),
        },
      },
      hobbies: {
        cols: {
          id: col.primary(),
          user_id: col.integer().references(), // Implicit
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema })
    run(`INSERT INTO users (id) VALUES (1)`)
    run(`INSERT INTO hobbies (id, user_id) VALUES (1, 1)`)
    o(() => run(`INSERT INTO hobbies (id, user_id) VALUES (2, 2)`)).throws(Error)

    run(`INSERT INTO pets (id, user_id) VALUES (1, 1)`)
    o(() => run(`INSERT INTO pets (id, user_id) VALUES (2, 2)`)).throws(Error)
  })

  o('adds column with sql data source (column)', () => {
    const schemaBefore = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
        },
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
          name: col.text().sourceDataFrom('email'),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schemaBefore })
    run(`INSERT INTO users (email) VALUES ('alice@example.com')`)

    migrateAppDatabase({ db, env, schema: schemaAfter })
    expectCount(1, `SELECT * FROM users WHERE email = 'alice@example.com'`)
    expectCount(1, `SELECT * FROM users WHERE name = 'alice@example.com'`)
    o(() => run(`INSERT INTO users (email) VALUES ('bob')`)).throws(Error)
    run(`INSERT INTO users (name, email) VALUES ('carly', 'carly@example.com')`)
  })

  o('adds column with sql data source (sql)', () => {
    const schemaBefore = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
        },
      },
      hobbies: {
        cols: {
          id: col.primary(),
          name: col.text(),
          user_id: col.text().references('users.id'),
        },
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols: {
          ...schemaBefore.users.cols,
          favHobby: col
            .text()
            .sourceDataFrom('(SELECT name FROM hobbies WHERE user_id = users.id)'),
        },
      },
      hobbies: schemaBefore.hobbies,
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schemaBefore })
    run(`INSERT INTO users (email) VALUES ('alice@example.com')`)
    run(`INSERT INTO hobbies (name, user_id) VALUES ('running', 1)`)

    migrateAppDatabase({ db, env, schema: schemaAfter })
    expectCount(1, `SELECT * FROM users WHERE email = 'alice@example.com'`)
    o(() => run(`INSERT INTO users (email) VALUES ('bob')`)).throws(Error)
    run(`INSERT INTO users (email, favHobby) VALUES ('carly@example.com', 'cards')`)
  })

  o('adds column with sql data source (sql, json)', () => {
    const schemaBefore = {
      users: {
        cols: {
          id: col.primary(),
          name: col.text(),
        },
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols: {
          ...schemaBefore.users.cols,
          metadata: col.json().sourceDataFrom(`(
            json_object('nickname', name)
          )`),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schemaBefore })
    run(`INSERT INTO users (name) VALUES ('dan')`)

    migrateAppDatabase({ db, env, schema: schemaAfter })
    const dan = db.prepare<[], any>(`SELECT * FROM users WHERE name = 'dan'`).get()!
    o(dan.metadata).equals('{"nickname":"dan"}')
  })

  o('.sourceDataFrom() only affects initial migration', () => {
    const schema1 = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
        },
      },
    } satisfies SchemaDef
    const schema2 = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
          name: col.text().sourceDataFrom('email'),
        },
      },
    } satisfies SchemaDef
    const schema3 = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
          name: col.text().sourceDataFrom('email').nullable(),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schema1 })
    run(`INSERT INTO users (email) VALUES ('alice@example.com')`)

    migrateAppDatabase({ db, env, schema: schema2 })
    run(`UPDATE users SET email = 'new@example.com'`)
    expectCount(0, `SELECT * FROM users WHERE email = 'alice@example.com'`)
    expectCount(1, `SELECT * FROM users WHERE name = 'alice@example.com'`)

    migrateAppDatabase({ db, env, schema: schema3 })
    expectCount(0, `SELECT * FROM users WHERE email = 'alice@example.com'`)
    expectCount(1, `SELECT * FROM users WHERE name = 'alice@example.com'`)
  })

  o('deprecate column', () => {
    const schemaBefore = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
        },
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text().deprecated(),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schemaBefore })
    run(`INSERT INTO users (email) VALUES ('alice@example.com')`)

    migrateAppDatabase({ db, env, schema: schemaAfter })
    expectCount(1, `SELECT * FROM users WHERE email = 'alice@example.com'`)
    run(`INSERT INTO users (email) VALUES ('bob')`)
  })

  o('create index on col', () => {
    const schemaBefore = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
        },
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text().index(),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schemaBefore })
    expectCount(0, `SELECT * FROM sqlite_master WHERE type = 'index' AND name = 'users_email'`)

    migrateAppDatabase({ db, env, schema: schemaAfter })
    expectCount(1, `SELECT * FROM sqlite_master WHERE type = 'index' AND name = 'users_email'`)
  })

  o('create custom index', () => {
    const schema = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
        },
        indexes: ['CREATE UNIQUE INDEX foo on users(email)'],
      },
    } satisfies SchemaDef
    o(migrateAppDatabase({ db, env, schema })).equals(true)
    expectCount(1, `SELECT * FROM sqlite_master WHERE type = 'index' AND name = 'foo'`)
    o(migrateAppDatabase({ db, env, schema })).equals(false)
  })

  o('update index', () => {
    const cols = {
      id: col.primary(),
      email: col.text(),
    }
    const schemaBefore = {
      users: {
        cols,
        indexes: ['CREATE INDEX foo on users(email)'],
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols,
        indexes: ['CREATE UNIQUE INDEX foo on users(email)'],
      },
    } satisfies SchemaDef
    o(migrateAppDatabase({ db, env, schema: schemaBefore })).equals(true)
    o(migrateAppDatabase({ db, env, schema: schemaAfter })).equals(true)
    o(migrateAppDatabase({ db, env, schema: schemaAfter })).equals(false)
    expectCount(1, `SELECT * FROM sqlite_master WHERE type = 'index' AND name = 'foo'`)
  })

  o('replaceNullWith() converts nullable to non-nullable column', () => {
    const schemaBefore = {
      users: {
        cols: {
          id: col.primary(),
          name: col.text().nullable(),
        },
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols: {
          id: col.primary(),
          name: col.text().replaceNullWith(`'unknown'`),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schemaBefore })
    run(`INSERT INTO users (id, name) VALUES (1, 'alice')`)
    run(`INSERT INTO users (id, name) VALUES (2, NULL)`)
    run(`INSERT INTO users (id) VALUES (3)`)
    expectCount(2, `SELECT * FROM users WHERE name IS NULL`)

    migrateAppDatabase({ db, env, schema: schemaAfter })
    expectCount(1, `SELECT * FROM users WHERE name = 'alice'`)
    expectCount(2, `SELECT * FROM users WHERE name = 'unknown'`)
    expectCount(0, `SELECT * FROM users WHERE name IS NULL`)
    o(() => run(`INSERT INTO users (id) VALUES (4)`)).throws(Error)
  })

  o('replaceNullWith() on new column with hardcoded value', () => {
    const schemaBefore = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
        },
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
          status: col.text().replaceNullWith(`'active'`),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schemaBefore })
    run(`INSERT INTO users (email) VALUES ('alice@example.com')`)

    migrateAppDatabase({ db, env, schema: schemaAfter })
    expectCount(1, `SELECT * FROM users WHERE status = 'active'`)
    o(() => run(`INSERT INTO users (email) VALUES ('bob@example.com')`)).throws(Error)
    run(`INSERT INTO users (email, status) VALUES ('carly@example.com', 'inactive')`)
  })

  o('sourceDataFrom() + replaceNullWith() combination', () => {
    const schemaBefore = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
          nickname: col.text().nullable(),
        },
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols: {
          id: col.primary(),
          email: col.text(),
          nickname: col.text().nullable(),
          display_name: col.text().sourceDataFrom('nickname').replaceNullWith('email'),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schemaBefore })
    run(`INSERT INTO users (email, nickname) VALUES ('alice@example.com', 'ally')`)
    run(`INSERT INTO users (email, nickname) VALUES ('bob@example.com', NULL)`)
    run(`INSERT INTO users (email) VALUES ('carly@example.com')`)

    migrateAppDatabase({ db, env, schema: schemaAfter })
    expectCount(1, `SELECT * FROM users WHERE display_name = 'ally'`)
    expectCount(1, `SELECT * FROM users WHERE display_name = 'bob@example.com'`)
    expectCount(1, `SELECT * FROM users WHERE display_name = 'carly@example.com'`)
  })

  o('replaceNullWith() with nullable source column preserves existing values', () => {
    const schemaBefore = {
      users: {
        cols: {
          id: col.primary(),
          status: col.text().nullable(),
        },
      },
    } satisfies SchemaDef
    const schemaAfter = {
      users: {
        cols: {
          id: col.primary(),
          status: col.text().replaceNullWith(`'pending'`),
        },
      },
    } satisfies SchemaDef
    migrateAppDatabase({ db, env, schema: schemaBefore })
    run(`INSERT INTO users (id, status) VALUES (1, 'active')`)
    run(`INSERT INTO users (id, status) VALUES (2, NULL)`)

    migrateAppDatabase({ db, env, schema: schemaAfter })
    expectCount(1, `SELECT * FROM users WHERE status = 'active'`)
    expectCount(1, `SELECT * FROM users WHERE status = 'pending'`)
    expectCount(0, `SELECT * FROM users WHERE status IS NULL`)
  })
})
