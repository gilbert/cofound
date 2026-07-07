# Schema & Migrations

Cofound describes your database as a single **declarative schema object** and keeps the SQLite file in sync with it automatically. There are no hand-written migration files: you edit the schema, and `migrate()` diffs the declared shape against the live database and applies the difference.

```js
import { makeDb, migrate, col } from 'cofound/db'

const schema = {
  posts: {
    cols: {
      id: col.primary(),
      title: col.text(),
      body: col.text().default("''"),
      published_at: col.timestamp().nullable(),
      author_id: col.integer().references('users.id'),
    },
    indexes: [
      'CREATE INDEX posts_published ON posts(published_at)',
    ],
  },
}

const db = makeDb('./data.db')
migrate(db, schema)
```

`cofound/db` exports the pieces you need: `makeDb`, `migrate`, `col`, `Column`, `Model`, `Sql`, and `datatypeToSql`.

## The schema object

The schema is a plain object keyed by table name. Each table has:

- `cols` — an object mapping column name to a column definition built with `col`.
- `indexes` (optional) — an array of raw `CREATE INDEX` statements for composite or custom indexes.

```js
const schema = {
  users: {
    cols: {
      id: col.primary(),
      email: col.text().index('unique'),
      role: col.enum(['member', 'admin']).default("'member'"),
    },
  },
  ...jobQueueSchema,   // mix in framework tables (see below)
  ...sessionSchema,
}
```

Framework subsystems ship their own table definitions as schema fragments — spread them into your schema alongside your app tables:

```js
import { jobQueueSchema } from 'cofound/jobs'
import { sessionSchema } from 'cofound/sessions'

migrate(db, { ...jobQueueSchema, ...sessionSchema, posts: { cols: { /* ... */ } } })
```

## Columns: the `col` builder

`col` is a metadata-only builder — it records intent; it does not touch the database. Start from a datatype, then chain modifiers. Every modifier returns a new immutable `Column`, so order does not matter.

### Datatypes

| Builder | SQLite storage | JS value (after read) |
|---|---|---|
| `col.text()` | `TEXT` | string |
| `col.integer()` | `INTEGER` | number |
| `col.boolean()` | `INTEGER` (0/1) | boolean |
| `col.timestamp()` | `INTEGER` (unix seconds, sub-second float) | number (**milliseconds**) |
| `col.json()` | `TEXT` (JSON) | parsed object/array |
| `col.enum([...])` | `TEXT` | string (validated on write) |

Convenience constructors:

- `col.primary()` — an auto-incrementing integer primary key. Use for the `id` column.
- `col.id()` — a text UUID primary key: `col.text().index('unique').default('uuid_v4()')`. Use instead of `col.primary()` when you want opaque string ids.
- `col.created_at()` / `col.updated_at()` — timestamp columns defaulting to `unixepoch('subsec')`. You rarely write these yourself — see [Implicit columns](#implicit-columns).

### Modifiers

- `.nullable()` — allow `NULL`. Columns are **`NOT NULL` by default**.
- `.default(sql)` — a **raw SQL** default expression (see the gotcha below).
- `.index()` / `.index('unique')` — create a single-column index named `<table>_<column>`.
- `.references('table.column')` — declare a foreign key; also marks the column indexed.
- `.transform({ serialize, deserialize, default })` — custom value mapping (see [Custom transforms](#custom-transforms)).
- `.sourceDataFrom(sql)` / `.replaceNullWith(sql)` — data backfill hooks used during a table rebuild (see [Backfilling data](#backfilling-data-during-a-rebuild)).

### Defaults are raw SQL — quote your strings

`.default()` takes a snippet that is spliced directly into `DEFAULT (...)`. This trips people up: a **string** default must include its own SQL quotes.

```js
role:       col.text().default("'member'"),   // ✅ DEFAULT ('member')
role:       col.text().default('member'),      // ❌ DEFAULT (member) → SQL error / column ref
count:      col.integer().default('0'),        // ✅ numbers need no quotes
data:       col.json().default("'{}'"),        // ✅ empty JSON object
created_at: col.timestamp().default("unixepoch('subsec')"),  // ✅ SQL function
```

### Enums

`col.enum([...])` stores text but validates on every write. Assigning a value outside the list throws before it reaches SQLite:

```js
status: col.enum(['open', 'closed']).default("'open'")
// model.insert({ status: 'archived' }) → throws "Invalid enum value for column '<table>.status'"
```

### Foreign keys

`.references('users.id')` emits `REFERENCES users (id)` and indexes the column. `makeDb` turns on `PRAGMA foreign_keys = ON`, so referential integrity is enforced at runtime.

```js
author_id: col.integer().references('users.id'),
author_id: col.integer().references('users.id').nullable(),  // optional relation
```

Called with no argument, `.references()` infers the table by pluralizing the column stem (`author_id → authors.id`). Prefer the explicit form for clarity.

## Implicit columns

Every table automatically gets three columns you don't declare:

- `id` — if you don't define one, but you almost always want `col.primary()` or `col.id()` explicitly.
- `created_at` and `updated_at` — timestamp columns added by `migrate()` when absent, defaulting to `unixepoch('subsec')`.

The `Model` layer sets `updated_at` on every `update`. Both are exposed on read as **millisecond** numbers. Declare them yourself only if you want to override the default or index them.

## Indexes

Single-column indexes come from the column builder:

```js
email:   col.text().index('unique'),   // CREATE UNIQUE INDEX users_email ON users(email)
slug:    col.text().index(),            // CREATE INDEX posts_slug ON posts(slug)
```

Composite or otherwise custom indexes go in the table's `indexes` array as full SQL. `migrate()` compares these by exact (normalized) SQL text, so keep them stable:

```js
indexes: [
  'CREATE UNIQUE INDEX members_team_user ON team_members(team_id, user_id)',
  'CREATE INDEX pings_user_status ON pings(user_id, status)',
]
```

## How auto-migration works

`migrate(db, schema, opts?)` inspects `sqlite_schema` / `pragma_table_info` and compares them to your declared schema. It detects:

- **New tables** → `CREATE TABLE`.
- **New single-column and custom indexes** → `CREATE INDEX` (created without a rebuild).
- **Column changes** on an existing table — a new column, a datatype change, a `NOT NULL` ↔ nullable change, a default change, a foreign-key change, or a removed column.

SQLite cannot alter most column attributes in place, so **any column change triggers a full table rebuild**: `migrate()` creates a `new_<table>` with the target shape, `INSERT … SELECT`s the data across, drops the original, and renames. This happens inside a transaction with `PRAGMA foreign_keys = OFF` and a closing `foreign_key_check`. Adding a brand-new column also goes through this rebuild path (there is no bare `ALTER TABLE ADD COLUMN`).

Because a rebuild copies existing rows, widening changes (e.g. `NOT NULL` → nullable) preserve data automatically. Narrowing or transforming changes may need a backfill hook (below).

`migrate()` returns `true` when it applied changes, `false` when the schema already matched (`"No schema changes"`).

### Apply vs. detect-only

By default `migrate()` applies changes immediately. Pass a `targetVersion` to gate application behind a named migration marker:

```js
migrate(db, schema)                              // apply any pending changes now
migrate(db, schema, { targetVersion: false })    // detect only; throw if changes are pending
migrate(db, schema, { targetVersion: 'v3' })     // apply once, record 'v3' in cofound_migrations
migrate(db, schema, { silent: true })            // suppress the change log
```

When changes are detected but application is disabled, `migrate()` throws `"Floating changes detected! Run migrate to apply them."` — a useful guard in production start-up to force an explicit migration step.

### Backfilling data during a rebuild

Two column modifiers let you control how data lands in the rebuilt table. They matter precisely because a rebuild is a copy:

- **`.replaceNullWith(sql)`** — wraps the copied value in `COALESCE(<value>, <sql>)`. Applies whether or not the column already existed, so it's the hook for backfilling existing `NULL`s (for example, right before you later enforce `NOT NULL`).

  ```js
  // Fill missing display names from the email local-part on the next rebuild.
  display_name: col.text().replaceNullWith("substr(email, 1, instr(email, '@') - 1)"),
  ```

- **`.sourceDataFrom(sql)`** — supplies the `SELECT` expression for a column **only when that column is being newly added** in this rebuild. Use it to derive a new/replacement column from old ones. It is ignored once the column exists.

  ```js
  // New column populated from an old one during the rebuild that introduces it.
  full_name: col.text().sourceDataFrom("first_name || ' ' || last_name"),
  ```

  If both are set on a new column, the source becomes `COALESCE(<sourceDataFrom>, <replaceNullWith>)`.

> **Note on nullability changes:** converting an existing `NOT NULL` column to `.nullable()` is a widening change — the rebuild copies values as-is and needs no backfill. `.sourceDataFrom()` will **not** fire for that column because it already exists; reach for `.replaceNullWith()` if you also want to rewrite existing `NULL`s in the same pass.

## Values in and out: the Model mapping

Models built on `cofound/db`'s `Model` (via `makeModels`) serialize on write and deserialize on read according to each column's datatype, so app code works with natural JS values:

- `json` columns accept objects/arrays and return them parsed. A `json` column with no value on insert defaults to `{}`.
- `boolean` columns store `0/1` and return `true/false`.
- `timestamp` columns are **milliseconds in JS**, stored as unix seconds (sub-second precision) — `Date.now()` in, milliseconds out.
- `integer` columns are coerced to `Number` on read (the database opens with safe-integer mode; the Model layer narrows integer/timestamp/boolean columns for you).
- `enum` values are validated against the allowed list on write.

Querying JSON columns supports nested-path equality (`where: { meta: { plan: 'pro' } }` → `json_extract(...)`), but **array-valued** JSON queries are not supported and throw. See the model/query documentation for the full `Sql.in`, `Sql.gt`, `Sql.like`, etc. operator set.

### Custom transforms

For a column whose stored form differs from its in-memory form, attach a `.transform({ serialize, deserialize, default })`:

```js
tags: col.text().transform({
  serialize:   (arr) => arr.join(','),      // JS → column
  deserialize: (str) => str ? str.split(',') : [],  // column → JS
  default:     () => [],                     // value used on insert when omitted
}),
```

`serialize`/`deserialize` run around every write/read; `default()` supplies an insert-time value when the field is omitted (evaluated in JS, unlike `.default()` which is SQL).

## Gotchas

- **String defaults need embedded quotes** — `.default("'member'")`, not `.default('member')`.
- **Every column change rebuilds the whole table.** It's transactional and safe, but on very large tables it copies all rows — batch schema edits together.
- **Custom `indexes` are matched by exact SQL text.** Reformatting an existing index string makes `migrate()` drop and recreate it.
- **Columns are `NOT NULL` by default.** Add `.nullable()` for optional fields, or the rebuild's `INSERT … SELECT` can fail a `NOT NULL` constraint on legacy `NULL`s (use `.replaceNullWith()` to backfill).
- **Removing a column from the schema drops it** on the next migrate (except the implicit `created_at`/`updated_at`).
- **Schema edits require a process restart** in dev if your server caches the migrated schema at boot.

## See also

- [Jobs](jobs.md) — `jobQueueSchema` mixin and the background queue.
- [Sessions](sessions.md) — `sessionSchema` mixin for user sessions.
- [Routes](routes.md) — using models inside request handlers.
