import { makeDb, col } from 'cos/db'
import { crud } from 'co-sheets/server.js'

const schema = {
  projects: {
    cols: {
      id: col.primary(),
      name: col.text(),
      description: col.text().default(''),
      active: col.boolean().default(true),
      created_at: col.created_at(),
    }
  },
  team_members: {
    cols: {
      id: col.primary(),
      name: col.text(),
      email: col.text().default(''),
      role: col.enum(['developer', 'designer', 'manager', 'qa']),
      active: col.boolean().default(true),
      created_at: col.created_at(),
    }
  },
  tasks: {
    cols: {
      id: col.primary(),
      title: col.text(),
      status: col.enum(['todo', 'in_progress', 'review', 'done']),
      priority: col.enum(['low', 'medium', 'high', 'critical']),
      project_id: col.integer().references('projects.id').nullable(),
      assignee_id: col.integer().references('team_members.id').nullable(),
      done: col.boolean().default(false),
      created_at: col.created_at(),
      updated_at: col.updated_at(),
    }
  }
}

const mountRoutes = crud(makeDb('app.db'), schema, {
  projects: { display: 'name', editable: ['name', 'description', 'active'] },
  team_members: { display: 'name', editable: ['name', 'email', 'role', 'active'] },
  tasks: { display: 'title', editable: ['title', 'status', 'priority', 'project_id', 'assignee_id', 'done'] },
})

export default function projectTracker(app) {
  mountRoutes(app, '/api')
}
