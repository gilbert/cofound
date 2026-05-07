# co-sql

Small, dependency-free SQL parser for the `co-sync` query subset.

The parser is intentionally conservative. It accepts the useful `SELECT` shape needed for live sync subscriptions, extracts table names, aliases, and named parameters, and rejects SQL forms that would make auth injection ambiguous.

## API

```js
import { parseSelect, tokenize, SqlParseError } from 'co-sql'

const parsed = parseSelect(`
  SELECT t.*, m.name AS assignee
  FROM tasks t
  LEFT JOIN team_members m ON t.assignee_id = m.id
  WHERE t.status != @done
  ORDER BY t.created_at DESC
`)

console.log(parsed.tables)  // Set { 'tasks', 'team_members' }
console.log(parsed.aliases) // Map { 't' => 'tasks', 'm' => 'team_members' }
console.log(parsed.params)  // Set { 'done' }
```

`parseSelect(sql)` returns:

```js
{
  tables: Set<string>,
  aliases: Map<string, string>,
  params: Set<string>,
}
```

`tokenize(sql)` is exported for tests and diagnostics. Most callers should use `parseSelect`.

## Supported SQL

- `SELECT` queries with a required `FROM`
- Select items: `*`, `table.*`, `column`, `table.column`
- Select aliases with `AS alias` or a bare alias
- `FROM table`, `FROM table alias`, `FROM table AS alias`
- `JOIN`, `INNER JOIN`, `LEFT JOIN`, `LEFT OUTER JOIN`
- `ON` and `WHERE` predicates using `AND`, `OR`, and parentheses
- Comparisons: `=`, `!=`, `<>`, `<`, `<=`, `>`, `>=`
- `IS NULL`, `IS NOT NULL`
- `IN (...)`, `NOT IN (...)` with numbers, `NULL`, or named params
- `ORDER BY column [ASC|DESC]`
- `LIMIT` and `OFFSET` with numbers or named params
- Named params in the form `@name`

## Rejected SQL

- Non-`SELECT` statements
- Client CTEs (`WITH ...`)
- Subqueries
- Functions and aggregate expressions
- `GROUP BY`, `HAVING`, `UNION`
- `RIGHT`, `FULL`, `CROSS`, `NATURAL`, or `USING` joins
- Schema-qualified references like `main.tasks`
- Three-part column references like `main.tasks.id`
- Quoted strings or quoted identifiers
- Comments and semicolons
- Positional params (`?`)
- Named params beginning with reserved prefix `@__auth_`
- Qualified column references whose table or alias is not in scope
- Duplicate table aliases

## Development

Run tests:

```sh
npm test
```

Run the benchmark:

```sh
npm run bench
npm run bench -- 5000
```

The benchmark reports parse throughput for a mixed corpus and several representative supported queries.
