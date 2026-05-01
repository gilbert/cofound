import { col, datatypeToSql } from './schema.js'

const MIGRATIONS_TABLE = 'cos_migrations'

// ANSI escape codes (inline, no dependency)
const cyan = (s) => `\x1b[36m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`
const magenta = (s) => `\x1b[35m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`

/**
 * Auto-migrate: compares declared schema vs actual DB, creates/alters tables.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Record<string, { cols: Record<string, import('./schema.js').Column>, indexes?: string[] }>} schema
 * @param {{ targetVersion?: string | false, silent?: boolean }} [opts]
 * @returns {boolean} true if changes were applied
 */
export function migrate(db, schema, opts = {}) {
  const { targetVersion, silent = false } = opts

  function log(message) {
    if (!silent) console.log(message)
  }

  let shouldApply = targetVersion === undefined ? true : false
  if (targetVersion) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    const applied = db.prepare(`SELECT name FROM ${MIGRATIONS_TABLE}`).all()
    if (!applied.find((m) => m.name === targetVersion)) {
      shouldApply = true
    }
  }

  const actualTables = db
    .prepare(`SELECT name FROM sqlite_schema WHERE type = 'table' AND name != 'sqlite_sequence'`)
    .all()

  const actualColumns = new Map()

  const actualIndexes = db
    .prepare(`SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index'`)
    .all()

  const newIndexes = new Map()
  const tablesChanged = new Set()

  // Sort actual tables by sort order of schema
  const schemaKeys = Object.keys(schema)
  actualTables.sort((a, b) => {
    const aIndex = schemaKeys.indexOf(a.name)
    const bIndex = schemaKeys.indexOf(b.name)
    return aIndex - bIndex
  })

  // Check for schema changes
  for (const { name } of actualTables) {
    const fkeys = db
      .prepare(`SELECT * FROM pragma_foreign_key_list(?)`)
      .all(name)

    const columns = db
      .prepare(`SELECT * FROM pragma_table_info(?)`)
      .all(name)
      .map((row) => ({
        ...row,
        fk: !!fkeys.find((fk) => fk.from === row.name),
      }))

    actualColumns.set(name, columns)

    const tableSchema = schema[name]?.cols
    if (!tableSchema) {
      if (name !== MIGRATIONS_TABLE) {
        log(`${cyan('Skipping')} ${name}`)
      }
      continue
    }

    let changed = false
    for (const [colname, colDef] of Object.entries(tableSchema)) {
      const actualCol = columns.find((c) => c.name === colname)
      if (!actualCol) {
        log(`${magenta('New column')} ${name}.${colname}`)
        changed = true
      } else if (actualCol.type !== datatypeToSql(colDef.datatype)) {
        log(`${magenta('change type')} ${name}.${colname} (${actualCol.type} -> ${colDef.datatype})`)
        changed = true
      } else if (colname !== 'id' && Number(actualCol.notnull) !== colDef.meta.notnull) {
        log(`${magenta('change notnull')} ${name}.${colname} (${actualCol.notnull} -> ${colDef.meta.notnull})`)
        changed = true
      } else if (actualCol.dflt_value !== colDef.meta.default) {
        log(`${magenta('change default')} ${name}.${colname} (${actualCol.dflt_value} -> ${colDef.meta.default})`)
        changed = true
      } else if (colname !== 'id' && actualCol.fk !== (colDef.meta.references !== undefined)) {
        log(`${magenta('change fk')} ${name}.${colname} (${actualCol.fk} -> ${colDef.meta.references !== undefined})`)
        changed = true
      } else if (
        colname !== 'id' &&
        colDef.meta.index &&
        !actualIndexes.find((i) => i.name === `${name}_${colname}`)
      ) {
        log(`${magenta('New index')} ${name}.${colname}`)
        const indexes = newIndexes.get(name) || []
        indexes.push(createIndexSql(name, colname, colDef))
        newIndexes.set(name, indexes)
      }
      if (changed) {
        tablesChanged.add(name)
      }
    }

    // Check for removed columns
    for (const colname of columns.map((c) => c.name)) {
      if (
        !Object.keys(tableSchema).includes(colname) &&
        colname !== 'created_at' &&
        colname !== 'updated_at'
      ) {
        log(`${magenta('Remove column')} ${name}.${colname}`)
        changed = true
        tablesChanged.add(name)
      }
    }
  }

  // Check for new tables
  for (const name of Object.keys(schema)) {
    if (!actualTables.find((t) => t.name === name)) {
      log(`${green('New table')} ${name}`)
      tablesChanged.add(name)
    }
  }

  // Check for new custom indexes
  for (const [tableName, table] of Object.entries(schema)) {
    if (!table.indexes) continue
    for (const _idxSql of table.indexes) {
      const idxSql = normalizeMetaIndex(_idxSql)
      const compare = idxSql.replace(/;$/, '')
      if (!actualIndexes.find((i) => i.sql === compare)) {
        const indexNameRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)/
        log(`${magenta('New index')} ${idxSql.match(indexNameRegex)?.[1]}`)
        const indexes = newIndexes.get(tableName) || []
        indexes.push(idxSql)
        newIndexes.set(tableName, indexes)
      }
    }
  }

  if (tablesChanged.size === 0 && newIndexes.size === 0) {
    log(cyan('No schema changes'))
    return false
  } else if (!shouldApply) {
    throw new Error(
      `${yellow('Floating changes detected!')} Run migrate to apply them.`,
    )
  }

  // Turn off some checks
  db.prepare(`PRAGMA foreign_keys = OFF`).run()

  log('Applying changes...')

  db.prepare(`BEGIN TRANSACTION`).run()

  for (const name of tablesChanged) {
    // Clear out since we're handling these directly
    newIndexes.delete(name)

    const tableSchema = schema[name].cols
    const allCols = Object.entries(tableSchema).concat(
      (() => {
        const implicitCols = []
        if (!('created_at' in tableSchema)) {
          implicitCols.push(['created_at', col.timestamp().default("unixepoch('subsec')")])
        }
        if (!('updated_at' in tableSchema)) {
          implicitCols.push(['updated_at', col.timestamp().default("unixepoch('subsec')")])
        }
        return implicitCols
      })(),
    )

    const columns = allCols
      .map(([colname, colDef]) => {
        if (colname === 'id') {
          // Check if it's a text UUID id or integer primary key
          if (colDef.datatype === 'text') {
            let sql = `id TEXT NOT NULL`
            if (colDef.meta.default) {
              sql += ` DEFAULT (${colDef.meta.default})`
            }
            return sql
          }
          return `id INTEGER PRIMARY KEY`
        }
        let sql = `[${colname}] ${datatypeToSql(colDef.datatype)}`
        if (colDef.meta.notnull) {
          sql += ' NOT NULL'
        }
        if (colDef.meta.default) {
          sql += ` DEFAULT (${colDef.meta.default})`
        }
        if (colDef.meta.references) {
          const [table, column] = colDef.meta.references.split('.')
          sql += ` REFERENCES ${table} (${column})`
        } else if (colDef.meta.references === '') {
          sql += ` REFERENCES ${colname.replace(/_id$/, 's')} (id)`
        }
        return sql
      })
      .join(',\n  ')

    const indexes = Object.entries(tableSchema)
      .filter(([_, colDef]) => colDef.meta.index)
      .map(([colname]) => createIndexSql(name, colname, tableSchema[colname]))
      .concat((schema[name]?.indexes || []).map(normalizeMetaIndex))
      .join('\n')

    // Remove since we're handling them directly
    newIndexes.delete(name)

    if (!actualTables.find((t) => t.name === name)) {
      log(`${green('Create table')} ${name}`)
      const sql = `
        CREATE TABLE ${name} (\n  ${columns}\n);
        ${indexes}
      `
      db.exec(sql)
      continue
    }

    log(`${green('Migrate table')} ${name}`)

    const colPairs = Object.keys(tableSchema)
      .filter(
        (c) =>
          actualColumns.get(name).find((acol) => acol.name === c) ||
          tableSchema[c].meta.sourceDataFrom ||
          tableSchema[c].meta.replaceNullWith,
      )
      .map((c) => {
        const colExists = actualColumns.get(name).find((acol) => acol.name === c)
        const sourceDef = tableSchema[c].meta.sourceDataFrom
        const replaceDef = tableSchema[c].meta.replaceNullWith

        const source = (() => {
          if (!colExists && sourceDef && replaceDef) {
            return `COALESCE(${sourceDef}, ${replaceDef})`
          }
          if (!colExists && sourceDef) {
            return sourceDef
          }
          if (!colExists && replaceDef) {
            return replaceDef
          }
          if (colExists && replaceDef) {
            return `COALESCE([${c}], ${replaceDef})`
          }
          return `[${c}]`
        })()

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
    db.exec(sql)
  }

  for (const [tablename, indexes] of newIndexes) {
    log(`${green(`Create indexes (${indexes.length})`)} ${tablename}`)
    const deletes = indexes.map((sql) => `DROP INDEX IF EXISTS ${getIndexName(sql)};`)
    db.exec(deletes.join('\n'))
    db.exec(indexes.join('\n'))
  }

  if (targetVersion) {
    db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`).run(targetVersion)
  }

  db.prepare(`COMMIT`).run()

  // Turn checks back on — must be done AFTER transaction
  db.prepare(`PRAGMA foreign_keys = ON`).run()

  return true
}

function createIndexSql(table, colname, colDef) {
  const unique = colDef.meta.index === 'unique' ? 'UNIQUE ' : ''
  return `CREATE ${unique}INDEX ${table}_${colname} ON ${table} (${colname});`
}

function getIndexName(createIndexSql) {
  const match = createIndexSql.match(/INDEX\s+(\w+)/i)
  if (!match) throw new Error('Could not find index name')
  return match[1]
}

function normalizeMetaIndex(sql) {
  return sql.trim().replace(/;+$/, '') + ';'
}
