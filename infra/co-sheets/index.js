import s from 'cos'

// Per-instance state keyed by "api/table"
const instances = new Map()

function getState(key) {
  if (!instances.has(key)) {
    instances.set(key, {
      schema: null,
      rows: [],
      editing: null,   // { rowIdx, colIdx, value }
      active: null,    // { rowIdx, colIdx } — anchor of selection
      cursor: null,    // { rowIdx, colIdx } — moving end
      selected: new Set(),
      copied: null,
      copyOverlayPos: null,
      loaded: false,
      lookups: {},     // { colName: [{value, label}] }
    })
  }
  return instances.get(key)
}

function cellKey(r, c) { return r + ',' + c }

function selectCell(st, rowIdx, colIdx, shiftKey) {
  if (shiftKey && st.active) {
    st.cursor = { rowIdx, colIdx }
    const r0 = Math.min(st.active.rowIdx, rowIdx)
    const r1 = Math.max(st.active.rowIdx, rowIdx)
    const c0 = Math.min(st.active.colIdx, colIdx)
    const c1 = Math.max(st.active.colIdx, colIdx)
    st.selected = new Set()
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        st.selected.add(cellKey(r, c))
  } else {
    st.active = { rowIdx, colIdx }
    st.cursor = { rowIdx, colIdx }
    st.selected = new Set([cellKey(rowIdx, colIdx)])
  }
  if (st.editing && (st.editing.rowIdx !== st.active.rowIdx || st.editing.colIdx !== st.active.colIdx)) {
    st.editing = null
  }
}

function getSelectedBounds(st) {
  if (st.selected.size === 0) return null
  let minRow = Infinity, maxRow = -1, minCol = Infinity, maxCol = -1
  for (const key of st.selected) {
    const [r, c] = key.split(',').map(Number)
    if (r < minRow) minRow = r
    if (r > maxRow) maxRow = r
    if (c < minCol) minCol = c
    if (c > maxCol) maxCol = c
  }
  return { minRow, maxRow, minCol, maxCol }
}

export default function Sheet(api, table) {
  const key = api + '/' + table
  const st = getState(key)
  const base = api + '/' + table
  const schemaUrl = api + '/_schema/' + table
  const sheetId = 'sheet-' + table

  if (!st.loaded) {
    st.loaded = true
    s.http.get(schemaUrl).then(r => { st.schema = r; s.redraw() })
    s.http.get(base).then(r => {
      st.rows = r
      if (st.rows.length > 0) selectCell(st, 0, 0, false)
      s.redraw()
    })
  }

  if (!st.schema) return s`p c #999`('Loading...')

  const visibleCols = Object.keys(st.schema.cols).filter(c => !st.schema.cols[c].primary)
  const colLabels = visibleCols.map(c => st.schema.labels[c] || c)

  // Load FK lookups for any reference columns
  for (const col of visibleCols) {
    const info = st.schema.cols[col]
    if (info.references && !st.lookups[col]) {
      st.lookups[col] = [] // prevent re-fetch
      const refTable = info.references.split('.')[0]
      s.http.get(api + '/_lookup/' + refTable).then(r => {
        st.lookups[col] = r
        s.redraw()
      })
    }
  }

  if (!st.active && st.rows.length > 0) {
    selectCell(st, 0, 0, false)
  }

  function selectColumn(colIdx) {
    st.active = { rowIdx: 0, colIdx }
    st.cursor = { rowIdx: 0, colIdx }
    st.selected = new Set()
    for (let r = 0; r < st.rows.length; r++)
      st.selected.add(cellKey(r, colIdx))
    st.editing = null
  }

  function selectRow(rowIdx) {
    st.active = { rowIdx, colIdx: 0 }
    st.cursor = { rowIdx, colIdx: 0 }
    st.selected = new Set()
    for (let c = 0; c < visibleCols.length; c++)
      st.selected.add(cellKey(rowIdx, c))
    st.editing = null
  }

  function isColumnFullySelected(colIdx) {
    if (st.rows.length === 0) return false
    for (let r = 0; r < st.rows.length; r++)
      if (!st.selected.has(cellKey(r, colIdx))) return false
    return true
  }

  function isRowFullySelected(rowIdx) {
    if (visibleCols.length === 0) return false
    for (let c = 0; c < visibleCols.length; c++)
      if (!st.selected.has(cellKey(rowIdx, c))) return false
    return true
  }

  async function addRow() {
    const attrs = {}
    for (const c of st.schema.editable) {
      const col = st.schema.cols[c]
      if (col.type === 'boolean') attrs[c] = false
      else if (col.type === 'integer' && !col.references) attrs[c] = 0
      else if (col.type === 'unixepoch') continue // skip timestamps
      else attrs[c] = ''
    }
    const row = await s.http.post(base, { body: attrs })
    st.rows = [...st.rows, row]
    s.redraw()
  }

  async function commitEdit() {
    if (!st.editing) return
    const row = st.rows[st.editing.rowIdx]
    const col = visibleCols[st.editing.colIdx]
    let value = st.editing.value
    const colType = st.schema.cols[col]?.type
    if (colType === 'integer') value = Number(value) || 0
    if (colType === 'boolean') value = !!value

    const updated = await s.http.patch(base + '/' + row.id, { body: { [col]: value } })
    st.rows = st.rows.map(r => r.id === updated.id ? updated : r)
    st.editing = null
    s.redraw()
  }

  async function deleteRow(row) {
    await s.http.delete(base + '/' + row.id)
    st.rows = st.rows.filter(r => r.id !== row.id)
    s.redraw()
  }

  function getWrapper() {
    return document.getElementById(sheetId)
  }

  function focusWrapper() {
    const el = getWrapper()
    if (el) el.focus()
  }

  function focusEditInput(selectAll) {
    const wrapper = getWrapper()
    if (!wrapper) return
    const input = wrapper.querySelector('tbody input[type="text"], tbody input[type="number"]')
    if (!input) return
    input.focus()
    if (selectAll) input.select()
    else input.setSelectionRange(input.value.length, input.value.length)
  }

  function startEdit(rowIdx, colIdx, selectAll = true) {
    const col = visibleCols[colIdx]
    if (!st.schema.editable.includes(col)) return
    const colInfo = st.schema.cols[col]
    // Don't open text editor for booleans, enums, FKs, or timestamps
    if (colInfo.type === 'boolean' || colInfo.type === 'enum') return
    if (colInfo.references) return
    if (colInfo.type === 'unixepoch') return
    const value = st.rows[rowIdx][col]
    st.editing = { rowIdx, colIdx, value: value != null ? String(value) : '' }
    s.redraw.force().then(() => focusEditInput(selectAll))
  }

  function copySelection(e) {
    e.preventDefault()
    const bounds = getSelectedBounds(st)
    if (!bounds) return
    const lines = []
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      const cells = []
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const col = visibleCols[c]
        let val = st.rows[r][col]
        // Resolve FK display value for copy
        const colInfo = st.schema.cols[col]
        if (colInfo.references && st.lookups[col]) {
          const match = st.lookups[col].find(o => o.value === val)
          if (match) val = match.label
        }
        // Format timestamp for copy
        if (colInfo.type === 'unixepoch' && val) {
          val = new Date(val).toLocaleString()
        }
        let str = val != null ? String(val) : ''
        if (str.includes('\t') || str.includes('\n') || str.includes('"')) {
          str = '"' + str.replace(/"/g, '""') + '"'
        }
        cells.push(str)
      }
      lines.push(cells.join('\t'))
    }
    navigator.clipboard.writeText(lines.join('\n'))
    const sheet = document.getElementById(sheetId)
    const trs = sheet.querySelectorAll('tbody tr')
    const firstCell = trs[bounds.minRow]?.children[bounds.minCol + 1]
    const lastCell = trs[bounds.maxRow]?.children[bounds.maxCol + 1]
    if (firstCell && lastCell) {
      const sheetRect = sheet.getBoundingClientRect()
      const firstRect = firstCell.getBoundingClientRect()
      const lastRect = lastCell.getBoundingClientRect()
      st.copyOverlayPos = {
        top: firstRect.top - sheetRect.top,
        left: firstRect.left - sheetRect.left,
        width: lastRect.right - firstRect.left,
        height: lastRect.bottom - firstRect.top
      }
    }
    st.copied = { cells: new Set(st.selected), bounds }
    s.redraw()
  }

  function onkeydown(e) {
    if (!st.active) return
    e.redraw = false
    const { rowIdx, colIdx } = st.active
    const maxRow = st.rows.length - 1
    const maxCol = visibleCols.length - 1

    if (st.editing) {
      if (e.key === 'Escape') {
        e.preventDefault()
        st.editing = null
        s.redraw.force().then(focusWrapper)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        commitEdit().then(() => {
          if (st.active.rowIdx < st.rows.length - 1) selectCell(st, st.active.rowIdx + 1, st.active.colIdx, false)
          s.redraw.force().then(focusWrapper)
        })
      } else if (e.key === 'Tab') {
        e.preventDefault()
        commitEdit().then(() => {
          const next = e.shiftKey ? colIdx - 1 : colIdx + 1
          if (next >= 0 && next <= maxCol) selectCell(st, rowIdx, next, false)
          s.redraw.force().then(focusWrapper)
        })
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      st.copied = null
      st.copyOverlayPos = null
      st.selected = new Set([cellKey(rowIdx, colIdx)])
      s.redraw()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      copySelection(e)
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const next = e.shiftKey ? st.active.colIdx - 1 : st.active.colIdx + 1
      if (next >= 0 && next <= maxCol) {
        selectCell(st, rowIdx, next, false)
        s.redraw()
      }
      return
    }

    const from = e.shiftKey ? (st.cursor || st.active) : st.active
    let newRow = from.rowIdx, newCol = from.colIdx, handled = false
    if (e.key === 'ArrowUp' && from.rowIdx > 0) { newRow--; handled = true }
    else if (e.key === 'ArrowDown' && from.rowIdx < maxRow) { newRow++; handled = true }
    else if (e.key === 'ArrowLeft' && from.colIdx > 0) { newCol--; handled = true }
    else if (e.key === 'ArrowRight' && from.colIdx < maxCol) { newCol++; handled = true }
    else if (e.key === 'Enter') {
      e.preventDefault()
      startEdit(rowIdx, colIdx, false)
      return
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      const col = visibleCols[colIdx]
      if (st.schema.editable.includes(col)) {
        const colInfo = st.schema.cols[col]
        if (colInfo.type !== 'boolean' && colInfo.type !== 'enum' && !colInfo.references && colInfo.type !== 'unixepoch') {
          st.editing = { rowIdx, colIdx, value: '' }
          s.redraw.force().then(focusEditInput)
          return
        }
      }
    }

    // Type-to-edit on printable key
    if (!handled && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const col = visibleCols[colIdx]
      if (st.schema.editable.includes(col)) {
        const colInfo = st.schema.cols[col]
        if (colInfo.type !== 'boolean' && colInfo.type !== 'enum' && !colInfo.references && colInfo.type !== 'unixepoch') {
          st.editing = { rowIdx, colIdx, value: e.key }
          e.preventDefault()
          s.redraw.force().then(() => focusEditInput(false))
          return
        }
      }
    }

    if (handled) {
      e.preventDefault()
      selectCell(st, newRow, newCol, e.shiftKey)
      s.redraw()
    }
  }

  function cellContent(row, rowIdx, col, colIdx, colInfo) {
    const type = colInfo.type
    const value = row[col]
    const isEditable = st.schema.editable.includes(col)

    // Timestamp: display formatted, read-only
    if (type === 'unixepoch') {
      const display = value ? new Date(value).toLocaleString() : ''
      return s`span
        d block
        w 100%
        line-height 24px
        white-space nowrap
        overflow hidden
        text-overflow ellipsis
        c #666
      `(display)
    }

    // FK column: select dropdown in edit, resolved label in read mode
    if (colInfo.references && isEditable) {
      const options = st.lookups[col] || []
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
        value: value != null ? value : '',
        onchange: e => {
          e.redraw = false
          const r = st.rows[rowIdx]
          const newVal = e.target.value === '' ? null : Number(e.target.value) || e.target.value
          s.http.patch(base + '/' + r.id, { body: { [col]: newVal } }).then(updated => {
            st.rows = st.rows.map(x => x.id === updated.id ? updated : x)
            s.redraw()
          })
        }
      },
        colInfo.nullable ? s`option`({ value: '' }, '') : null,
        options.map(opt =>
          s`option`({ value: opt.value, selected: value === opt.value }, opt.label)
        )
      )
    }

    // FK column non-editable: show resolved label
    if (colInfo.references && !isEditable) {
      const options = st.lookups[col] || []
      const match = options.find(o => o.value === value)
      return s`span
        d block
        w 100%
        line-height 24px
        white-space nowrap
        overflow hidden
        text-overflow ellipsis
      `(match ? match.label : (value != null ? String(value) : ''))
    }

    // Boolean: checkbox
    if (type === 'boolean' && isEditable) {
      return s`input`({
        type: 'checkbox',
        checked: !!value,
        onchange: e => {
          e.redraw = false
          const r = st.rows[rowIdx]
          s.http.patch(base + '/' + r.id, { body: { [col]: !value } }).then(updated => {
            st.rows = st.rows.map(x => x.id === updated.id ? updated : x)
            s.redraw()
          })
        }
      })
    }

    // Enum: select
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
          const r = st.rows[rowIdx]
          s.http.patch(base + '/' + r.id, { body: { [col]: e.target.value } }).then(updated => {
            st.rows = st.rows.map(x => x.id === updated.id ? updated : x)
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
    if (st.editing && st.editing.rowIdx === rowIdx && st.editing.colIdx === colIdx) {
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
        value: st.editing.value,
        oninput: e => { st.editing = { ...st.editing, value: e.target.value }; e.redraw = false },
        onblur: e => {
          e.redraw = false
          commitEdit().then(focusWrapper)
        },
        onkeydown: e => {
          if (e.key === 'Enter') {
            e.redraw = false
            e.preventDefault()
            commitEdit().then(() => {
              if (st.active.rowIdx < st.rows.length - 1) selectCell(st, st.active.rowIdx + 1, st.active.colIdx, false)
              s.redraw.force().then(focusWrapper)
            })
            return
          }
          if (e.key === 'Tab') {
            e.preventDefault()
            e.redraw = false
            commitEdit().then(() => {
              const next = e.shiftKey ? st.active.colIdx - 1 : st.active.colIdx + 1
              if (next >= 0 && next <= visibleCols.length - 1) selectCell(st, st.active.rowIdx, next, false)
              s.redraw.force().then(focusWrapper)
            })
            return
          }
          if (e.key === 'Escape') { st.editing = null; s.redraw.force().then(focusWrapper) }
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
    selectCell(st, rowIdx, colIdx, e.shiftKey)
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
    if (e.shiftKey && st.active) {
      const r0 = Math.min(st.active.rowIdx, rowIdx)
      const r1 = Math.max(st.active.rowIdx, rowIdx)
      st.selected = new Set()
      for (let r = r0; r <= r1; r++)
        for (let c = 0; c < visibleCols.length; c++)
          st.selected.add(cellKey(r, c))
      st.editing = null
    } else {
      selectRow(rowIdx)
    }
    s.redraw.force().then(focusWrapper)
  }

  return s`
    w 100%
    font-size 14px
    outline none
    position relative
  `({ id: sheetId, tabindex: 0, onkeydown },
    s`table
      w 100%
      border-collapse collapse
      table-layout fixed
    `(
      // Header
      s`thead`(
        s`tr`(
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
        st.rows.map((row, rowIdx) => {
          const rowSel = isRowFullySelected(rowIdx)
          return s`tr`({ key: row.id },
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
              const isActive = st.active && st.active.rowIdx === rowIdx && st.active.colIdx === colIdx
              const isSel = st.selected.has(cellKey(rowIdx, colIdx))
              const shadow = isActive ? 'inset 0 0 0 2px #2563eb' : 'none'
              const bg = (!isActive && isSel) ? '#eef3ff' : 'transparent'

              return s`td
                p 6px 12px
                border 1px solid #e5e7eb
                box-shadow ${shadow}
                bc ${bg}
                cursor default
                overflow hidden
                user-select none
              `({
                  onclick: e => onCellClick(e, rowIdx, colIdx),
                  ondblclick: e => onCellDblClick(e, rowIdx, colIdx)
                },
                cellContent(row, rowIdx, col, colIdx, st.schema.cols[col])
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
        st.rows.length === 0 && s`tr`(
          s`td
            p 24px 12px
            text-align center
            c #999
            font-style italic
          `({ colspan: visibleCols.length + 2 }, 'No rows yet')
        )
      )
    ),
    // Copy overlay
    (st.copied && st.copyOverlayPos) && s`div
      position absolute
      border 2px dashed #2563eb
      pointer-events none
      box-sizing border-box
      top ${st.copyOverlayPos.top + 'px'}
      left ${st.copyOverlayPos.left + 'px'}
      w ${st.copyOverlayPos.width + 'px'}
      height ${st.copyOverlayPos.height + 'px'}
    `(),
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
