import { Model, migrate } from 'cos/db'

export function crud(db, schema, edits = {}) {
  migrate(db, schema)

  const tables = Object.keys(edits).length ? Object.keys(edits) : Object.keys(schema)

  // Create models for ALL schema tables (not just editable ones) so lookups work
  const allTables = Object.keys(schema)
  const models = {}
  for (const name of allTables) {
    models[name] = new Model(db, name, schema[name])
  }

  function autoDisplayCol(tableName) {
    const table = schema[tableName]
    if (!table) return null
    for (const [col, def] of Object.entries(table.cols)) {
      if (col === 'id') continue
      if (def.datatype === 'text') return col
    }
    return null
  }

  function schemaInfo(name) {
    const table = schema[name]
    const edit = edits[name]
    const editableCols = Array.isArray(edit) ? edit : edit?.editable
    const labels = Array.isArray(edit) ? {} : (edit?.labels || {})
    const display = Array.isArray(edit) ? undefined : edit?.display

    const cols = {}
    for (const [col, def] of Object.entries(table.cols)) {
      const info = {
        type: def.datatype,
        primary: col === 'id' && def.datatype === 'integer',
        nullable: !def.meta.notnull,
        default: def.meta.default,
        options: def.meta.enums,
      }
      if (def.meta.references) {
        info.references = def.meta.references
      }
      cols[col] = info
    }

    const result = {
      cols,
      editable: editableCols || Object.keys(table.cols).filter(c =>
        c !== 'id' && c !== 'created_at' && c !== 'updated_at'
      ),
      labels,
    }
    if (display) result.display = display
    return result
  }

  return function mountRoutes(app, prefix = '/api') {
    app.get(prefix + '/_schema/:table', r => {
      const t = r.params.table
      if (!tables.includes(t)) return r.json({ error: 'Unknown table' }, 404)
      r.json(schemaInfo(t))
    })

    // Lookup endpoint for FK resolution
    app.get(prefix + '/_lookup/:table', r => {
      const t = r.params.table
      if (!models[t]) return r.json({ error: 'Unknown table' }, 404)
      const displayCol = (edits[t] && !Array.isArray(edits[t]) && edits[t].display) || autoDisplayCol(t)
      const rows = models[t].findAll()
      r.json(rows.map(row => ({
        value: row.id,
        label: displayCol ? String(row[displayCol] || '') : String(row.id)
      })))
    })

    for (const t of tables) {
      const model = models[t]
      const info = schemaInfo(t)

      app.get(prefix + '/' + t, r => {
        r.json(model.findAll())
      })

      app.post(prefix + '/' + t, async r => {
        const body = await r.body('json')
        const attrs = {}
        for (const c of info.editable) {
          if (c in body) attrs[c] = body[c]
        }
        const id = model.insert(attrs)
        r.json(model.findBy({ id }), 201)
      })

      app.patch(prefix + '/' + t + '/:id', async r => {
        const row = model.findByOptional({ id: +r.params.id })
        if (!row) return r.json({ error: 'Not found' }, 404)
        const body = await r.body('json')
        const set = {}
        for (const c of info.editable) {
          if (c in body) set[c] = body[c]
        }
        model.updateById(row.id, set)
        r.json(model.findBy({ id: row.id }))
      })

      app.delete(prefix + '/' + t + '/:id', r => {
        const row = model.findByOptional({ id: +r.params.id })
        if (!row) return r.json({ error: 'Not found' }, 404)
        model.deleteWhere({ id: row.id })
        r.json({ ok: true })
      })
    }
  }
}
