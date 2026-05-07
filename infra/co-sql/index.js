const KEYWORDS = new Set([
  'AND',
  'AS',
  'ASC',
  'ALTER',
  'BY',
  'CREATE',
  'CROSS',
  'DELETE',
  'DESC',
  'DISTINCT',
  'DROP',
  'FROM',
  'FULL',
  'GROUP',
  'HAVING',
  'IN',
  'INNER',
  'INSERT',
  'IS',
  'JOIN',
  'LEFT',
  'LIMIT',
  'NATURAL',
  'NOT',
  'NULL',
  'OFFSET',
  'ON',
  'OR',
  'ORDER',
  'OUTER',
  'RECURSIVE',
  'RIGHT',
  'SELECT',
  'SET',
  'UNION',
  'UPDATE',
  'USING',
  'VALUES',
  'WHERE',
  'WITH',
])

const JOIN_STARTS = new Set(['JOIN', 'LEFT', 'INNER'])

export class SqlParseError extends Error {
  constructor(message, pos) {
    super(pos == null ? message : message + ' at position ' + pos)
    this.name = 'SqlParseError'
    this.pos = pos
  }
}

export function parseSelect(sql) {
  const parser = new Parser(tokenize(sql))
  return parser.parseSelect()
}

export function tokenize(sql) {
  if (typeof sql !== 'string') throw new SqlParseError('SQL must be a string')

  const tokens = []
  let i = 0

  while (i < sql.length) {
    const ch = sql[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (ch === '-' && sql[i + 1] === '-') throw new SqlParseError('Comments are not supported', i)
    if (ch === '/' && sql[i + 1] === '*') throw new SqlParseError('Comments are not supported', i)
    if (ch === ';') throw new SqlParseError('Semicolons are not supported', i)
    if (ch === '\'' || ch === '"' || ch === '`' || ch === '[') {
      throw new SqlParseError('Quoted strings and identifiers are not supported', i)
    }
    if (ch === '?') throw new SqlParseError('Positional parameters are not supported', i)

    const two = sql.slice(i, i + 2)
    if (two === '!=' || two === '<>' || two === '<=' || two === '>=') {
      tokens.push({ type: 'op', value: two, pos: i })
      i += 2
      continue
    }

    if ('(),.*=<>'.includes(ch)) {
      tokens.push({ type: ch, value: ch, pos: i })
      i++
      continue
    }

    if (ch === '@') {
      const start = i
      i++
      if (!isIdentStart(sql[i])) throw new SqlParseError('Expected parameter name', start)
      while (isIdentPart(sql[i])) i++
      const name = sql.slice(start + 1, i)
      if (name.startsWith('__auth_')) throw new SqlParseError('Parameter prefix @__auth_ is reserved', start)
      tokens.push({ type: 'param', value: name, pos: start })
      continue
    }

    if (isDigit(ch)) {
      const start = i
      while (isDigit(sql[i])) i++
      if (sql[i] === '.') {
        i++
        if (!isDigit(sql[i])) throw new SqlParseError('Expected digit after decimal point', i)
        while (isDigit(sql[i])) i++
      }
      tokens.push({ type: 'number', value: sql.slice(start, i), pos: start })
      continue
    }

    if (isIdentStart(ch)) {
      const start = i
      i++
      while (isIdentPart(sql[i])) i++
      const raw = sql.slice(start, i)
      const upper = raw.toUpperCase()
      tokens.push(KEYWORDS.has(upper)
        ? { type: 'keyword', value: upper, raw, pos: start }
        : { type: 'ident', value: raw, pos: start })
      continue
    }

    throw new SqlParseError('Unsupported token `' + ch + '`', i)
  }

  tokens.push({ type: 'eof', value: '', pos: sql.length })
  return tokens
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens
    this.i = 0
    this.tables = new Set()
    this.aliases = new Map()
    this.scope = new Map()
    this.params = new Set()
    this.columnRefs = []
  }

  parseSelect() {
    this.expectKeyword('SELECT')
    this.parseSelectList()
    this.expectKeyword('FROM')
    this.parseTableFactor()
    this.parseJoins()

    if (this.matchKeyword('WHERE')) this.parsePredicate()
    if (this.matchKeyword('ORDER')) {
      this.expectKeyword('BY')
      this.parseOrderBy()
    }
    if (this.matchKeyword('LIMIT')) this.parseLimitOffsetValue('LIMIT')
    if (this.matchKeyword('OFFSET')) this.parseLimitOffsetValue('OFFSET')

    this.expect('eof', 'Expected end of query')
    this.validateColumnRefs()

    return {
      tables: this.tables,
      aliases: this.aliases,
      params: this.params,
    }
  }

  parseSelectList() {
    this.parseSelectItem()
    while (this.match(',')) this.parseSelectItem()
  }

  parseSelectItem() {
    if (this.match('*')) return

    const ref = this.parseColumnRef({ allowStar: true })

    if (this.matchKeyword('AS')) {
      if (ref.column === '*') throw new SqlParseError('Star select items cannot be aliased', ref.pos)
      this.expectIdent('Expected select alias')
      return
    }

    if (this.peek().type === 'ident') {
      if (ref.column === '*') throw new SqlParseError('Star select items cannot be aliased', ref.pos)
      this.next()
      return
    }

    return ref
  }

  parseTableFactor() {
    const table = this.expectIdent('Expected table name')
    if (this.match('.')) throw new SqlParseError('Schema-qualified table references are not supported', table.pos)

    let alias = null
    if (this.matchKeyword('AS')) {
      alias = this.expectIdent('Expected table alias')
    } else if (this.peek().type === 'ident') {
      alias = this.next()
    }

    this.addTable(table, alias)
  }

  parseJoins() {
    while (this.isJoinStart()) {
      if (this.matchKeyword('LEFT')) {
        this.matchKeyword('OUTER')
        this.expectKeyword('JOIN')
      } else if (this.matchKeyword('INNER')) {
        this.expectKeyword('JOIN')
      } else {
        this.expectKeyword('JOIN')
      }

      this.parseTableFactor()
      this.expectKeyword('ON')
      this.parsePredicate()
    }
  }

  parseOrderBy() {
    this.parseOrderingTerm()
    while (this.match(',')) this.parseOrderingTerm()
  }

  parseOrderingTerm() {
    this.parseColumnRef()
    if (this.matchKeyword('ASC')) return
    this.matchKeyword('DESC')
  }

  parseLimitOffsetValue(label) {
    const tok = this.peek()
    if (this.match('param')) {
      this.params.add(tok.value)
      return
    }
    if (this.match('number')) return
    throw new SqlParseError('Expected number or named parameter after ' + label, tok.pos)
  }

  parsePredicate() {
    this.parseOr()
  }

  parseOr() {
    this.parseAnd()
    while (this.matchKeyword('OR')) this.parseAnd()
  }

  parseAnd() {
    this.parsePredicatePrimary()
    while (this.matchKeyword('AND')) this.parsePredicatePrimary()
  }

  parsePredicatePrimary() {
    if (this.match('(')) {
      this.parsePredicate()
      this.expect(')', 'Expected `)`')
      return
    }

    const left = this.parseColumnRef()

    if (this.matchKeyword('IS')) {
      this.matchKeyword('NOT')
      this.expectKeyword('NULL')
      return
    }

    if (this.matchKeyword('NOT')) {
      this.expectKeyword('IN')
      this.parseInList()
      return
    }

    if (this.matchKeyword('IN')) {
      this.parseInList()
      return
    }

    if (this.isComparisonOp()) {
      this.next()
      this.parseValueOrColumn()
      return
    }

    throw new SqlParseError('Expected predicate operator after column reference', this.peek().pos)
  }

  parseInList() {
    this.expect('(', 'Expected `(` after IN')
    this.parseValue()
    while (this.match(',')) this.parseValue()
    this.expect(')', 'Expected `)` after IN list')
  }

  parseValueOrColumn() {
    const tok = this.peek()
    if (tok.type === 'param' || tok.type === 'number' || this.isKeyword('NULL')) {
      this.parseValue()
      return
    }
    this.parseColumnRef()
  }

  parseValue() {
    const tok = this.peek()
    if (this.match('param')) {
      this.params.add(tok.value)
      return
    }
    if (this.match('number')) return
    if (this.matchKeyword('NULL')) return
    throw new SqlParseError('Expected parameter, number, or NULL', tok.pos)
  }

  parseColumnRef({ allowStar = false } = {}) {
    const first = this.expectIdent('Expected column reference')

    if (!this.match('.')) {
      const ref = { qualifier: null, column: first.value, pos: first.pos }
      this.columnRefs.push(ref)
      return ref
    }

    if (allowStar && this.match('*')) {
      const ref = { qualifier: first.value, column: '*', pos: first.pos }
      this.columnRefs.push(ref)
      return ref
    }

    const second = this.expectIdent('Expected column name after `.`')
    if (this.match('.')) {
      throw new SqlParseError('Three-part column references are not supported', first.pos)
    }
    const ref = { qualifier: first.value, column: second.value, pos: first.pos }
    this.columnRefs.push(ref)
    return ref
  }

  addTable(tableToken, aliasToken) {
    const table = tableToken.value
    const exposedName = aliasToken ? aliasToken.value : table

    if (this.scope.has(exposedName)) {
      throw new SqlParseError('Duplicate table alias `' + exposedName + '`', (aliasToken || tableToken).pos)
    }

    this.tables.add(table)
    this.scope.set(exposedName, table)
    if (aliasToken) this.aliases.set(aliasToken.value, table)
  }

  validateColumnRefs() {
    for (const ref of this.columnRefs) {
      if (!ref.qualifier) continue
      if (!this.scope.has(ref.qualifier)) {
        throw new SqlParseError('Unknown table or alias `' + ref.qualifier + '`', ref.pos)
      }
    }
  }

  isJoinStart() {
    return this.peek().type === 'keyword' && JOIN_STARTS.has(this.peek().value)
  }

  isComparisonOp() {
    const tok = this.peek()
    return tok.type === '=' || tok.type === '<' || tok.type === '>' || tok.type === 'op'
  }

  isKeyword(value) {
    const tok = this.peek()
    return tok.type === 'keyword' && tok.value === value
  }

  matchKeyword(value) {
    if (this.isKeyword(value)) {
      this.i++
      return true
    }
    return false
  }

  expectKeyword(value) {
    if (this.matchKeyword(value)) return this.tokens[this.i - 1]
    throw new SqlParseError('Expected ' + value, this.peek().pos)
  }

  match(type) {
    if (this.peek().type === type) {
      this.i++
      return true
    }
    return false
  }

  expect(type, message) {
    if (this.match(type)) return this.tokens[this.i - 1]
    throw new SqlParseError(message, this.peek().pos)
  }

  expectIdent(message) {
    if (this.peek().type === 'ident') return this.next()
    throw new SqlParseError(message, this.peek().pos)
  }

  next() {
    return this.tokens[this.i++]
  }

  peek() {
    return this.tokens[this.i]
  }
}

function isIdentStart(ch) {
  return !!ch && /[A-Za-z_]/.test(ch)
}

function isIdentPart(ch) {
  return !!ch && /[A-Za-z0-9_]/.test(ch)
}

function isDigit(ch) {
  return !!ch && /[0-9]/.test(ch)
}
