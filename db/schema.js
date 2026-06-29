// Column builder — metadata-only, no types

export function col(type, opts) {
  return new Column(type, opts)
}

col.text = () => col('text')
col.integer = () => col('integer')
col.boolean = () => col('boolean')
col.timestamp = () => col('unixepoch')
col.json = () => col('json')
col.enum = (options) => col('enum', { enumOptions: options })

col.id = () => col.text().index('unique').default('uuid_v4()')
col.primary = () => col('integer')
col.created_at = () => col.timestamp().default("unixepoch('subsec')")
col.updated_at = () => col.timestamp().default("unixepoch('subsec')")

export class Column {
  constructor(datatype, options) {
    this.datatype = datatype
    this.options = options
    this.meta = {
      index: false,
      notnull: 1,
      default: null,
      references: undefined,
      enums: options?.enumOptions,
      sourceDataFrom: undefined,
      replaceNullWith: undefined,
      transform: {},
    }
  }

  _set(key, value) {
    const c = new Column(this.datatype, this.options)
    c.meta = { ...this.meta, [key]: value }
    return c
  }

  nullable() { return this._set('notnull', 0) }
  default(sql) { return this._set('default', sql) }
  index(flag = true) { return this._set('index', flag) }
  transform(opts) { return this._set('transform', opts) }
  sourceDataFrom(sql) { return this._set('sourceDataFrom', sql) }
  replaceNullWith(sql) { return this._set('replaceNullWith', sql) }

  references(otherTableDotColumn = '') {
    return this._set('references', otherTableDotColumn)._set('index', true)
  }
}

export function datatypeToSql(type) {
  switch (type) {
    case 'text':
    case 'json':
    case 'enum':
      return 'TEXT'
    case 'integer':
    case 'boolean':
    case 'unixepoch':
      return 'INTEGER'
    default:
      return 'TEXT'
  }
}
