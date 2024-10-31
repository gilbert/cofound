# Actions

An action is a piece of code that covers a full use case of our application. It is almost always cross-cutting, meaning it will use multiple models to accomplish its goal.

## Example Action

```ts
import { err, ok } from 'cofound/result'
import { BaseAction } from './base-action'

type Params = {
  name?: string
  email: string
}
export class CreateUser extends BaseAction {
  //
  // Here we define a singleton-sounding `run` method.
  // However, you are free to define as many methods as you want,
  // using any name you wish.
  //
  run({ name, email }: Params) {
    const { User, Email } = this.models
    const existing = Email.findByOptional({ email })
    if (existing && existing.user_id) {
      return err('unexpected', 'e475375924', { status: 400 })
    }

    name ||= email.split('@')[0]!

    //
    // When using transactions, DO NOT DO ASYNC WORK IN THEM.
    // This will hang your db writes!!
    // Perform your async work OUTSIDE the tx, or don't use txs at all.
    //
    return this.models.doTransaction('e98552234', () => {
      const user_id = User.create({ name })
      if (existing) {
        Email.setUserId(existing.id, user_id)
      } else {
        Email.create({ email, user_id })
      }
      return ok(user_id)
    })
  }
}
```

## Architecture Guidelines

- An action should always return a Result type
- An action should only attempt to accomplish one use case
- An action may use other actions via `this.get`
