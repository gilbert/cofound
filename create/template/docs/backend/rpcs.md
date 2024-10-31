# RPCs

Remote Procedure Calls (RPCs) are function calls that a client sends remotely – in our case, JSON over HTTP. From the client's perspective, it looks like a normal function call, which makes it more seamless to work with than typical REST design constraints.

An RPC can read or write data. It has access to models, actions, the job queue, the current session (if the user is signed in), and the current anonymous http session.

RPCs always return a [Result](../result.md) type. This allows the client to never have to try/catch as well as get propertly typed errors.
## Project Structure

The `+/rpcs/index.ts` file is a barrel file to aggregate all your rpc definitions. For example, your project starts out with one like this:

```ts
export * from './meta'
export * from './user-auth'
```

Each one of these files can define and export as many RPCs as it wants. For example, here is what `+/rpcs/meta.ts` might look like:

```ts
import fs from 'fs/promises'

import { ok, rpc, z } from '../lib/rpc-context'

export const public_rpc_getAppVersion = rpc(z.object({}), async function execute() {
  // Read from git and spit out current commit hash
  const version = await fs.readFile('.git/HEAD', 'utf-8')
  const ref = version.split(':')[1]!.trim()
  const commit = await fs.readFile(`.git/${ref}`, 'utf-8')
  return ok(commit.trim())
})
```

### Security

- Rpc names **must** begin with either `rpc_` or `public_rpc_`.
  - If the former, then the rpc router checks for a valid signed-in session.

If you need to change this behavior, you can modify `+/lib/rpc-router.ts` in your project.

## Example RPC (read)

RPCs that return data normally just construct data from models and return the result. For example:

```ts
import { ok, rpc, z } from '../lib/rpc-context'

export const rpc_getPasskeys = rpc(
  z.object({}),
  async function execute() {
    const { Passkey } = this.models
    return ok(
      Passkey.findAll({ user_id: this.session.user_id }, `ORDER BY created_at ASC`).map((row) =>
        Passkey.clean(row),
      ),
    )
  }
)
```

Here the RPC directly uses the models in its function body. If this logic becomes complicated, or if you need to reuse it in multiple places, I recommend refactoring it into a [view model](./view-models.md).

Once defined, the frontend rpc client can call it like so:

```ts
import { client } from '../lib/rpc-client'

// ...in some component...
//
// NOTE: In a real app, I recommend using ResultLoader
//
const result = await client.rpc_getPasskeys({})
if (result.ok) {
  // NOTE: Even though rpc_getPasskeys does not define any potential errors,
  // rpcs ALWAYS have ErrResult<'unexpected'> in their type,
  // because there's always a chance something goes wrong!
  result.value //=> array of passkeys
}
```

Note that the above code is just for demonstration. I recommend using [ResultLoader](../frontend/data-loaders.md) for loading data like this instead.

## Example RPC (write)

RPCs that write data will usually have some potential way to fail, and therefore potentially return an ErrResult.

Following a similar example from the [ErrResult docs](../result.md#error-values):

```ts
export const rpc_guess = rpc(
  z.object({
    // RECOMMEND: Use snake_case to match up with backend table columns easier
    num_guess: z.number()
  }),
  async function execute({ num_guess }) {
    if (num_guess < 9) {
      return err('too_low', 'e5713243458')
    }
    if (num_guess > 9) {
      return err('too_high', 'e857264582')
    }
    return ok(num_guess)
  }
)
```

With this, you can call it in the client like so:

```ts
// ...in some component...
//
// NOTE: In a real app, I recommend using ClientActions
//
const result = await client.rpc_guess({ guess: Math.random() * 10 })
if (result.ok) {
  result.value //=> number
}
else {
  result.reason //=> 'too_low' | 'too_high' | 'unexpected'
}
```

### RPCs with Actions

Because RPCs return Results, and Actions are also expected to return Results, you can combine the two seamlessly and still get full type inference.

```ts
//
// +/actions/GuessGame.ts
//
class GuessGame extends BaseAction {
  run({ guess }: { guess: number }) {
    if (guess < 9) {
      return err('too_low', 'e5713243458')
    }
    if (guess > 9) {
      return err('too_high', 'e857264582')
    }
    return ok(guess)
  }
}

//
// +/rpcs/guess-game.ts
//
export const rpc_guess = rpc(
  z.object({
    guess: z.number()
  }),
  async function execute(params) {
    const res = this.get(GuessGame).run(params)
    if (!res.ok) return res

    if (res.value > 100) {
      return err('way_too_high', 'e582583834')
    }
    return res
  }
)

//
// Somewhere in your frontend
//
const result = await client.rpc_guess({ guess: Math.random() * 500 })

if (result.ok) {
  result.vaue //=> number
}
else {
  result.reason //=> 'way_too_high' | 'too_high' | 'too_low' | 'unexpected'
}
```

For an optimal way of dealing with RPC results, especially chains of RPC calls, I highly recommend using [ClientActions](../frontend/client-actions.md).

## Architecture Guidelines

- Although RPCs have access to models, it's recommended to put complicated write logic into [actions](./actions.md), and complicated read logic into [view models](./view-models.md).
  - This also makes your logic easier to test.
