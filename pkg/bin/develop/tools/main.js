import './userland.js'
import s from 'cos?dev'

import api from './api.js'
import menu from './menu.js'
import inspect from './inspect.js'

s.scroll = false
s.style(Object.assign(document.createElement('style'), { wat: 'hej' }))

const root = Object.assign(document.createElement('div'), { id: 'costools' })
document.documentElement.appendChild(root)

api.redraw.observe(s.redraw)

s.css`
  #costools { font-family ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace }
  #costools *, #costools:before, #costools:before { box-sizing border-box }
`

s.mount(root, () => [
  menu,
  inspect
])
