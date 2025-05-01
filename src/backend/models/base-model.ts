import debug from 'debug'
import { z } from 'zod'

import { OkResult, err, ok } from '../../result'
import {
  Falsey,
  isObject,
  mapKeys,
  objectEntries,
  pickMaybe,
  stringifyDebug,
} from '../../shared/object-utils'
import { BaseDbConn } from '../db/make-db'
import { Insertable, Selectable, TableDef, Updateable } from '../db/schema'
import { UidAlphabet, generateUid } from './generate-uid'

const $sqlType: unique symbol = Symbol.for('sqlType')

const $in: unique symbol = Symbol.for('in')
const $notEq: unique symbol = Symbol.for('notEq')
const $notNull: unique symbol = Symbol.for('notNull')
const $lt: unique symbol = Symbol.for('lt')
const $lte: unique symbol = Symbol.for('lte')
const $gt: unique symbol = Symbol.for('gt')
const $gte: unique symbol = Symbol.for('gte')
const $like: unique symbol = Symbol.for('like')

type NotNull = (typeof Sql)['notNull']
type NotEq<T> = { [$sqlType]: typeof $notEq; value: T }
type In<T> = { [$sqlType]: typeof $in; values: T[] }
type Lt<T> = { [$sqlType]: typeof $lt; value: T }
type Lte<T> = { [$sqlType]: typeof $lte; value: T }
type Gt<T> = { [$sqlType]: typeof $gt; value: T }
type Gte<T> = { [$sqlType]: typeof $gte; value: T }
type Like<T> = { [$sqlType]: typeof $like; value: T }

export const Sql = {
  in: <T>(...values: T[]): In<T> => ({ [$sqlType]: $in, values }),
  notEq: <T>(value: T): NotEq<T> => ({ [$sqlType]: $notEq, value }),
  notNull: { [$sqlType]: $notNull },
  lt: <T>(value: T): Lt<T> => ({ [$sqlType]: $lt, value }),
  lte: <T>(value: T): Lte<T> => ({ [$sqlType]: $lte, value }),
  gt: <T>(value: T): Gt<T> => ({ [$sqlType]: $gt, value }),
  gte: <T>(value: T): Gte<T> => ({ [$sqlType]: $gte, value }),
  like: <T>(value: T): Like<T> => ({ [$sqlType]: $like, value }),
} as const

export abstract class CF_BaseModel<Tb extends TableDef, DbConn extends BaseDbConn> {
  protected abstract tablename: string

  protected abstract table: Tb

  private logSql = debug('cf:sql')

  protected defaultWhere: Partial<Selectable<Tb['cols']>> = {}

  constructor(protected db: DbConn) {}

  makeValidate<Checks extends Partial<Record<keyof Tb['cols'], z.ZodTypeAny>>>(checks: Checks) {
    return function <E extends string>(
      errReason: E,
      errCode: string,
      attrs: Record<keyof Checks, any>,
    ) {
      const result = z.object(checks as any).safeParse(attrs)
      if (!result.success) {
        return err(errReason, errCode, {
          status: 400,
          meta: { issues: result.error.issues, cause: undefined },
        })
      }
      return ok(result.data) as OkResult<z.infer<z.ZodObject<Present<Checks>>>>
    }
  }

  makePick<K extends keyof Tb['cols']>(keys: K[]) {
    return <T extends Record<K, any> | Falsey>(obj: T) => pickMaybe(obj, keys)
  }

  findAll(_attrs: Queryable<Tb['cols']>, extraSql = ''): Selectable<Tb['cols']>[] {
    const attrs = { ...this.defaultWhere, ..._attrs }
    const select = this.db.prepare(`${this._selectWhere(attrs)} ${extraSql}`)
    return select.all(this.serialize(attrs)).map((row) => this.deserialize(row as any) as any)
  }

  count(_attrs: Queryable<Tb['cols']>, extraSql = ''): number {
    const attrs = { ...this.defaultWhere, ..._attrs }
    const whereCols = Object.keys(attrs)
      .filter((c) => (attrs as any)[c] !== undefined && c in this.table.cols)
      .map((c) => whereCol(c, (attrs as any)[c]))
      .join(' AND ')

    // If no cols in query, don't attach WHERE clause
    const whereSql = whereCols.length ? `WHERE ${whereCols}` : ''

    const sql = `SELECT COUNT(*) as count FROM ${this.tablename} ${whereSql} ${extraSql}`
    this.logSql(sql)

    const result = this.db.prepare(sql).get(this.serialize(attrs))
    return (result as any).count
  }

  findByOptional(_attrs: Queryable<Tb['cols']>): Selectable<Tb['cols']> | null {
    const attrs = { ...this.defaultWhere, ..._attrs }
    const select = this.db.prepare(`${this._selectWhere(attrs)} LIMIT 1`)
    const row = (select.get(this.serialize(attrs)) as any) || null
    return row && this.deserialize(row)
  }

  findBy(_attrs: Queryable<Tb['cols']>): Selectable<Tb['cols']> {
    const attrs = { ...this.defaultWhere, ..._attrs }
    return this.assert(
      this.findByOptional(attrs),
      `Could not find ${this.tablename} with attrs: ${stringifyDebug(attrs)}`,
    )
  }

  private _selectWhere(where: Record<string, any>) {
    const cols = Object.keys(where).filter(
      (c) => (where as any)[c] !== undefined && c in this.table.cols,
    )
    // If no cols in query, don't attach WHERE clause
    // This is useful for queries that only want to use custom sql
    const whereSql = cols.length
      ? `WHERE ${cols.map((c) => whereCol(c, where[c])).join(' AND ')}`
      : ''

    this.logSql(whereSql)
    return `SELECT * FROM ${this.tablename} ${whereSql}`
  }

  protected insert(attrs: Insertable<Tb['cols']>) {
    try {
      const id = this._insert(
        attrs,
        (cols, vars) => `INSERT INTO ${this.tablename} (${cols}) VALUES (${vars})`,
      )
      return this.db.randomizeIdsForTesting(this.tablename, Number(id))
    } catch (error) {
      console.error(`Error inserting into ${this.tablename} values`, attrs)
      throw error
    }
  }

  protected insertOrIgnore(ignoreCols: (keyof Tb['cols'])[], attrs: Insertable<Tb['cols']>) {
    return this._insert(
      attrs,
      (cols, vars) =>
        `INSERT INTO ${this.tablename} (${cols}) VALUES (${vars}) ON CONFLICT (${ignoreCols.join(', ')}) DO NOTHING`,
    )
  }

  protected insertOrReplace(
    conflictCols: (keyof Tb['cols'])[],
    setOnConflictCols: (keyof Tb['cols'])[],
    attrs: Insertable<Tb['cols']>,
  ) {
    return this._insert(
      attrs,
      (cols, vars) =>
        `INSERT INTO ${this.tablename} (${cols}) VALUES (${vars}) ON CONFLICT (${conflictCols.join(
          ', ',
        )}) DO UPDATE SET ${setOnConflictCols.map((c) => `[${String(c)}] = excluded.[${String(c)}]`).join(', ')}`,
    )
  }

  private _insert(_attrs: Insertable<Tb['cols']>, getSql: (cols: string, vars: string) => string) {
    const attrs = { ..._attrs }
    for (let [col, def] of objectEntries(this.table.cols)) {
      if (def.meta.transform?.default && !(col in attrs)) {
        ;(attrs as any)[col] = def.meta.transform.default()
      } else if (def.datatype === 'json' && !(col in attrs)) {
        ;(attrs as any)[col] = {}
      }
    }
    const keys = Object.keys(attrs).filter(
      (c) => (attrs as any)[c] !== undefined && c in this.table.cols,
    )
    const cols = keys.map((c) => `[${c}]`).join(', ')
    const vars = keys.map((k) => `@${k}`).join(', ')
    const sql = getSql(cols, vars)
    const insertValues = this.serialize(attrs, 'insert')

    this.logSql(sql, insertValues)
    this.db.prepare(sql).run(insertValues)

    const row = this.db.prepare(`SELECT last_insert_rowid() as id`).get()
    return (row as any).id as number
  }

  protected updateWhere(where: Partial<Selectable<Tb['cols']>>, set: Updateable<Tb['cols']>) {
    this._update(where, set)
  }

  protected updateById(id: number, set: Updateable<Tb['cols']>) {
    // @ts-expect-error
    this._update({ id }, set)
  }

  private _update(_where: Partial<Selectable<Tb['cols']>>, set: Updateable<Tb['cols']>) {
    const where = { ...this.defaultWhere, ..._where }
    const whereCols = Object.keys(where)
      .filter((c) => (where as any)[c] !== undefined && c in this.table.cols)
      .map((c) => whereCol(c, (where as any)[c]))
      .join(' AND ')
    const setCols = Object.keys(set)
      .filter((c) => (set as any)[c] !== undefined && c in this.table.cols)
      .concat('updated_at')
      .map((c) => `[${c}] = @set_${c}`)
      .join(', ')

    const sql = `UPDATE ${this.tablename} SET ${setCols} WHERE ${whereCols}`
    const update = this.db.prepare(sql)
    const setValues = mapKeys(
      this.serialize({ ...set, updated_at: Date.now() }, 'insert'),
      (k) => `set_${k}`,
    )
    const whereValues = this.serialize(where)
    this.logSql(sql, whereValues, setValues)
    update.run({ ...whereValues, ...setValues })
  }

  protected deleteWhere(where: Partial<Selectable<Tb['cols']>>) {
    this._delete(where)
  }

  private _delete(_where: Partial<Selectable<Tb['cols']>>) {
    const where = { ...this.defaultWhere, ..._where }
    const whereCols = Object.keys(where)
      .filter((c) => (where as any)[c] !== undefined && c in this.table.cols)
      .map((c) => whereCol(c, (where as any)[c]))
      .join(' AND ')

    const deleteQuery = this.db.prepare(`DELETE FROM ${this.tablename} WHERE ${whereCols}`)
    deleteQuery.run(this.serialize(where))
  }

  protected assert<T>(row: T | null | undefined, errorMsg?: string): T {
    if (row === null || row === undefined) {
      throw new Error(errorMsg || `[${this.tablename}] Could not find record`)
    }
    return row
  }

  protected generateUid(
    length: number,
    { column = 'uid', alphabet }: { column?: keyof Tb['cols']; alphabet?: UidAlphabet } = {},
  ) {
    if (!this.table.cols[column as any]) {
      throw new Error(`Table ${this.tablename} does not have a uid column`)
    }
    // TODO: Change to be optimistic for performance
    let uid = generateUid(length, alphabet)
    while (this.findByOptional({ [column]: uid } as any)) {
      uid = generateUid(length, alphabet)
    }
    return uid
  }

  protected serialize = (row: Record<string, any>, mode?: 'select' | 'insert') => {
    const isSelect = mode !== 'insert'
    const values: Record<string, any> = {}
    for (let k of Object.keys(this.table.cols).concat('created_at', 'updated_at')) {
      if (!(k in row) || row[k] === undefined) {
        continue
      }
      if (k === 'created_at' || k === 'updated_at') {
        values[k] = row[k] / 1000
        continue
      }

      const def = this.table.cols[k]!
      const datatype = def.datatype

      let val = row[k]

      const sqlType = val?.[$sqlType]
      if (sqlType === $notNull) {
        // Handled in whereVal (no reference to column value needed)
        continue
      }
      if (sqlType === $in) {
        const xs = (val as In<any>).values
        values[k] = JSON.stringify(
          def.meta.transform.serialize ? xs.map(def.meta.transform.serialize) : xs,
        )
        // No need to check for enum values here as $in should only be used for select queries
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
        val = (val as NotEq<any> | Lt<any> | Lte<any> | Gt<any> | Gte<any>).value
      }

      if (datatype === 'enum' && def.options?.enumOptions?.includes(val) === false) {
        throw new Error(
          `Invalid enum value for column '${this.tablename}.${k}': ${JSON.stringify(val)}`,
        )
      }

      const isMeta = k === 'meta'
      if (isSelect && datatype === 'json') {
        const stack = [{ path: [] as string[], obj: val }]
        while (stack.length) {
          const { path, obj } = stack.pop()!
          for (let k of Object.keys(obj)) {
            const v = obj[k]
            const p = path.concat(k)
            const sqlType = v?.[$sqlType]
            if (Array.isArray(v)) {
              throw new Error(
                `[BaseModel] Array queries are not currently supported in json columns (2)`,
              )
            } else if (isObject(v) && !sqlType) {
              stack.push({ path: path.concat(k), obj: v })
            } else {
              values[p.join('__')] = sqlType === $in ? JSON.stringify((v as In<any>).values) : v
            }
          }
        }
        continue
      }

      // TODO: Less hardcoding
      // prettier-ignore
      values[k] =
        def.meta.transform.serialize
        ? def.meta.transform.serialize(val)
        : val === null
        ? null // Nullable column
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

  protected deserialize = <Row extends Record<string, any>>(
    row: Row,
  ): Selectable<{ [K in keyof Row]: K extends keyof Tb['cols'] ? Tb['cols'][K] : Row[K] }> => {
    const values: Record<string, any> = {}
    for (let k of Object.keys(row)) {
      const def = this.table.cols[k]
      const datatype = k === 'created_at' || k === 'updated_at' ? 'unixepoch' : def?.datatype
      // TODO: Less hardcoding
      // prettier-ignore
      values[k] =
        def?.meta.transform.deserialize
        ? def.meta.transform.deserialize(row[k])
        : row[k] === null
        ? null // Nullable column
        : datatype === 'json'
        ? JSON.parse(row[k])
        : datatype === 'boolean'
        ? (!!row[k] ? true : false)
        : datatype === 'unixepoch'
        ? Number(row[k]) * 1000
        // [ASSUMPTION] db.defaultSafeIntegers() has been called;
        // only leave as bigint if explicitly set
        : datatype === 'integer'
        ? Number(row[k])
        : row[k]
    }
    return values as any
  }
}

function whereCol(col: string, value: any) {
  const sqlType = value?.[$sqlType]
  // prettier-ignore
  return isObject(value) && !sqlType
    ? whereJson(col, value)
    : `[${col}] ${whereValEq(col, value)}`
}

function whereValEq(bindingName: string, value: any) {
  const sqlType = value?.[$sqlType]
  // prettier-ignore
  return value === null
    ? 'IS NULL'
    : sqlType === $notNull
    ? 'IS NOT NULL'
    : sqlType === $notEq
    ? `!= @${bindingName}`
    : sqlType === $in
    ? `IN (SELECT value FROM json_each(@${bindingName}))`
    : sqlType === $lt
    ? `< @${bindingName}`
    : sqlType === $lte
    ? `<= @${bindingName}`
    : sqlType === $gt
    ? `> @${bindingName}`
    : sqlType === $gte
    ? `>= @${bindingName}`
    : sqlType === $like
    ? `LIKE @${bindingName} ESCAPE '\\'`
    : `= @${bindingName}`
}

function whereJson(col: string, object: Record<string, any>) {
  const parts: string[] = []
  const stack = [{ path: [] as string[], obj: object }]
  while (stack.length) {
    const { path, obj } = stack.pop()!
    for (let k of Object.keys(obj)) {
      const v = obj[k]
      const p = path.concat(k)
      const sqlType = v?.[$sqlType]
      if (Array.isArray(v)) {
        throw new Error(`[BaseModel] Array queries are not currently supported in json columns (1)`)
      } else if (isObject(v) && !sqlType) {
        stack.push({ path: path.concat(k), obj: v })
      } else {
        parts.push(`json_extract([${col}], '$.${p.join('.')}') ${whereValEq(p.join('__'), v)}`)
      }
    }
  }
  return `(${parts.join(' AND ')})`
}

//
// Helper types
//
type Queryable<T> = Partial<QueryType<Selectable<T>>>
type QueryType<SelectType> = {
  [K in keyof SelectType]: null extends SelectType[K]
    ? QueryColType<SelectType[K]> | NotNull
    : QueryColType<SelectType[K]>
}

// Use tuples ([x]) to avoid distributive conditional types
type QueryColType<T> = [NonNullable<T>] extends [object]
  ? Partial<QueryType<T>> // Support json queries (objects are assumed to be json)
  :
      | T
      // Remove null from NotEq since user should use NotNull instead
      // (Semantic difference exists between "NOT NULL" and "!=" in sql)
      | NotEq<NonNullable<T>>
      // Remove null since SQLite's IN operator does not support null
      | In<NonNullable<T>>
      | Lt<NonNullable<T>>
      | Lte<NonNullable<T>>
      | Gt<NonNullable<T>>
      | Gte<NonNullable<T>>
      | Like<NonNullable<T>>

type Present<T extends Record<string, any>> = {
  [K in keyof T]: NonNullable<T[K]>
}
