import { bufferToUuidString, stringToUuidBuffer } from '../../shared/buffer-utils'

export type SchemaDef = Record<string, TableDef>
export type TableDef = {
  cols: TableCols
  indexes?: string[]
}
export type TableCols = Record<string, Column<any>>
export type SchemaCols<T extends SchemaDef> = {
  [K in keyof T]: T[K]['cols']
}

export function col<T extends DataType>(type: T, opts?: ColumnOptions): Column<ToTs[T]> {
  return new Column(type, opts)
}

col.text = () => col('text')
col.integer = () => col('integer')
col.bigint = () => col('bigint')
col.blob = () => col('blob')

/** Underlying INTEGER column */
col.boolean = () => col('boolean')

/** Underlying INTEGER column */
col.timestamp = () => col('unixepoch')
col.created_at = () => col.timestamp().default(`unixepoch('subsec')`)
col.updated_at = () => col.timestamp().default(`unixepoch('subsec')`)

/** Underlying TEXT column */
col.enum = <T extends string>(enumOptions: readonly T[]) =>
  col('enum', { enumOptions }) as any as Column<T>

/** Underlying TEXT column */
col.json = <T = {}>() => col('json') as Column<T>

col.uuid = () => col.text().index('unique').default(`uuid_v4()`)

col.uuid_binary = () =>
  col
    .blob()
    .index('unique')
    .transform({
      serialize: stringToUuidBuffer,
      deserialize: bufferToUuidString,
    })
    .default(`uuid_v4_binary()`)

col.generated = <T extends DataType>(type: T): Column<ToTs[T], ToTs[T] | undefined, ToTs[T]> => {
  return new Column(type)
}

// TODO: Support primary in a more idomatic way
col.primary = () => col.generated('integer')

export class Column<SelectType, InsertType = SelectType, UpdateType = SelectType> {
  meta = {
    // SQLite column options
    index: false as boolean | 'unique',
    notnull: 1 as 0 | 1,
    default: null as string | null,

    // Custom column options
    deprecated: false,
    references: undefined as string | undefined,
    enums: undefined as readonly string[] | undefined,
    sourceDataFrom: undefined as string | undefined,
    replaceNullWith: undefined as string | undefined,
    transform: {} as {
      serialize?: (original: any) => SelectType
      deserialize?: (dbValue: SelectType) => any
      default?: () => any
    },
  }

  constructor(
    public datatype: DataType,
    public options?: ColumnOptions,
  ) {
    this.meta.enums = options?.enumOptions
  }

  private set(key: keyof typeof this.meta, value: any) {
    const col = new Column(this.datatype, this.options)
    col.meta = { ...this.meta, [key]: value } as any
    return col
  }

  index(flag: boolean | 'unique' = true): Column<SelectType, InsertType, UpdateType> {
    return this.set('index', flag) as any
  }

  nullable(): Column<
    SelectType | null,
    InsertType | null | undefined,
    UpdateType | null | undefined
  > {
    return this.set('notnull', 0) as any
  }

  /** See [sqlite docs](https://www.sqlite.org/lang_createtable.html#the_default_clause) */
  default(sql: string): Column<SelectType, InsertType | undefined, UpdateType> {
    return this.set('default', sql) as any
  }

  transform<T>(options: {
    serialize: (original: T) => SelectType
    deserialize: (dbValue: SelectType) => T
    /** Generates a value on insert IFF no value is provided */
    default: () => T
  }): Column<T, T | undefined, T>

  transform<T>(options: {
    /** Generates a value on insert IFF no value is provided */
    default: () => SelectType
  }): Column<SelectType, InsertType | undefined, UpdateType>

  transform<T>(options: {
    serialize: (original: T) => SelectType
    deserialize: (dbValue: SelectType) => T
  }): Column<T, T, T>

  transform<T>(options: {
    serialize?: (original: T) => SelectType
    deserialize?: (dbValue: SelectType) => T
    default?: () => T
  }): Column<T, any, T> {
    return this.set('transform', options) as any
  }

  /**
   * Useful for:
   * - Renaming a column
   * - Creating a new, non-nullable column
   * */
  sourceDataFrom(sql: string): Column<SelectType, InsertType, UpdateType> {
    return this.set('sourceDataFrom', sql) as any
  }

  /**
   * Useful for:
   * - Converting an existing nullable column to non-nullable
   * - Providing a fallback value when sourceDataFrom references a nullable column
   *
   * When combined with sourceDataFrom(), generates COALESCE(sourceDataFrom_value, replaceNullWith_value)
   * */
  replaceNullWith(sql: string): Column<SelectType, InsertType, UpdateType> {
    return this.set('replaceNullWith', sql) as any
  }

  /** Marks as deprecated, keeping in schema but throwing type errors on usage */
  deprecated(): Column<unknown, unknown, unknown> {
    if (this.meta.sourceDataFrom) {
      throw new Error('Cannot deprecate a sourced data column; please remove `.sourceDataColumn()`')
    }
    return this.set('deprecated', true) as any
  }

  /**
   * Reference another table's column as a foreign key constraint.
   * If no argument is provided, the column is assumed to reference the primary key of the other table,
   * formatted as e.g. `user_id`.
   *
   * Automatically indexes the column. If you don't want this, call `.index(false)` after `.references()`.
   *
   * NOTE: Implicit call assumes plural by trivially adding an `s`.
   * You'll need to be explicit for non-simple pluralizations.
   *
   * Example usage:
   *
   *     projects: {
   *       user_id: col.integer().references('users.id')
   *       // or
   *       user_id: col.integer().references()
   *     }
   * */
  references(otherTableDotColumn = ''): Column<SelectType, InsertType, UpdateType> {
    return this.set('references', otherTableDotColumn).set('index', true) as any
  }
}

export function datatypeToSql(type: DataType): string {
  switch (type) {
    case 'text':
    case 'json':
    case 'enum':
      return 'TEXT'

    case 'bigint':
    case 'boolean':
    case 'integer':
    case 'unixepoch':
      return 'INTEGER'

    case 'blob':
      return 'BLOB'
  }
}

export type MakeSchemaTypes<Schema extends SchemaDef> = {
  Selects: {
    [K in keyof Schema]: Selectable<Schema[K]>
  }
  Inserts: {
    [K in keyof Schema]: Insertable<Schema[K]>
  }
  Updates: {
    [K in keyof Schema]: Updateable<Omit<Schema[K], 'id'>>
  }
}

//
// Type Manipulators
// Most of these are taken from the Kysely library
//
export type Selectable<R> = DrainOuterGeneric<{
  [K in NonNeverSelectKeys<R>]: SelectType<R[K]>
}>
export type Insertable<R> = DrainOuterGeneric<
  // Prevent id from being specified in insert (type only)
  Omit<
    {
      [K in NonNullableInsertKeys<R>]: InsertType<R[K]>
    } & {
      [K in NullableInsertKeys<R>]?: InsertType<R[K]>
    },
    'id'
  >
>
export type Updateable<R> = DrainOuterGeneric<{
  [K in UpdateKeys<R>]?: UpdateType<R[K]>
}>

type SelectType<T> = T extends Column<infer S, any, any> ? S : T
type InsertType<T> = T extends Column<any, infer I, any> ? I : T
type UpdateType<T> = T extends Column<any, any, infer U> ? U : T

type DataType = 'text' | 'integer' | 'bigint' | 'blob' | 'boolean' | 'json' | 'unixepoch' | 'enum'
type ToTs = {
  blob: Buffer
  enum: string
  json: Record<string, any>
  text: string
  bigint: bigint
  boolean: boolean
  integer: number
  unixepoch: number
}

type ColumnOptions = {
  enumOptions?: readonly string[]
}

type DrainOuterGeneric<T> = [T] extends [unknown] ? T : never
type NonNeverSelectKeys<R> = {
  [K in keyof R]: IfNotNever<SelectType<R[K]>, K>
}[keyof R]
type IfNotNever<T, K> = T extends never ? never : K
type NonNullableInsertKeys<R> = {
  [K in keyof R]: IfNotNullable<InsertType<R[K]>, K>
}[keyof R]
type IfNotNullable<T, K> = undefined extends T
  ? never
  : null extends T
    ? never
    : T extends never
      ? never
      : K
type NullableInsertKeys<R> = {
  [K in keyof R]: IfNullable<InsertType<R[K]>, K>
}[keyof R]
type IfNullable<T, K> = undefined extends T ? K : null extends T ? K : never
type UpdateKeys<R> = {
  [K in keyof R]: IfNotNever<UpdateType<R[K]>, K>
}[keyof R]
