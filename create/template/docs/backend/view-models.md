# View Models

View models are a simple wrapper around model query logic that you intend to reuse in multiple places (often across RPCs). The main feature is they give you automatic access to your runtime.

## ViewModel Example

```ts
import { BaseModelView } from './base-model-view'

export class ProjectView extends BaseModelView {
  query(project_id: number) {
    const { Project, Membership, User } = this.models

    const project = Project.findBy({ id: project_id })
    const memberships = Membership.findAll({ project_id })
    const members = memberships.map(mem => ({
      ...mem,

      // NOTE: Because we're using SQLite, this is actually optimal!
      user: User.findBy({ id: mem.user_id })
    }))

    return { project, members }
  }
}
```

To use, just call `this.get` in your RPC:

```ts
import { ProjectView } from './project-view'

export const rpc_getProject = rpc(
  z.object({
    project_id: z.number(),
  }),
  async function execute({ project_id }) {
    return this.get(ProjectView).query(project_id)
  }
})
```

## Architecture Guidelines

- You don't need to write every query in a view model. Only write the ones you intend to reuse, or if it gets too complex.
- View models should be stateless. They should not store any data between calls.
- View models should not have side effects. They should only query the database.
