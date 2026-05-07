import { makeDb, col } from 'cos/db'
import { crud } from 'co-sheets/server.js'

const schema = {
  subscribers: {
    cols: {
      id: col.primary(),
      name: col.text(),
      email: col.text(),
    }
  }
}

const mountRoutes = crud(makeDb('app.db'), schema, {
  subscribers: ['name', 'email'],
})

export default function emailList(app) {
  mountRoutes(app, '/api')
}

// For tests — accepts any db
export function createRoutes(db) {
  return crud(db, schema, { subscribers: ['name', 'email'] })
}
