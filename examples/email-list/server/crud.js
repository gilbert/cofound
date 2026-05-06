import { Model, migrate } from 'cos/db'

export function crud(db, schema, edits = {}) {
  migrate(db, schema)

  const tables = Object.keys(edits).length ? Object.keys(edits) : Object.keys(schema)
  const models = {}
  for (const name of tables) {
    models[name] = new Model(db, name, schema[name])
  }

  function schemaInfo(name) {
    const table = schema[name]
    const edit = edits[name]
    const editableCols = Array.isArray(edit) ? edit : edit?.editable
    const labels = Array.isArray(edit) ? {} : (edit?.labels || {})

    const cols = {}
    for (const [col, def] of Object.entries(table.cols)) {
      cols[col] = {
        type: def.datatype,
        primary: col === 'id' && def.datatype === 'integer',
        nullable: !def.meta.notnull,
        default: def.meta.default,
        options: def.meta.enums,
      }
    }

    return {
      cols,
      editable: editableCols || Object.keys(table.cols).filter(c =>
        c !== 'id' && c !== 'created_at' && c !== 'updated_at'
      ),
      labels,
    }
  }

  return function mountRoutes(app, prefix = '/api') {
    app.get(prefix + '/_schema/:table', r => {
      const t = r.params.table
      if (!tables.includes(t)) return r.json({ error: 'Unknown table' }, 404)
      r.json(schemaInfo(t))
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
