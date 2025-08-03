# Cofound Schemas

Schemas are the foundation of your app. Most type inference ends up being derived from how you define your schemas.

The main features you have access to in Cofound are:

- Typed, SQLite-focused schema definitions
- Index definitions
- Automatic table migrations

## Schema definitions

You already have a `+/schema.ts` file in your project. It's where you define all your table definitions. ALL TABLE DEFINITIONS MUST BE IN THIS FILE.

The `+/schema.ts` file looks something like this:

```ts
import { Insertable, SchemaCols, SchemaDef, Selectable, Updateable, col } from 'cofound/backend'

import { allPods } from './pods/index'

//
// WARNING:
// - Tables MUST be defined in order of dependency
// - Tables are NOT deleted by auto-migration
// - A deleted column's data IS LOST by auto-migration if you don't specify a sourceDataFrom()!
//
export const schema = {
  users: {
    cols: {
      id: col.primary(),
      uid: short_uid(),
      name: col.text(),
    },
  },
  ...allPods.schemas,
} satisfies SchemaDef

//
// Schema Helpers
//
function short_uid() {
  return col.text().index('unique')
}

// (Type helpers omitted)
```

Important points to note:

- `const schema` is THE source of truth for the shape of your tables.
- The `col` helper is how you can quickly and easily define columns, with types inferred by TypeScript.
  - You always want to have an `id: col.primary()` column. Every time I've tried to skip this, I've regretted it.
- If you need a compound index, you can use the `indexes` field (see below).
- `created_at` and `updated_at` are ALWAYS present in your schema, and automatically set and managed.
  - If you need to access to these fields, you can simply redefine them as a col, but with their special helpers. For example: `created_at: col.created_at()`, or `updated_at: col.updated_at()`
- When defining an enum column, be sure to export the enum value and type separately. This allows you to use the enum values in other parts of your app.

## Column Definitions

The `col` helper has several convenient features:

- Column types
- Column schema definitions
- Foreign key definitions
- Extra column features

### Column types

```ts
col.primary() // Only use this for your `id` column

col.integer() // Basic sqlite type
col.text() // Basic sqlite type
col.blob() // Basic sqlite type

//
// Underlying integer columns
//
col.bigint() // Use as JS BigInt
col.boolean() // Parse and treat as JS boolean
col.timestamp() // unixepoch. Still a JS number, but convert between JS and SQLite forms

//
// Underlying text columns
//
col.json<MyType>() // Parse and treat as JS object as given type. No validation performed.
col.uuid() // Uses the uuid package to generate a v4 uuid as a string

// You SHOULD define AND export enum values in a separate variable so other parts of your app can use them.
export type MyEnum = (typeof myEnum)[number]
export const myEnum = ['foo', 'bar'] as const
col.enum(myEnum) // Parse as a string of given options. Validated on write.

//
// Underlying binary columns
//
col.uuid_binary() // Uses the uuid package to generate a v4 uuid as a binary. Sucks to debug, don't recommend.
```

### Column schema definitions

In these examples we use `col.text()`, but you can use any basic SQLite column type.

```ts
col.text().index() // Creates an index for this column
col.text().index('unique') // Creates a unique index for this column

// Makes this column nullable (cols are non-nullable by default in Cofound)
col.text().nullable()

// Sets the default value TO A SQLITE VALUE (NOT A JS VALUE!)
// This is why the inner quotes are needed!!
col.text().default(`'foo'`)
```

### Foreign key definitions

Single-column foreign keys are defined using the `.references()` helper.

HOWEVER, the **shorthand** requires you to name your tables in a certain manner.

Let me explain with an example:

```ts
const schema = {
  users: { cols: { id: col.primary() } },
  orgs: { cols: { id: col.primary() } },

  memberships: {
    cols: {
      id: col.primary(),

      //
      // Sets this column to be a foreign key reference to the `users` table.
      // The table name is INFERRED by the key `user_id` by simply
      // removing the `_id` and adding an `s`.
      //
      user_id: col.integer().references(),

      //
      // If your table name does not follow this convention,
      // you can simply be explicit like so.
      //
      author_id: col.integer().references('users.id'),
    },
  },
}
```

### Extra column features

```ts
// Sets a default SQLite value for a column, but ONLY ON MIGRATE.
// Very useful for defining a new column that you want to be non-nullable.
col.text().sourceDataFrom(`'foo-' || id`)

// Defines automatic transformations when INSERTing or SELECTing values.
// Use this sparingly, and only for well-defined data shapes that won't change over time.
// Otherwise, the complexity should live in your model file.
col.text().transform<RepoSrc>({
  serialize: (src) => {
    // Store in db as a string, e.g. 'github:gilbert/cofound'
    return `${src.platform}:${src.owner}/${src.repo}`
  },
  deserialize: (src) => {
    const pieces = src.match(new RegExp(`([a-z]+):([^/]+)\/([^/]+)`))
    if (!pieces) throw new Error(`Invalid repo src: ${src}`)

    // Parse from db into an object
    return { platform: pieces[1]! as RepoPlatform, owner: pieces[2]!, repo: pieces[3]! }
  },
})
// (Defined here for the sake of the example)
type RepoSrc = { platform: RepoPlatform; owner: string; repo: string }
type RepoPlatform = 'github' | 'gitea'
```

## Index Definitions

Most of the time you will just need `.index()`, e.g. `col.text().index()`.

But for custom indexes, you can use the `indexes` field in your schema definition:

```ts
export const schema = {
  projects: {
    cols: {
      id: col.primary(),
      uid: short_uid(),
    },
  },
  deployments: {
    cols: {
      id: col.primary(),
      uid: short_uid(),
      project_id: col.integer().references(),
    },
    indexes: [
      // Deployment uids are short, so we ensure uniqueness per project
      `CREATE UNIQUE INDEX deployments_uid ON deployments(project_id, uid)`,
    ],
  },
}
```
