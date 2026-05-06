import s from 'cos'

// State lives at module scope — initialized once
let schema = null
let rows = []
let editing = null // { rowId, col, value }
let loaded = false

export default function Sheet(api, table) {
  const base = api + '/' + table
  const schemaUrl = api + '/_schema/' + table

  if (!loaded) {
    loaded = true
    s.http.get(schemaUrl).then(r => { schema = r; s.redraw() })
    s.http.get(base).then(r => { rows = r; s.redraw() })
  }

  async function addRow() {
    if (!schema) return
    const attrs = {}
    for (const c of schema.editable) {
      const col = schema.cols[c]
      if (col.type === 'boolean') attrs[c] = false
      else if (col.type === 'integer') attrs[c] = 0
      else attrs[c] = ''
    }
    const row = await s.http.post(base, { body: attrs })
    rows = [...rows, row]
    s.redraw()
  }

  async function updateCell(row, col, value) {
    const colType = schema.cols[col]?.type
    if (colType === 'integer') value = Number(value) || 0
    if (colType === 'boolean') value = !!value

    const updated = await s.http.patch(base + '/' + row.id, { body: { [col]: value } })
    rows = rows.map(r => r.id === updated.id ? updated : r)
    editing = null
    s.redraw()
  }

  async function deleteRow(row) {
    await s.http.delete(base + '/' + row.id)
    rows = rows.filter(r => r.id !== row.id)
    s.redraw()
  }

  function startEdit(rowId, col, currentValue) {
    editing = { rowId, col, value: currentValue != null ? String(currentValue) : '' }
    s.redraw()
  }

  function isEditing(rowId, col) {
    return editing && editing.rowId === rowId && editing.col === col
  }

  function cellEditor(row, col, colInfo) {
    const type = colInfo.type
    const value = row[col]

    // Boolean: always a checkbox
    if (type === 'boolean') {
      return s`input`({
        type: 'checkbox',
        checked: !!value,
        onchange: () => updateCell(row, col, !value)
      })
    }

    // Enum: always a select
    if (type === 'enum' && colInfo.options) {
      return s`select
        w 100%
        p 4px
        border 1px solid #ddd
        border-radius 3px
      `({
        value: value || '',
        onchange: e => updateCell(row, col, e.target.value)
      },
        colInfo.options.map(opt =>
          s`option`({ value: opt, selected: value === opt }, opt)
        )
      )
    }

    // Text/integer: click-to-edit
    if (isEditing(row.id, col)) {
      const inputType = type === 'integer' ? 'number' : 'text'
      return s`input
        w 100%
        p 4px
        border 1px solid #2563eb
        border-radius 3px
        outline none
        box-sizing border-box
      `({
        type: inputType,
        value: editing.value,
        oninput: e => { editing = { ...editing, value: e.target.value } },
        onblur: e => {
          e.redraw = false
          updateCell(row, col, editing.value)
        },
        onkeydown: e => {
          if (e.key === 'Enter') { e.redraw = false; e.target.blur() }
          if (e.key === 'Escape') { editing = null; s.redraw() }
        }
      })
    }

    // Display mode
    return s`span
      d block
      w 100%
      min-height 24px
      cursor pointer
    `({ onclick: () => startEdit(row.id, col, value) },
      value != null ? String(value) : ''
    )
  }

  if (!schema) return s`p c #999`('Loading...')

  const visibleCols = Object.keys(schema.cols).filter(c => !schema.cols[c].primary)
  const colLabels = visibleCols.map(c => schema.labels[c] || c)

  return s`
    w 100%
    font-size 14px
  `(
    s`table
      w 100%
      border-collapse collapse
    `(
      // Header
      s`thead`(
        s`tr`(
          colLabels.map(label =>
            s`th
              p 8px 12px
              text-align left
              bc #f8f9fa
              border-bottom 2px solid #dee2e6
              font-weight 600
              font-size 13px
              c #495057
            `(label)
          ),
          s`th
            p 8px 12px
            bc #f8f9fa
            border-bottom 2px solid #dee2e6
            w 40px
          `('')
        )
      ),
      // Body
      s`tbody`(
        rows.map(row =>
          s`tr
            &:hover { bc #f8f9fa }
          `({ key: row.id },
            visibleCols.map(col =>
              s`td
                p 6px 12px
                border-bottom 1px solid #eee
              `(
                schema.editable.includes(col)
                  ? cellEditor(row, col, schema.cols[col])
                  : s`span c #999`(row[col] != null ? String(row[col]) : '')
              )
            ),
            s`td
              p 6px 8px
              border-bottom 1px solid #eee
              text-align center
            `(
              s`button
                bc transparent
                border none
                c #dc3545
                cursor pointer
                font-size 16px
                p 2px 6px
                border-radius 3px
                &:hover { bc #fee }
              `({ onclick: () => deleteRow(row) }, '\u00d7')
            )
          )
        ),
        rows.length === 0 && s`tr`(
          s`td
            p 24px 12px
            text-align center
            c #999
            font-style italic
          `({ colspan: visibleCols.length + 1 }, 'No rows yet')
        )
      )
    ),
    // Add row button
    s`button
      mt 12px
      p 6px 16px
      bc #f8f9fa
      border 1px solid #dee2e6
      border-radius 4px
      cursor pointer
      font-size 13px
      c #495057
      &:hover { bc #e9ecef }
    `({ onclick: addRow }, '+ Add row')
  )
}
