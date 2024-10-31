# Result

A "Result" is a common and useful pattern that captures the notion of "success" and "error" states into a single typed value. When used throughout an entire architecture, it becomes very powerful.

## Success Values

An OkResult result is a simple object with a typed value.

```ts
import { ok } from 'cofound/result`

function myTask() {
  return ok({ foo: 10 })
}

let result = myTask()
result       //=> OkResult<{ foo: number }>
result.value //=> { foo: number }
```

## Error Values

An ErrResult is used to indicate what went wrong with an operation. To assist with this, each ErrResult has a `reason`, which is a unique-ish key that makes it into its type.

ErrResults also have a codebase-unique `code`, which helps you quickly find exactly where an error is coming from.

```ts
import { err } from 'cofound/result`

function myTask() {
  const x = Math.random()
  if (x < 0.5) {
    return err('too_low', 'e715794599')
  }
  return ok(x)
}

let result = myTask()
result      //=> OkResult(number) | ErrResult<'too_low'>
result.ok   //=> boolean

if (result.ok) {
  result.value //=> number
}
else {
  result.reason //=> 'too_low'
  result.code   //=> string
}
```

### Type Inference

Notice the **inferred** type of the above function. The fact that result types can be inferred is one of Cofound's most powerful features.

Imagine a second task that has its own ErrResults:

```ts
function mySecondTask() {
  const res = myTask()
  if (!res.ok) return res

  if (res.value >= 0.9) {
    return err('too_high', 'e57135739')
  }
  return res
}
```

Amazingly, **both** errors are included in the type!

```ts
let result = mySecondTask()
result //=> OkResult(number) | ErrResult<'too_low'> | ErrResult<'too_high'>

if (result.ok) {
  result.value //=> number
}
else {
  result.reason //=> 'too_low' | 'too_high'
  result.code   //=> string
}
```

This is incredibly useful for understanding how your tasks can go wrong, for showing special ux for specific errors in the frontend, or even handling specific errors in the *backend* in wrapper functions.

### Error Metadata

You can also attach additional metadata to an ErrResult:

```ts
const result = err('no_go', 'e15357238', { meta: { custom: 'data' } })
```

One use case is to include the causing JS error:

```ts
try {
  i_might_throw()
}
catch(cause: any) {
  return err('thing_failed', 'e857235739', { meta: { cause } })
}
```

Metadata is also inferred, so you can handle errors in a more intricate way:

```ts
const result = err('nah', 'e7527350274', { meta: { triesLeft: 3 } })

if (!result.ok) {
  result.reason //=> 'nah'
  result.meta   //=> { triesLeft: number }
}
```

## Helpers

Cofound's primary concern for its result object is type inference. However, there are still some helpers in the rarer chance you need them:

```ts
function myTask() {
  const x = Math.random()
  if (x < 0.5) {
    return err('too_low', 'e715794599')
  }
  return ok(x)
}

const result = myTask() //=> OkResult<number> | ErrResult<'too_low'>

result.unwrapMaybe() //=> number | undefined
result.unwrap()      //=> number (if not an OkResult), otherwise throws an exception
```
