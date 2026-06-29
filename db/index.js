import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import Debug from 'debug'
import { customAlphabet } from './nanoid.js'
import { col, Column, datatypeToSql } from './schema.js'
import { migrate } from './migrate.js'

const log = Debug('cofound:sql')

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

export function makeDb(path) {
  const db = new Database(path)
  db.defaultSafeIntegers()
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.function('uuid_v4', () => crypto.randomUUID())
  return db
}

// ---------------------------------------------------------------------------
// SQL operators
// ---------------------------------------------------------------------------

const $type = Symbol.for('sqlType')
const $in = Symbol.for('in')
const $notEq = Symbol.for('notEq')
const $notNull = Symbol.for('notNull')
const $lt = Symbol.for('lt')
const $lte = Symbol.for('lte')
const $gt = Symbol.for('gt')
const $gte = Symbol.for('gte')
const $like = Symbol.for('like')

export const Sql = {
  in:      (...values) => ({ [$type]: $in, values }),
  notEq:   (value) =>     ({ [$type]: $notEq, value }),
  notNull:                 { [$type]: $notNull },
  lt:      (value) =>     ({ [$type]: $lt, value }),
  lte:     (value) =>     ({ [$type]: $lte, value }),
  gt:      (value) =>     ({ [$type]: $gt, value }),
  gte:     (value) =>     ({ [$type]: $gte, value }),
  like:    (value) =>     ({ [$type]: $like, value }),
}

// ---------------------------------------------------------------------------
// SQL WHERE helpers
// ---------------------------------------------------------------------------

function isObject(v) {
  return typeof v === 'object' && v !== null
}

function whereCol(colName, value) {
  const sqlType = value?.[$type]
  return isObject(value) && !sqlType
    ? whereJson(colName, value)
    : `[${colName}] ${whereValEq(colName, value)}`
}

function whereValEq(bindingName, value) {
  const sqlType = value?.[$type]
  if (value === null) return 'IS NULL'
  if (sqlType === $notNull) return 'IS NOT NULL'
  if (sqlType === $notEq) return `!= @${bindingName}`
  if (sqlType === $in) return `IN (SELECT value FROM json_each(@${bindingName}))`
  if (sqlType === $lt) return `< @${bindingName}`
  if (sqlType === $lte) return `<= @${bindingName}`
  if (sqlType === $gt) return `> @${bindingName}`
  if (sqlType === $gte) return `>= @${bindingName}`
  if (sqlType === $like) return `LIKE @${bindingName} ESCAPE '\\'`
  return `= @${bindingName}`
}

function whereJson(colName, object) {
  const parts = []
  const stack = [{ path: [], obj: object }]
  while (stack.length) {
    const { path, obj } = stack.pop()
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      const p = path.concat(k)
      const sqlType = v?.[$type]
      if (Array.isArray(v)) {
        throw new Error('[Model] Array queries are not currently supported in json columns')
      } else if (isObject(v) && !sqlType) {
        stack.push({ path: path.concat(k), obj: v })
      } else {
        parts.push(`json_extract([${colName}], '$.${p.join('.')}') ${whereValEq(p.join('__'), v)}`)
      }
    }
  }
  return `(${parts.join(' AND ')})`
}

function mapKeys(obj, fn) {
  const result = {}
  for (const key of Object.keys(obj)) {
    result[fn(key)] = obj[key]
  }
  return result
}

function stringifyDebug(obj) {
  try {
    return JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  } catch {
    return '{error-stringifying}'
  }
}

// ---------------------------------------------------------------------------
// Model base class
// ---------------------------------------------------------------------------

export class Model {
  constructor(db, tablename, table) {
    this.db = db
    this.tablename = tablename
    this.table = table
    this.defaultWhere = {}
  }

  findAll(_attrs, extraSql = '') {
    const attrs = { ...this.defaultWhere, ..._attrs }
    const stmt = this.db.prepare(`${this._selectWhere(attrs)} ${extraSql}`)
    return stmt.all(this.serialize(attrs)).map((row) => this.deserialize(row))
  }

  count(_attrs, extraSql = '') {
    const attrs = { ...this.defaultWhere, ..._attrs }
    const whereCols = Object.keys(attrs)
      .filter((c) => attrs[c] !== undefined && c in this.table.cols)
      .map((c) => whereCol(c, attrs[c]))
      .join(' AND ')
    const whereSql = whereCols.length ? `WHERE ${whereCols}` : ''
    const sql = `SELECT COUNT(*) as count FROM ${this.tablename} ${whereSql} ${extraSql}`
    log(sql)
    const result = this.db.prepare(sql).get(this.serialize(attrs))
    return Number(result.count)
  }

  exists(_attrs, extraSql = '') {
    const attrs = { ...this.defaultWhere, ..._attrs }
    const whereCols = Object.keys(attrs)
      .filter((c) => attrs[c] !== undefined && c in this.table.cols)
      .map((c) => whereCol(c, attrs[c]))
      .join(' AND ')
    const whereSql = whereCols.length ? `WHERE ${whereCols}` : ''
    const sql = `SELECT 1 FROM ${this.tablename} ${whereSql} ${extraSql} LIMIT 1`
    log(sql)
    const result = this.db.prepare(sql).get(this.serialize(attrs))
    return result !== undefined && result !== null
  }

  findByOptional(_attrs) {
    const attrs = { ...this.defaultWhere, ..._attrs }
    const stmt = this.db.prepare(`${this._selectWhere(attrs)} LIMIT 1`)
    const row = stmt.get(this.serialize(attrs)) || null
    return row && this.deserialize(row)
  }

  findBy(_attrs) {
    const row = this.findByOptional(_attrs)
    if (!row) {
      throw new Error(`Could not find ${this.tablename} with attrs: ${stringifyDebug(_attrs)}`)
    }
    return row
  }

  insert(attrs) {
    try {
      const id = this._insert(
        attrs,
        (cols, vars) => `INSERT INTO ${this.tablename} (${cols}) VALUES (${vars})`,
      )
      return this._afterInsert(this.tablename, id)
    } catch (error) {
      console.error(`Error inserting into ${this.tablename} values`, attrs)
      throw error
    }
  }

  insertOrIgnore(ignoreCols, attrs) {
    return this._insert(
      attrs,
      (cols, vars) =>
        `INSERT INTO ${this.tablename} (${cols}) VALUES (${vars}) ON CONFLICT (${ignoreCols.join(', ')}) DO NOTHING`,
    )
  }

  insertOrReplace(conflictCols, setCols, attrs) {
    return this._insert(
      attrs,
      (cols, vars) =>
        `INSERT INTO ${this.tablename} (${cols}) VALUES (${vars}) ON CONFLICT (${conflictCols.join(
          ', ',
        )}) DO UPDATE SET ${setCols.map((c) => `[${c}] = excluded.[${c}]`).join(', ')}`,
    )
  }

  updateWhere(where, set) {
    this._update(where, set)
  }

  updateById(id, set) {
    this._update({ id }, set)
  }

  deleteWhere(where) {
    this._delete(where)
  }

  generateUid(length, { column = 'uid', alphabet } = {}) {
    if (!this.table.cols[column]) {
      throw new Error(`Table ${this.tablename} does not have a '${column}' column`)
    }
    let uid = generateUid(length, alphabet)
    while (this.findByOptional({ [column]: uid })) {
      uid = generateUid(length, alphabet)
    }
    return uid
  }

  // --- Internal methods ---

  _selectWhere(where) {
    const cols = Object.keys(where).filter(
      (c) => where[c] !== undefined && c in this.table.cols,
    )
    const whereSql = cols.length
      ? `WHERE ${cols.map((c) => whereCol(c, where[c])).join(' AND ')}`
      : ''
    log(whereSql)
    return `SELECT * FROM ${this.tablename} ${whereSql}`
  }

  _insert(_attrs, getSql) {
    const attrs = { ..._attrs }
    for (const [colName, def] of Object.entries(this.table.cols)) {
      if (def.meta.transform?.default && !(colName in attrs)) {
        attrs[colName] = def.meta.transform.default()
      } else if (def.datatype === 'json' && !(colName in attrs)) {
        attrs[colName] = {}
      }
    }
    const keys = Object.keys(attrs).filter(
      (c) => attrs[c] !== undefined && c in this.table.cols,
    )
    const cols = keys.map((c) => `[${c}]`).join(', ')
    const vars = keys.map((k) => `@${k}`).join(', ')
    const sql = getSql(cols, vars)
    const insertValues = this.serialize(attrs, 'insert')

    log(sql, insertValues)
    this.db.prepare(sql).run(insertValues)

    const row = this.db.prepare(`SELECT last_insert_rowid() as id`).get()
    return Number(row.id)
  }

  _update(_where, set) {
    const where = { ...this.defaultWhere, ..._where }
    const whereCols = Object.keys(where)
      .filter((c) => where[c] !== undefined && c in this.table.cols)
      .map((c) => whereCol(c, where[c]))
      .join(' AND ')
    const setCols = Object.keys(set)
      .filter((c) => set[c] !== undefined && c in this.table.cols)
      .concat('updated_at')
      .map((c) => `[${c}] = @set_${c}`)
      .join(', ')

    const sql = `UPDATE ${this.tablename} SET ${setCols} WHERE ${whereCols}`
    const stmt = this.db.prepare(sql)
    const setValues = mapKeys(
      this.serialize({ ...set, updated_at: Date.now() }, 'insert'),
      (k) => `set_${k}`,
    )
    const whereValues = this.serialize(where)
    log(sql, whereValues, setValues)
    stmt.run({ ...whereValues, ...setValues })
  }

  _delete(_where) {
    const where = { ...this.defaultWhere, ..._where }
    const whereCols = Object.keys(where)
      .filter((c) => where[c] !== undefined && c in this.table.cols)
      .map((c) => whereCol(c, where[c]))
      .join(' AND ')

    const stmt = this.db.prepare(`DELETE FROM ${this.tablename} WHERE ${whereCols}`)
    stmt.run(this.serialize(where))
  }

  serialize(row, mode) {
    const isSelect = mode !== 'insert'
    const values = {}
    for (const k of Object.keys(this.table.cols).concat('created_at', 'updated_at')) {
      if (!(k in row) || row[k] === undefined) continue

      if (k === 'created_at' || k === 'updated_at') {
        // Only serialize implicit timestamp cols if they aren't in table.cols
        // (if they are, the normal column logic handles them)
        if (!(k in this.table.cols)) {
          values[k] = row[k] / 1000
          continue
        }
      }

      const def = this.table.cols[k]
      if (!def) continue
      const datatype = def.datatype

      let val = row[k]
      const sqlType = val?.[$type]

      if (sqlType === $notNull) continue

      if (sqlType === $in) {
        const xs = val.values
        values[k] = JSON.stringify(
          def.meta.transform.serialize ? xs.map(def.meta.transform.serialize) : xs,
        )
        continue
      }

      if (
        sqlType === $notEq ||
        sqlType === $lt ||
        sqlType === $lte ||
        sqlType === $gt ||
        sqlType === $gte ||
        sqlType === $like
      ) {
        val = val.value
      }

      if (datatype === 'enum' && def.options?.enumOptions?.includes(val) === false) {
        throw new Error(
          `Invalid enum value for column '${this.tablename}.${k}': ${JSON.stringify(val)}`,
        )
      }

      if (isSelect && datatype === 'json') {
        const stack = [{ path: [], obj: val }]
        while (stack.length) {
          const { path, obj } = stack.pop()
          for (const key of Object.keys(obj)) {
            const v = obj[key]
            const p = path.concat(key)
            const vSqlType = v?.[$type]
            if (Array.isArray(v)) {
              throw new Error('[Model] Array queries are not currently supported in json columns')
            } else if (isObject(v) && !vSqlType) {
              stack.push({ path: path.concat(key), obj: v })
            } else {
              values[p.join('__')] = vSqlType === $in ? JSON.stringify(v.values) : v
            }
          }
        }
        continue
      }

      values[k] =
        def.meta.transform.serialize
          ? def.meta.transform.serialize(val)
          : val === null
            ? null
            : datatype === 'json'
              ? JSON.stringify(val)
              : datatype === 'boolean'
                ? (val ? 1 : 0)
                : datatype === 'unixepoch'
                  ? val / 1000
                  : val
    }
    return values
  }

  deserialize(row) {
    const values = {}
    for (const k of Object.keys(row)) {
      const def = this.table.cols[k]
      const datatype = k === 'created_at' || k === 'updated_at' ? 'unixepoch' : def?.datatype

      values[k] =
        def?.meta.transform.deserialize
          ? def.meta.transform.deserialize(row[k])
          : row[k] === null
            ? null
            : datatype === 'json'
              ? JSON.parse(row[k])
              : datatype === 'boolean'
                ? !!row[k]
                : datatype === 'unixepoch'
                  ? Number(row[k]) * 1000
                  : datatype === 'integer'
                    ? Number(row[k])
                    : row[k]
    }
    return values
  }

  /** Hook for test infrastructure — override in test setup */
  _afterInsert(tablename, id) { return id }
}

// ---------------------------------------------------------------------------
// UID generation
// ---------------------------------------------------------------------------

const ALPHABET = {
  standard: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  domainFriendly: '0123456789abcdefghijklmnopqrstuvwxyz',
}

export function generateUid(length, alphabet = 'standard') {
  return customAlphabet(ALPHABET[alphabet], length)()
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { col, Column, datatypeToSql } from './schema.js'
export { migrate } from './migrate.js'
