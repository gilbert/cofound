import s from 'cos'

// State lives at module scope — initialized once
let schema = null
let rows = []
let editing = null // { rowIdx, colIdx, value }
let active = null  // { rowIdx, colIdx }
let selected = new Set() // "rowIdx,colIdx" strings
let loaded = false

function cellKey(r, c) { return r + ',' + c }

function selectCell(rowIdx, colIdx, shiftKey) {
  if (shiftKey && active) {
    // Rectangular range from active to target
    const r0 = Math.min(active.rowIdx, rowIdx)
    const r1 = Math.max(active.rowIdx, rowIdx)
    const c0 = Math.min(active.colIdx, colIdx)
    const c1 = Math.max(active.colIdx, colIdx)
    selected = new Set()
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        selected.add(cellKey(r, c))
  } else {
    active = { rowIdx, colIdx }
    selected = new Set([cellKey(rowIdx, colIdx)])
  }
  // Cancel editing if we move away
  if (editing && (editing.rowIdx !== active.rowIdx || editing.colIdx !== active.colIdx)) {
    editing = null
  }
}

function getSelectedBounds() {
  if (selected.size === 0) return null
  let minRow = Infinity, maxRow = -1, minCol = Infinity, maxCol = -1
  for (const key of selected) {
    const [r, c] = key.split(',').map(Number)
    if (r < minRow) minRow = r
    if (r > maxRow) maxRow = r
    if (c < minCol) minCol = c
    if (c > maxCol) maxCol = c
  }
  return { minRow, maxRow, minCol, maxCol }
}

export default function Sheet(api, table) {
  const base = api + '/' + table
  const schemaUrl = api + '/_schema/' + table

  if (!loaded) {
    loaded = true
    s.http.get(schemaUrl).then(r => { schema = r; s.redraw() })
    s.http.get(base).then(r => {
      rows = r
      if (rows.length > 0) selectCell(0, 0, false)
      s.redraw()
    })
  }

  if (!schema) return s`p c #999`('Loading...')

  const visibleCols = Object.keys(schema.cols).filter(c => !schema.cols[c].primary)
  const colLabels = visibleCols.map(c => schema.labels[c] || c)

  if (!active && rows.length > 0) {
    selectCell(0, 0, false)
  }

  function selectColumn(colIdx) {
    active = { rowIdx: 0, colIdx }
    selected = new Set()
    for (let r = 0; r < rows.length; r++)
      selected.add(cellKey(r, colIdx))
    editing = null
  }

  function selectRow(rowIdx) {
    active = { rowIdx, colIdx: 0 }
    selected = new Set()
    for (let c = 0; c < visibleCols.length; c++)
      selected.add(cellKey(rowIdx, c))
    editing = null
  }

  function isColumnFullySelected(colIdx) {
    if (rows.length === 0) return false
    for (let r = 0; r < rows.length; r++)
      if (!selected.has(cellKey(r, colIdx))) return false
    return true
  }

  function isRowFullySelected(rowIdx) {
    if (visibleCols.length === 0) return false
    for (let c = 0; c < visibleCols.length; c++)
      if (!selected.has(cellKey(rowIdx, c))) return false
    return true
  }

  async function addRow() {
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

  async function commitEdit() {
    if (!editing) return
    const row = rows[editing.rowIdx]
    const col = visibleCols[editing.colIdx]
    let value = editing.value
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

  function getWrapper() {
    return document.getElementById('sheet')
  }

  function focusWrapper() {
    const el = getWrapper()
    if (el) el.focus()
  }

  function focusEditInput() {
    const input = document.querySelector('tbody input[type="text"], tbody input[type="number"]')
    if (input) { input.focus(); input.select() }
  }

  function startEdit(rowIdx, colIdx) {
    const col = visibleCols[colIdx]
    if (!schema.editable.includes(col)) return
    const colInfo = schema.cols[col]
    if (colInfo.type === 'boolean' || colInfo.type === 'enum') return
    const value = rows[rowIdx][col]
    editing = { rowIdx, colIdx, value: value != null ? String(value) : '' }
    s.redraw.force().then(focusEditInput)
  }

  function copySelection(e) {
    e.preventDefault()
    const bounds = getSelectedBounds()
    if (!bounds) return
    const lines = []
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      const cells = []
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const col = visibleCols[c]
        const val = rows[r][col]
        let str = val != null ? String(val) : ''
        if (str.includes('\t') || str.includes('\n') || str.includes('"')) {
          str = '"' + str.replace(/"/g, '""') + '"'
        }
        cells.push(str)
      }
      lines.push(cells.join('\t'))
    }
    navigator.clipboard.writeText(lines.join('\n'))
  }

  function onkeydown(e) {
    if (!active) return
    e.redraw = false
    const { rowIdx, colIdx } = active
    const maxRow = rows.length - 1
    const maxCol = visibleCols.length - 1

    if (editing) {
      if (e.key === 'Escape') {
        e.preventDefault()
        editing = null
        s.redraw.force().then(focusWrapper)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        commitEdit().then(focusWrapper)
      } else if (e.key === 'Tab') {
        e.preventDefault()
        commitEdit().then(() => {
          const next = e.shiftKey ? colIdx - 1 : colIdx + 1
          if (next >= 0 && next <= maxCol) selectCell(rowIdx, next, false)
          s.redraw()
        })
      }
      return
    }

    // Copy
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      copySelection(e)
      return
    }

    // Navigation
    let newRow = rowIdx, newCol = colIdx, handled = false
    if (e.key === 'ArrowUp' && rowIdx > 0) { newRow--; handled = true }
    else if (e.key === 'ArrowDown' && rowIdx < maxRow) { newRow++; handled = true }
    else if (e.key === 'ArrowLeft' && colIdx > 0) { newCol--; handled = true }
    else if (e.key === 'ArrowRight' && colIdx < maxCol) { newCol++; handled = true }
    else if (e.key === 'Tab') {
      e.preventDefault()
      const next = e.shiftKey ? colIdx - 1 : colIdx + 1
      if (next >= 0 && next <= maxCol) { newCol = next; handled = true }
    }
    else if (e.key === 'Enter') {
      e.preventDefault()
      startEdit(rowIdx, colIdx)
      return
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      const col = visibleCols[colIdx]
      if (schema.editable.includes(col)) {
        const colInfo = schema.cols[col]
        if (colInfo.type !== 'boolean' && colInfo.type !== 'enum') {
          editing = { rowIdx, colIdx, value: '' }
          s.redraw.force().then(focusEditInput)
          return
        }
      }
    }

    // Start editing on printable key press
    if (!handled && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const col = visibleCols[colIdx]
      if (schema.editable.includes(col)) {
        const colInfo = schema.cols[col]
        if (colInfo.type !== 'boolean' && colInfo.type !== 'enum') {
          editing = { rowIdx, colIdx, value: e.key }
          e.preventDefault()
          s.redraw.force().then(focusEditInput)
          return
        }
      }
    }

    if (handled) {
      e.preventDefault()
      selectCell(newRow, newCol, false)
      s.redraw()
    }
  }

  function cellContent(row, rowIdx, col, colIdx, colInfo) {
    const type = colInfo.type
    const value = row[col]
    const isEditable = schema.editable.includes(col)

    // Boolean: always a checkbox
    if (type === 'boolean' && isEditable) {
      return s`input`({
        type: 'checkbox',
        checked: !!value,
        onchange: e => {
          e.redraw = false
          const r = rows[rowIdx]
          const updated_val = !value
          s.http.patch(base + '/' + r.id, { body: { [col]: updated_val } }).then(updated => {
            rows = rows.map(x => x.id === updated.id ? updated : x)
            s.redraw()
          })
        }
      })
    }

    // Enum: always a select
    if (type === 'enum' && colInfo.options && isEditable) {
      return s`select
        w 100%
        p 4px
        border 1px solid transparent
        border-radius 3px
        font-size 14px
        bc transparent
        outline none
        box-sizing border-box
      `({
        value: value || '',
        onchange: e => {
          e.redraw = false
          const r = rows[rowIdx]
          s.http.patch(base + '/' + r.id, { body: { [col]: e.target.value } }).then(updated => {
            rows = rows.map(x => x.id === updated.id ? updated : x)
            s.redraw()
          })
        }
      },
        colInfo.options.map(opt =>
          s`option`({ value: opt, selected: value === opt }, opt)
        )
      )
    }

    // Text/integer in edit mode
    if (editing && editing.rowIdx === rowIdx && editing.colIdx === colIdx) {
      const inputType = type === 'integer' ? 'number' : 'text'
      return s`input
        w 100%
        p 0
        border none
        outline none
        font-size 14px
        font-family inherit
        line-height 24px
        box-sizing border-box
        bc transparent
      `({
        type: inputType,
        value: editing.value,
        oninput: e => { editing = { ...editing, value: e.target.value }; e.redraw = false },
        onblur: e => {
          e.redraw = false
          commitEdit().then(focusWrapper)
        },
        onkeydown: e => {
          if (e.key === 'Enter') { e.redraw = false; e.target.blur() }
          if (e.key === 'Escape') { editing = null; s.redraw().then(focusWrapper) }
          e.stopPropagation()
        }
      })
    }

    // Display mode
    const display = value != null ? String(value) : ''
    return s`span
      d block
      w 100%
      line-height 24px
      white-space nowrap
      overflow hidden
      text-overflow ellipsis
    `(display)
  }

  function onCellClick(e, rowIdx, colIdx) {
    e.redraw = false
    selectCell(rowIdx, colIdx, e.shiftKey)
    s.redraw.force().then(focusWrapper)
  }

  function onCellDblClick(e, rowIdx, colIdx) {
    startEdit(rowIdx, colIdx)
  }

  function onColumnHeaderClick(e, colIdx) {
    e.redraw = false
    selectColumn(colIdx)
    s.redraw.force().then(focusWrapper)
  }

  function onRowNumberClick(e, rowIdx) {
    e.redraw = false
    selectRow(rowIdx)
    s.redraw.force().then(focusWrapper)
  }

  return s`
    w 100%
    font-size 14px
    outline none
  `({ id: 'sheet', tabindex: 0, onkeydown },
    s`table
      w 100%
      border-collapse collapse
      table-layout fixed
    `(
      // Header
      s`thead`(
        s`tr`(
          // Row number header
          s`th
            p 8px 4px
            bc #f8f9fa
            border 1px solid #e5e7eb
            border-bottom 2px solid #dee2e6
            w 40px
            text-align center
            font-weight 600
            font-size 11px
            c #adb5bd
          `('#'),
          colLabels.map((label, colIdx) => {
            const colSel = isColumnFullySelected(colIdx)
            return s`th
              p 8px 12px
              text-align left
              bc ${colSel ? '#dbeafe' : '#f8f9fa'}
              border 1px solid #e5e7eb
              border-bottom 2px solid #dee2e6
              font-weight 600
              font-size 13px
              c #495057
              overflow hidden
              text-overflow ellipsis
              cursor pointer
              user-select none
              &:hover { bc ${colSel ? '#dbeafe' : '#e9ecef'} }
            `({ onclick: e => onColumnHeaderClick(e, colIdx) }, label)
          }),
          s`th
            p 8px 12px
            bc #f8f9fa
            border 1px solid #e5e7eb
            border-bottom 2px solid #dee2e6
            w 40px
          `('')
        )
      ),
      // Body
      s`tbody`(
        rows.map((row, rowIdx) => {
          const rowSel = isRowFullySelected(rowIdx)
          return s`tr`({ key: row.id },
            // Row number cell
            s`td
              p 6px 4px
              border 1px solid #e5e7eb
              text-align center
              font-size 12px
              c #adb5bd
              bc ${rowSel ? '#dbeafe' : '#f8f9fa'}
              cursor pointer
              user-select none
              &:hover { bc ${rowSel ? '#dbeafe' : '#e9ecef'} }
            `({ onclick: e => onRowNumberClick(e, rowIdx) }, rowIdx + 1),
            visibleCols.map((col, colIdx) => {
              const isActive = active && active.rowIdx === rowIdx && active.colIdx === colIdx
              const isSel = selected.has(cellKey(rowIdx, colIdx))
              const shadow = isActive
                ? 'inset 0 0 0 2px #2563eb'
                : isSel
                  ? 'inset 0 0 0 2px #93c5fd'
                  : 'none'
              return s`td
                p 6px 12px
                border 1px solid #e5e7eb
                box-shadow ${shadow}
                cursor default
                overflow hidden
                user-select none
              `({
                  onclick: e => onCellClick(e, rowIdx, colIdx),
                  ondblclick: e => onCellDblClick(e, rowIdx, colIdx)
                },
                cellContent(row, rowIdx, col, colIdx, schema.cols[col])
              )
            }),
            s`td
              p 6px 8px
              border 1px solid #e5e7eb
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
        }),
        rows.length === 0 && s`tr`(
          s`td
            p 24px 12px
            text-align center
            c #999
            font-style italic
          `({ colspan: visibleCols.length + 2 }, 'No rows yet')
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
