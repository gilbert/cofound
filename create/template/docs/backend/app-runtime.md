# App Runtime

The app runtime is a light wrapper around your models, actions, and job queue. Its purpose is to allow seamless dependency injection so you can test your application with ease.

## Setup

You already have a `+/lib/app-runtime.ts` file in your project. It exposes a function `getAppRuntime` that allows you to access your models, actions, and job queue with the correct configuration for running in development and production.

```ts
const { models, get, jobQueue } = getAppRuntime()

// Models are already initialized
models.User.findBy(...)

// Actions are accessed via the `get` helper
get(CreateUser).run(...)
```

However, your app runtime is already integrated into your actions and rpcs, so you normally don't need to call `getAppRuntime()` yourself (though this is useful in a script file!).

```ts
import { OtherAction } from './OtherAction'
import { BazJob } from '../jobs/BazJob'

class ExampleAction extends BaseAction {
  foo({ email }: { email: string }) {
    //
    // Use this.get to use other actions
    //
    const result = this.get(OtherAction).bar(email)
    if (!result.ok) return result

    //
    // Use this.jobQueue to push new jobs
    //
    this.jobQueue.push(BazJob, { email }, {
      delay: 5000
    })

    return ok({})
  }
}
```

Rpcs look similar:

```ts
export const rpc_getSessionData = rpc(z.object({}), async function execute() {
  //
  // Use this.models to access model instances
  //
  const { User, Email } = this.models
  const user = User.findBy({ id: this.session.user_id })
  const email = Email.findBy({ user_id: user.id, primary: true })

  //
  // Use this.get to access actions
  //
  this.get(ExampleAction).foo({ email: email.email })

  return ok({
    user: {
      uid: user.uid,
      name: user.name,
      email: email.email,
    },
  })
})
```

## SessionData and AnonSessionData

The other piece of your app runtime is session data. This is relevant in your rpcs, which can read or update sessions (see [docs on rpcs](./rpcs.md) for how to do this).

Specifically, in `+/lib/app-runtime.ts` you can define additional properties to store in sessions. For example, to add `foo` to signed-in sessions and `bar` to anonymous sessions:

```ts
//
// Session data definitions for authenticated and anonymous users.
// Add your own fields here as needed.
//
export type SessionData = PodsSessionData & {
  foo: string
}
export type AnonSessionData = PodsAnonSessionData & {
  bar: number
}
```
