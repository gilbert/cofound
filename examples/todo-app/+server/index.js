import { makeDb, Model, col, migrate } from 'cofound/db'

const schema = {
  todos: {
    cols: {
      id: col.primary(),
      text: col.text(),
      done: col.boolean().default('0'),
    }
  }
}

class Todos extends Model {
  constructor(db) {
    super(db, 'todos', schema.todos)
  }
}

export function createRoutes(db) {
  migrate(db, schema)
  const todos = new Todos(db)

  return async function(app) {
    app.get('/api/todos', r => {
      r.json(todos.findAll())
    })

    app.post('/api/todos', async r => {
      const { text } = await r.body('json')
      const id = todos.insert({ text })
      r.json(todos.findBy({ id }), 201)
    })

    app.patch('/api/todos/:id', r => {
      const todo = todos.findByOptional({ id: +r.params.id })
      if (!todo) return r.json({ error: 'Not found' }, 404)
      todos.updateById(todo.id, { done: !todo.done })
      r.json(todos.findBy({ id: todo.id }))
    })

    app.delete('/api/todos/:id', r => {
      const todo = todos.findByOptional({ id: +r.params.id })
      if (!todo) return r.json({ error: 'Not found' }, 404)
      todos.deleteWhere({ id: todo.id })
      r.json({ ok: true })
    })
  }
}

export default createRoutes(makeDb('app.db'))
