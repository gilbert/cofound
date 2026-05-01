import s from 'cos'

s.mount(() => {
  const todos = s.live([])
  const input = s.live('')

  s.http.get('/api/todos').then(r => { todos(r); s.redraw() })

  async function add(e) {
    e.preventDefault()
    if (!input().trim()) return
    const todo = await s.http.post('/api/todos', { body: { text: input() } })
    todos([...todos(), todo])
    input('')
    s.redraw()
  }

  async function toggle(todo) {
    const updated = await s.http.patch('/api/todos/' + todo.id)
    todos(todos().map(t => t.id === updated.id ? updated : t))
    s.redraw()
  }

  async function remove(todo) {
    await s.http.delete('/api/todos/' + todo.id)
    todos(todos().filter(t => t.id !== todo.id))
    s.redraw()
  }

  return () => s`
    max-width 480px
    m 40px auto
    font-family system-ui, sans-serif
  `(
    s`h1 mb 16px`('Todo App'),
    s`form
      d flex
      gap 8px
      mb 24px
    `({ onsubmit: add },
      s`input
        flex 1
        p 8px 12px
        border 1px solid #ccc
        border-radius 4px
        font-size 16px
      `({
        placeholder: 'What needs to be done?',
        value: input(),
        oninput: e => input(e.target.value)
      }),
      s`button
        p 8px 16px
        bc #2563eb
        c white
        border none
        border-radius 4px
        cursor pointer
        font-size 16px
      `('Add')
    ),
    s`ul
      list-style none
      p 0
    `(
      todos().map(todo =>
        s`li
          d flex
          ai center
          gap 8px
          p 8px 0
          border-bottom 1px solid #eee
        `({ key: todo.id },
          s`span
            flex 1
            font-size 16px
            ${todo.done ? 'text-decoration line-through; c #999' : ''}
          `({ onclick: () => toggle(todo), style: 'cursor:pointer' }, todo.text),
          s`button
            bc transparent
            border none
            c #ef4444
            cursor pointer
            font-size 18px
          `({ onclick: () => remove(todo) }, '\u00d7')
        )
      )
    ),
    todos().length === 0 && s`p c #999; font-size 14px`('No todos yet. Add one above!')
  )
})
