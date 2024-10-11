import color from 'sin/bin/color'

import { objectEntries, objectKeys } from '../../shared/object-utils'
import { BaseDbConn } from './make-db'
import { Column, SchemaDef, SchemaExtra, col, datatypeToSql } from './schema'

type Options = {
  db: BaseDbConn
  env: { name: string }
  schema: SchemaDef
  schemaExtra?: SchemaExtra<any>
  /**
   * If undefined, then attempts to migrate no matter what.
   * If string, then only migrates if the target version has not been applied.
   * If false, then throws an error if unapplied migration changes are present.
   * */
  targetVersion?: string | false
}
export function migrateAppDatabase({
  db,
  env,
  schema,
  schemaExtra = {},
  targetVersion,
}: Options): boolean {
  let shouldApply = targetVersion === undefined ? true : false
  if (targetVersion) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    const applied = db.prepare<[], { name: string }>(`SELECT name FROM ${MIGRATIONS_TABLE}`).all()
    if (!applied.find((m) => m.name === targetVersion)) {
      shouldApply = true
    }
  }

  const actualTables = db
    .prepare<
      [],
      { name: string }
    >(`SELECT name FROM sqlite_schema WHERE type = 'table' AND name != 'sqlite_sequence'`)
    .all()

  const actualColumns = new Map<string, SqlColumn[]>()

  const actualIndexes = db
    .prepare<[], SqlIndex>(`SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index'`)
    .all()

  let newIndexes = new Map<string, string[]>()
  let tablesChanged = new Set<string>()

  // Sort actual tables by sort order of schema
  const schemaKeys = Object.keys(schema)
  actualTables.sort((a, b) => {
    const aIndex = schemaKeys.indexOf(a.name)
    const bIndex = schemaKeys.indexOf(b.name)
    return aIndex - bIndex
  })

  // Check for schema changes
  for (let { name } of actualTables) {
    const fkeys = db
      .prepare<string, SqlForeignKey>(`SELECT * FROM pragma_foreign_key_list(?)`)
      .all(name)

    const columns = db
      .prepare<string, SqlColumn>(`SELECT * FROM pragma_table_info(?)`)
      .all(name)
      .map((row) => ({
        ...row,
        fk: !!fkeys.find((fk) => fk.from === row.name),
      }))

    actualColumns.set(name, columns)

    const tableSchema = schema[name as keyof typeof schema]
    if (!tableSchema) {
      if (name !== MIGRATIONS_TABLE) {
        log(`${color.cyan('Skipping')} ${name}`)
      }
      // tablesChanged.add(name)
      continue
    }
    let changed = false
    for (let [colname, col] of objectEntries(tableSchema)) {
      // Any change will involve recreating the entire table
      let actualCol = columns.find((c) => c.name === colname)
      if (!actualCol) {
        log(`${color.magenta('New column')} ${name}.${colname}`)
        changed = true
      } else if (actualCol.type !== datatypeToSql(col.datatype)) {
        log(
          `${color.magenta('change type')} ${name}.${colname} (${actualCol.type} -> ${col.datatype})`,
        )
        changed = true
      } else if (colname !== 'id' && Number(actualCol.notnull) !== col.meta.notnull) {
        log(
          `${color.magenta('change notnull')} ${name}.${colname} (${actualCol.notnull} -> ${col.meta.notnull})`,
        )
        changed = true
      } else if (actualCol.dflt_value !== col.meta.default) {
        log(
          `${color.magenta('change default')} ${name}.${colname} (${actualCol.dflt_value} -> ${col.meta.default})`,
        )
        changed = true
      } else if (colname !== 'id' && actualCol.fk !== (col.meta.references !== undefined)) {
        log(
          `${color.magenta('change fk')} ${name}.${colname} (${actualCol.fk} -> ${col.meta.references !== undefined})`,
        )
        changed = true
      } else if (
        colname !== 'id' &&
        col.meta.index &&
        !actualIndexes.find((i) => i.name === `${name}_${colname}`)
      ) {
        log(`${color.magenta('New index')} ${name}.${colname}`)
        const indexes = newIndexes.get(name) || []
        indexes.push(createIndexSql(name, colname, col))
        newIndexes.set(name, indexes)
      }
      if (changed) {
        tablesChanged.add(name)
      }
    }

    // Check for removed columns
    for (let colname of columns.map((c) => c.name)) {
      if (
        !objectKeys(tableSchema).includes(colname) &&
        colname !== 'created_at' &&
        colname !== 'updated_at'
      ) {
        log(`${color.magenta}Remove column${color.reset} ${name}.${colname}`)
        changed = true
        tablesChanged.add(name)
      }
    }
  }

  // Check for new tables
  for (let name of objectKeys(schema)) {
    if (!actualTables.find((t) => t.name === name)) {
      log(`${color.green('New table')} ${name}`)
      tablesChanged.add(name)
    }
  }

  // Check for new custom indexes
  for (const [table, meta] of Object.entries(schemaExtra)) {
    if (!meta) continue
    for (const _idxSql of meta.indexes) {
      const idxSql = normalizeMetaIndex(_idxSql)
      const compare = idxSql.replace(/;$/, '') // Sqlite doesn't store the semicolon
      if (!actualIndexes.find((i) => i.sql === compare)) {
        const indexNameRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)/
        log(`${color.magenta('New index')} ${idxSql.match(indexNameRegex)![1]}`)
        const indexes = newIndexes.get(table) || []
        indexes.push(idxSql)
        newIndexes.set(table, indexes)
      }
    }
  }

  if (tablesChanged.size === 0 && newIndexes.size === 0) {
    log(color.cyan('No schema changes'))
    return false
  } else if (!shouldApply) {
    throw new Error(
      `${color.yellow}Floating changes detected!${color.reset} Run \`cof migrate\` to apply them in dev, or \`cof migrate bump\` to apply them in prod.`,
    )
  }

  // Turn off some checks
  db.prepare(`PRAGMA foreign_keys = OFF`).run()

  log('Applying changes...')

  db.prepare(`BEGIN TRANSACTION`).run()

  for (let name of tablesChanged) {
    // Clear out since we're handing these directly
    newIndexes.delete(name)

    const tableSchema = schema[name as keyof typeof schema]!
    const columns = objectEntries(tableSchema)
      .concat(
        (() => {
          const implicitCols: [string, Column<any>][] = []
          if (!('created_at' in tableSchema)) {
            implicitCols.push(['created_at' as any, col.timestamp().default(`unixepoch('subsec')`)])
          }
          if (!('updated_at' in tableSchema)) {
            implicitCols.push(['updated_at' as any, col.timestamp().default(`unixepoch('subsec')`)])
          }
          return implicitCols
        })(),
      )
      .map(([colname, col]) => {
        if (colname === 'id') {
          return `id INTEGER PRIMARY KEY`
        }
        let sql = `[${colname}] ${datatypeToSql(col.datatype)}`
        if (col.meta.notnull) {
          sql += ' NOT NULL'
        }
        if (col.meta.default) {
          sql += ` DEFAULT (${col.meta.default})`
        }
        if (col.meta.references) {
          const [table, column] = col.meta.references.split('.')
          sql += ` REFERENCES ${table} (${column})`
        } else if (col.meta.references === '') {
          sql += ` REFERENCES ${colname.replace(/_id$/, 's')} (id)`
        }
        return sql
      })
      .join(',\n  ')

    const indexes = objectEntries(tableSchema)
      .filter(([_, col]) => col.meta.index)
      .map(([colname, _]) => createIndexSql(name, colname, tableSchema[colname]!))
      .concat((schemaExtra[name]?.indexes || []).map(normalizeMetaIndex))
      .join('\n')

    // Remove since we're handling them directly
    newIndexes.delete(name)

    if (!actualTables.find((t) => t.name === name)) {
      if (env.name !== 'test') {
        log(`${color.green}Create table${color.reset} ${name}`)
      }
      const sql = `
        CREATE TABLE ${name} (\n  ${columns}\n);
        ${indexes}
      `
      // console.log('CREATE TABLE', sql)
      db.exec(sql)
      continue
    }

    log(`${color.green}Migrate table${color.reset} ${name}`)

    const colPairs = objectKeys(tableSchema)
      .filter(
        (c) =>
          // Copy over existing columns and new columns with a data source
          actualColumns.get(name)!.find((col) => col.name === c) ||
          tableSchema[c]!.meta.sourceDataFrom,
      )
      .map((c) => {
        // If column is new, use its source if present
        const source =
          (!actualColumns.get(name)!.find((col) => col.name === c) &&
            tableSchema[c]!.meta.sourceDataFrom) ||
          `[${c}]`
        return [`[${c}]`, source]
      })
      .concat([
        ['created_at', 'created_at'],
        ['updated_at', 'updated_at'],
      ])

    const sql = `
      CREATE TABLE new_${name} (\n  ${columns}\n);

      INSERT INTO new_${name} (${colPairs.map((x) => x[0]).join(', ')})
        SELECT ${colPairs.map((x) => x[1]).join(', ')}
        FROM ${name};

      DROP TABLE ${name};
      ALTER TABLE new_${name} RENAME TO ${name};
      ${indexes}
      PRAGMA foreign_key_check;
    `
    // console.log('CHANGE TABLE', sql)
    db.exec(sql)
  }

  for (let [tablename, indexes] of newIndexes) {
    log(`${color.green}Create indexes (${indexes.length})${color.reset} ${tablename}`)
    const deletes = indexes.map((sql) => `DROP INDEX IF EXISTS ${getIndexName(sql)};`)
    db.exec(deletes.join('\n'))
    db.exec(indexes.join('\n'))
  }

  if (targetVersion) {
    db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`).run(targetVersion)
  }

  db.prepare(`COMMIT`).run()

  // Turn checks back on
  // Must be done AFTER transaction
  db.prepare(`PRAGMA foreign_keys = ON`).run()

  return true

  function log(message: string) {
    if (env.name !== 'test') {
      console.log(message)
    }
  }
}

const MIGRATIONS_TABLE = 'cf_migrations'

function createIndexSql(table: string, colname: string, col: Column<any>) {
  const unique = col.meta.index === 'unique' ? 'UNIQUE ' : ''
  return `CREATE ${unique}INDEX ${table}_${colname} ON ${table} (${colname});`
}

function getIndexName(createIndexSql: string) {
  const match = createIndexSql.match(/INDEX\s+(\w+)/i)
  if (!match) {
    throw new Error('Could not find index name')
  }
  return match[1]
}

function normalizeMetaIndex(sql: string) {
  return sql.trim().replace(/;+$/, '') + ';'
}

type SqlColumn = {
  cid: number
  name: string
  type: 'TEXT' | 'INTEGER'
  notnull: 0 | 1
  dflt_value: string | null
  pk: 0 | 1
}
type SqlIndex = {
  sql: string
  name: string
  tbl_name: string
}
type SqlForeignKey = {
  id: number
  seq: number
  table: string
  /** Column name */
  from: string
  /** Column name */
  to: string
  on_update: string
  on_delete: string
  match: string
}
