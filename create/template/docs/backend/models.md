# Cofound Models

A models is the code responsible for reading and writing to its respective source of I/O. In our case, we have models that interact with entities stored in Sqlite tables.

## Example Model

First, your project already has a `+/models/base-model.ts` in it that looks something like this:

```ts
import { CF_BaseModel, TableDef } from 'cofound/backend'
import debug from 'debug'

import { DbConn } from '../lib/db'
import { APP_NAME } from '../lib/env'

export { schema } from '../schema'

export abstract class BaseModel<Cols extends TableDef> extends CF_BaseModel<Cols, DbConn> {
  protected log = debug(`${APP_NAME}:actions:${this.constructor.name}`)
}
```

This makes it easy to extend it to create new models:

```ts
// +/models/user-model.ts
import { Selects } from '../schema'
import { BaseModel, schema } from './base-model'

export class User extends BaseModel<typeof schema.users> {
  protected tablename = 'users'
  protected table = schema.users

  //
  // When sending data to the frontend, it's best practice to whitelist safe attributes.
  // This allows you to do:
  //
  //    const user = User.findBy({ id: ... })
  //    return ok(User.clean(user))
  //
  clean = this.makePick(['uid', 'name'])

  //
  // Wrapping `this.insert` is best practice for controlling and generating incoming values
  //
  create(attrs: { name: string }) {
    return this.insert({
      ...attrs,
      uid: `usr-${this.generateUid(8, { alphabet: 'domainFriendly' })}`,
    })
  }

  //
  // This is how you directly expose without a wrapper
  //
  update = this.updateWhere

  //
  // It's good practice to write helpers for more complicated queries.
  // NOTE: If you DONT need a join, just call .findByOptional() directly, outside the model.
  //
  findByEmailOptional(email: string) {
    //
    // JOIN queries must be made manually.
    // Fortunately this is not common since SQLite doesn't have the n+1 problem.
    //
    return this.db
      .prepare<string, Selects['users']>(
        `
          SELECT users.* FROM users
          JOIN emails ON emails.user_id = users.id
          WHERE emails.email = ?
        `,
      )
      .get(email)
  }

  //
  // It's NOT recommended to write thin wrappers like this.
  // Just call `this.findByOptional` directly.
  //
  // findByEmail(email: string) { // Don't do this
  //   return this.findByOptional({ email }) // Don't do this
  // }
}
```

## Base Model Features

Your models inherit from `CF_BaseModel`, which has a number of features, such as:

- SELECT features
- INSERT features
- UPDATE features
- Helpers

For the examples, we will be using this model setup:

```ts
import { SchemaCols, SchemaDef, Selectable, col } from 'cofound/backend'

const schema = {
  users: {
    cols: {
      id: col.primary(),
      uid: col.text().index('unique'),
      name: col.text(),
      score: col.integer().default(`0`),
      created_at: col.created_at(),
    },
  },
} satisfies SchemaDef

class User extends BaseModel<typeof schema.users> {
  protected tablename = 'users'
  protected table = schema.users
}

type UserRow = Selects['users']
type Selects = {
  [K in keyof Schema]: Selectable<Schema[K]>
}
type Schema = SchemaCols<typeof schema>
```

### SELECT features

The primary way you fetch data is through the find methods:

```ts
User.findBy({ id: 123 }) //=> UserRow (throws if not found)
User.findByOptional({ id: 123 }) //=> UserRow | null

User.findAll({ name: 'Alice' }) //=> UserRow[]
User.findAll({}, `ORDER BY created_at DESC LIMIT 10`) //=> UserRow[]


import { Sql } from 'cofound/backend'

User.findAll({
  created_at: Sql.gt(Date.now() - TEN_DAYS),
})
// Also avaliable:
// Sql.in
// Sql.notEq
// Sql.notNull
// Sql.lt
// Sql.lte
// Sql.gt
// Sql.gte
```

There is also a `defaultWhere` feature. Use this sparingly as it sort of locks your app into using it.

```ts
class User extends BaseModel<typeof schema.users> {
  protected tablename = 'users'
  protected table = schema.users

  //
  // Assuming you add a deleted_at column,
  // this ensures all find and update queries have `WHERE deleted_at = NULL`
  //
  defaultWhere: {
    deleted_at: null
  }
}
```

### INSERT features

You can define or expose insert methods in your model class:

```ts
class User extends BaseModel<typeof schema.users> {
  protected tablename = 'users'
  protected table = schema.users

  // Expose insert directly (not recommended, but good for prototyping)
  create = this.insert

  // Wrapping helps you control default values
  betterCreate(attrs: { name?: string } = {}) {
    return this.insert({
      ...attrs,
      name: attrs.name || this.generateUid(16),
    })
  }

  // insertOrIgnore lets you idempotently upsert
  createOrIgnore(attrs: { name: string }) {
    return this.insertOrIgnore(['name'], attrs)
  }

  // insertOrReplace lets you idempotently upsert with an update strategy
  setScore(attrs: { name: string, score: number }) {
    // Updates `score` column if name already exists
    return this.insertOrIgnore(['name'], ['score'], attrs)
  }
}
```

### UPDATE features

Just like insert methods, you can define or expose update methods in your model class:

```ts
class User extends BaseModel<typeof schema.users> {
  protected tablename = 'users'
  protected table = schema.users

  // Expose directly (not always recommended, but more ok than exposing this.update)
  update = this.updateWhere

  // Expose directly (not always recommended, but more ok than exposing this.insert)
  updateAlt = updateById
}
```

### DELETE features

There is only one delete method at the moment, `this.deleteWhere(attrs)`. It behaves similarly to `this.findAll` and `this.updateWhere`.

### Helpers

BaseModel gives you access to a few helpers:

```ts
class User extends BaseModel<typeof schema.users> {
  protected tablename = 'users'
  protected table = schema.users

  exampleContext() {
    // Generates a uid, checking the specified column for duplicates
    this.generateUid(length: number, options: {
      column = 'uid',
      alphabet?: 'standard' | 'domainFriendly'
    })

    // Direct access to the db. Useful for advanced queries.
    // If selecting rows, you want to combine this with `this.deserialize`
    this.db

    // Takes a raw row queried from the database and performs any
    // transformations defined in your schema.
    this.deserialize(rawRow)
  }

  // Creates a function that strips out all columns except the ones specified.
  // Useful for hiding id's from the outside world.
  clean = this.makePick(['uid', 'name'])
}
```

## Architecture Guidelines

- A model file name should be kebab-case (e.g. `+/models/favorite-food-model.ts` for `FavoriteFood`)
- A model should never expose the internals of its I/O
  - e.g. A model should not expose details of SQL, sqlite3, 3rd party APIs, etc.
- A model should only be concerned with its own scope, and not others
  - e.g. A model should not directly access another model
- Model methods should return data directly (not Results), and throw an error if something goes wrong
  - Reasoning for this is data access errors should be rare by design
  - If a record may not exist, returning null is usually fine
  - A thrown error should be caught by the execution environment, e.g. the rpc layer
