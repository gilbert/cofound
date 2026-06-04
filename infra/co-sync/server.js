import { parseSelect, enforceLimit, tokenize, SqlParseError } from 'co-sql'
import { debounce } from 'co-util'
import { migrate } from 'cofound/db'

export { SqlParseError }

// ---------------------------------------------------------------------------
// BigInt JSON replacer
// ---------------------------------------------------------------------------

function jsonReplacer(key, value) {
  return typeof value === 'bigint' ? Number(value) : value
}

function sendJson(ws, obj) {
  ws.send(JSON.stringify(obj, jsonReplacer))
}

// ---------------------------------------------------------------------------
// SQL rewriting helpers (exported for testing)
// ---------------------------------------------------------------------------

export function rewriteAuthTables(sql, authTables) {
  if (authTables.size === 0) return sql

  const tokens = tokenize(sql)
  const replacements = []

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]

    // Look for FROM or JOIN keyword
    if (tok.type !== 'keyword') continue
    if (tok.value !== 'FROM' && tok.value !== 'JOIN') continue

    const tableIdx = i + 1
    if (tableIdx >= tokens.length) continue
    if (tokens[tableIdx].type !== 'ident') continue

    const tableTok = tokens[tableIdx]
    if (!authTables.has(tableTok.value)) continue

    const cteName = authTables.get(tableTok.value)

    // Check if the table has an alias
    const afterTable = tokens[tableIdx + 1]
    const hasAsKeyword = afterTable && afterTable.type === 'keyword' && afterTable.value === 'AS'
    const hasBareAlias = afterTable && afterTable.type === 'ident'
    const hasAlias = hasAsKeyword || hasBareAlias

    if (hasAlias) {
      // Replace table name with CTE name, keep existing alias
      replacements.push({
        start: tableTok.pos,
        end: tableTok.pos + tableTok.value.length,
        text: cteName,
      })
    } else {
      // No alias: replace table name and add original name as alias
      replacements.push({
        start: tableTok.pos,
        end: tableTok.pos + tableTok.value.length,
        text: cteName + ' ' + tableTok.value,
      })
    }
  }

  // Apply replacements right-to-left to preserve positions
  let result = sql
  for (let j = replacements.length - 1; j >= 0; j--) {
    const r = replacements[j]
    result = result.slice(0, r.start) + r.text + result.slice(r.end)
  }

  return result
}

export function buildAuthCtes(tables, readFilterFor, user) {
  const ctes = []
  const authParams = {}
  const authTables = new Map()
  let authIdx = 0

  for (const table of tables) {
    const filter = readFilterFor(table, user)
    if (filter === true) continue

    const cteName = '__auth_' + table
    const conditions = []

    for (const [col, val] of Object.entries(filter)) {
      const paramName = '__auth_' + authIdx++
      conditions.push('[' + col + '] = @' + paramName)
      authParams[paramName] = val
    }

    ctes.push(
      cteName + ' AS (SELECT * FROM [' + table + '] WHERE ' + conditions.join(' AND ') + ')',
    )
    authTables.set(table, cteName)
  }

  return { ctes, authParams, authTables }
}

export function injectCtes(sql, ctes) {
  if (ctes.length === 0) return sql.trim()
  return 'WITH ' + ctes.join(', ') + ' ' + sql.trim()
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertSafeIdentifier(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error('Unsafe identifier: ' + name)
  }
  if (name.startsWith('__auth_')) {
    throw new Error('Table name prefix __auth_ is reserved')
  }
}

// ---------------------------------------------------------------------------
// sync() — main export
// ---------------------------------------------------------------------------

export function sync(app, db, schema, config) {
  migrate(db, schema)

  const { prefix = '/sync', authenticate, access, defaultLimit = 100, maxLimit = 1000 } = config

  // --- Access rule helpers ---

  function readFilterFor(table, user) {
    const rule = access?.[table]
    if (!rule) throw new Error('No read access for table ' + table)

    const read = typeof rule.read === 'function' ? rule.read(user) : rule.read
    if (read === true) return true
    if (read === false || read == null) throw new Error('No read access for table ' + table)

    return read
  }

  function writeFilterFor(table, user) {
    const rule = access?.[table]
    if (!rule) throw new Error('No write access for table ' + table)

    const write = typeof rule.write === 'function' ? rule.write(user) : rule.write
    if (write === true) return true
    if (write === false || write == null) throw new Error('No write access for table ' + table)

    return write
  }

  function editableColsFor(table) {
    return access?.[table]?.editable
  }

  // --- SQL parsing & auth rewriting ---

  function parseSubscriptionSql(sql, params) {
    const parsed = parseSelect(sql)

    for (const name of parsed.params) {
      if (!Object.hasOwn(params, name)) {
        throw new Error('Missing SQL parameter @' + name)
      }
    }

    for (const name of Object.keys(params)) {
      if (!parsed.params.has(name)) {
        throw new Error('Unexpected SQL parameter @' + name)
      }
    }

    for (const table of parsed.tables) {
      assertSafeIdentifier(table)
      // Validate read access exists (will throw if missing/denied)
    }

    for (const alias of parsed.aliases.keys()) {
      if (alias.startsWith('__auth_')) throw new Error('Alias prefix __auth_ is reserved')
    }

    return parsed
  }

  function buildAuthQuery(sql, parsed, user) {
    const { ctes, authParams, authTables } = buildAuthCtes(
      parsed.tables,
      readFilterFor,
      user,
    )

    let rewrittenSql = rewriteAuthTables(sql, authTables)
    const fullSql = injectCtes(rewrittenSql, ctes)

    return { sql: fullSql, authParams }
  }

  // --- Subscription management ---

  const connections = new Map()

  function handleSubscribe(ws, user, msg) {
    const { id, sql, params = {} } = msg

    try {
      const parsed = parseSubscriptionSql(sql, params)

      // Validate read access for all tables
      for (const table of parsed.tables) {
        readFilterFor(table, user)
      }

      // Enforce LIMIT
      const enforcedSql = enforceLimit(sql, parsed, { maxLimit, defaultLimit })

      // Cap param-based LIMIT at runtime
      const enforcedParams = { ...params }
      if (parsed.limit && parsed.limit.type === 'param') {
        const v = enforcedParams[parsed.limit.value]
        if (typeof v === 'number' && v > maxLimit) {
          enforcedParams[parsed.limit.value] = maxLimit
        }
      }

      const { sql: authSql, authParams } = buildAuthQuery(enforcedSql, parsed, user)
      const allParams = { ...enforcedParams, ...authParams }

      const rows = db.prepare(authSql).all(allParams)
      const resultJson = JSON.stringify(rows, jsonReplacer)

      const subs = connections.get(ws)
      subs.set(id, {
        sql: enforcedSql,
        parsed,
        authSql,
        params: enforcedParams,
        authParams,
        allParams,
        tables: parsed.tables,
        lastResultJson: resultJson,
      })

      sendJson(ws, { type: 'rows', id, rows })
    } catch (err) {
      sendJson(ws, { type: 'error', id, error: err.message })
    }
  }

  function handleUnsubscribe(ws, msg) {
    const subs = connections.get(ws)
    if (subs) subs.delete(msg.id)
  }

  function handleInsert(ws, user, msg) {
    const { id, table, attrs } = msg

    try {
      assertSafeIdentifier(table)
      const filter = writeFilterFor(table, user)

      // Validate editable columns
      const editable = editableColsFor(table)
      if (editable) {
        for (const col of Object.keys(attrs)) {
          if (!editable.includes(col)) {
            throw new Error('Column ' + col + ' is not editable')
          }
        }
      }

      // Merge auth filter values into attrs
      const insertAttrs = { ...attrs }
      if (filter !== true) {
        for (const [col, val] of Object.entries(filter)) {
          insertAttrs[col] = val
        }
      }

      // Build and run INSERT
      const cols = Object.keys(insertAttrs)
      const colsSql = cols.map(c => '[' + c + ']').join(', ')
      const valsSql = cols.map(c => '@' + c).join(', ')
      const insertSql = 'INSERT INTO [' + table + '] (' + colsSql + ') VALUES (' + valsSql + ')'

      db.prepare(insertSql).run(insertAttrs)
      const { id: rowId } = db.prepare('SELECT last_insert_rowid() as id').get()

      sendJson(ws, { type: 'ack', id, rowId: Number(rowId) })
      notifyTable(table)
    } catch (err) {
      sendJson(ws, { type: 'error', id, error: err.message })
    }
  }

  function handleUpdate(ws, user, msg) {
    const { id, table, rowId, attrs } = msg

    try {
      assertSafeIdentifier(table)
      const filter = writeFilterFor(table, user)

      // Validate editable columns
      const editable = editableColsFor(table)
      if (editable) {
        for (const col of Object.keys(attrs)) {
          if (!editable.includes(col)) {
            throw new Error('Column ' + col + ' is not editable')
          }
        }
      }

      // Build WHERE with auth filter
      const whereParts = ['[id] = @__where_id']
      const whereParams = { __where_id: rowId }

      if (filter !== true) {
        let i = 0
        for (const [col, val] of Object.entries(filter)) {
          const paramName = '__where_' + i++
          whereParts.push('[' + col + '] = @' + paramName)
          whereParams[paramName] = val
        }
      }

      const setCols = Object.keys(attrs).map(c => '[' + c + '] = @' + c).join(', ')
      const updateSql =
        'UPDATE [' + table + '] SET ' + setCols + ' WHERE ' + whereParts.join(' AND ')

      const result = db.prepare(updateSql).run({ ...attrs, ...whereParams })

      if (Number(result.changes) === 0) {
        throw new Error('Row not found or unauthorized')
      }

      sendJson(ws, { type: 'ack', id })
      notifyTable(table)
    } catch (err) {
      sendJson(ws, { type: 'error', id, error: err.message })
    }
  }

  function handleDelete(ws, user, msg) {
    const { id, table, rowId } = msg

    try {
      assertSafeIdentifier(table)
      const filter = writeFilterFor(table, user)

      const whereParts = ['[id] = @__where_id']
      const whereParams = { __where_id: rowId }

      if (filter !== true) {
        let i = 0
        for (const [col, val] of Object.entries(filter)) {
          const paramName = '__where_' + i++
          whereParts.push('[' + col + '] = @' + paramName)
          whereParams[paramName] = val
        }
      }

      const deleteSql =
        'DELETE FROM [' + table + '] WHERE ' + whereParts.join(' AND ')
      const result = db.prepare(deleteSql).run(whereParams)

      if (Number(result.changes) === 0) {
        throw new Error('Row not found or unauthorized')
      }

      sendJson(ws, { type: 'ack', id })
      notifyTable(table)
    } catch (err) {
      sendJson(ws, { type: 'error', id, error: err.message })
    }
  }

  const pendingNotify = new Set()

  function flushNotify() {
    const tables = [...pendingNotify]
    pendingNotify.clear()

    for (const [ws, subs] of connections) {
      for (const [subId, sub] of subs) {
        let affected = false
        for (const t of tables) {
          if (sub.tables.has(t)) { affected = true; break }
        }
        if (!affected) continue

        try {
          const rows = db.prepare(sub.authSql).all(sub.allParams)
          const resultJson = JSON.stringify(rows, jsonReplacer)

          if (resultJson !== sub.lastResultJson) {
            sub.lastResultJson = resultJson
            sendJson(ws, { type: 'rows', id: subId, rows })
          }
        } catch (err) {
          sendJson(ws, { type: 'error', id: subId, error: err.message })
        }
      }
    }
  }

  const debouncedFlush = debounce(flushNotify, 16)

  function notifyTable(tableName) {
    pendingNotify.add(tableName)
    debouncedFlush()
  }

  // --- WebSocket setup ---

  app.ws(prefix + '/*', {
    upgrade: r => {
      const user = authenticate(r)
      if (!user) {
        r.statusEnd(401)
        return
      }
      return { user }
    },
    open: ws => {
      connections.set(ws, new Map())
    },
    message: (ws, msg) => {
      const data = msg.json
      if (!data || !data.type) return

      const user = ws.user

      switch (data.type) {
        case 'subscribe':
          return handleSubscribe(ws, user, data)
        case 'unsubscribe':
          return handleUnsubscribe(ws, data)
        case 'insert':
          return handleInsert(ws, user, data)
        case 'update':
          return handleUpdate(ws, user, data)
        case 'delete':
          return handleDelete(ws, user, data)
      }
    },
    close: ws => {
      connections.delete(ws)
    },
  })

  return { notify: notifyTable, flush: flushNotify }
}
