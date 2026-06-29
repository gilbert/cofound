# Live

`s.live(value)` creates a small reactive value container. A live stream is both callable and observable:

```js
const count = s.live(0)

count()        // read current value
count(1)       // set current value
count.value    // read current value
```

When a live stream used in a mounted view changes, Cofound redraws the affected UI. `s.live` is not required for normal redraws: plain variables in stateful components also update when an event triggers a redraw or when you call `s.redraw()`.

```js
const Counter = s(() => {
  let count = 0

  return () => s`button`({
    onclick: () => count++
  }, 'Count: ', count)
})
```

Use `s.live` when you want a value with its own setter, observers, derived values, or integration with APIs that expect a function.

## Lifetime

Create streams where their lifetime matches the state they hold:

- **Module scope:** one stream shared by every use of that module.
- **Stateful component initializer:** one stream per component instance.
- **Stateless render function:** a new stream every time that function renders, which usually means the value is lost on redraw.

```js
const Counter = s(() => {
  const count = s.live(0)

  return () => s`button`({
    onclick: count.set(x => x + 1)
  }, 'Count: ', count)
})
```

A stateful component initializer runs when the component instance is first mounted. It runs again only when that instance is recreated, such as when the component is removed and mounted again, its `key` changes, the component initializer function changes, or the instance is explicitly reloaded/refreshed.

## Getters

```js
const user = s.live({ name: 'Ada' })

user()          // { name: 'Ada' }
user.value      // { name: 'Ada' }
user.toJSON()   // { name: 'Ada' }
user.toString() // string representation
```

`valueOf()` supports primitive coercion:

```js
const count = s.live(1)
count + 1 // 2
```

`get()` creates a derived stream from a property or selector:

```js
const user = s.live({ name: 'Ada', age: 36 })
const name = user.get('name')
const label = user.get(x => x.name + ' Lovelace')
```

## Setters

Call the live stream with a value to set it:

```js
count(count() + 1)
```

`set()` returns a setter function, which is useful for event handlers. It accepts either a value or an updater function:

```js
s`button`({ onclick: count.set(x => x + 1) }, 'Increment')
s`button`({ onclick: count.set(0) }, 'Reset')
```

## Observers

`observe()` runs a callback whenever the value changes. The callback receives `(next, prev, detach)`. It returns an unsubscribe function.

```js
const unobserve = count.observe((next, prev) => {
  console.log(prev, '->', next)
})

unobserve()
```

Pass `true` as the second argument to observe once:

```js
count.observe((next) => {
  console.log('first change', next)
}, true)
```

Call `detach()` to remove all observers from a stream:

```js
count.detach()
```

## Derived Streams

`reduce()` accumulates stream updates into a new live stream:

```js
const step = s.live(1)
const total = step.reduce((sum, value) => sum + value, 0)
```

`if()` creates a conditional derived stream:

```js
const mode = s.live('list')
const label = mode.if('list', 'List view', 'Other view')
```

`s.live.from()` combines streams:

```js
const first = s.live('Ada')
const last = s.live('Lovelace')
const full = s.live.from(first, last, (a, b) => a + ' ' + b)
```

Detach long-lived derived streams when you no longer need them:

```js
full.detach()
```

## Redraws

Live streams can trigger redraws when they are used in mounted views, but they are not the only redraw mechanism. Cofound also redraws after normal event handlers, async handlers that return promises, route changes, and explicit `s.redraw()` calls.

Use plain state for simple local component state. Use `s.live` when observation, composition, or handler-friendly setters make the code clearer.

## API Summary

```js
const live = s.live()

live()                                    // read current value
live(value)                               // set current value
live.value                                // current value
live.valueOf()                            // coerce value for primitive operations
live.toJSON()                             // JSON serialization
live.toString()                           // string representation
live.get('property')                      // derive a stream from a property
live.get(value => value.property)         // derive a stream from a selector
live.set(value)                           // create a setter function
live.set(value => nextValue)              // create an updater function
live.observe((next, prev, detach) => {})  // observe changes; returns unsubscribe
live.detach()                             // detach all observers
live.reduce((acc, value, i) => {}, initial)
live.if(equals, isTrue, isFalse)
s.live.from(a, b, (aValue, bValue) => {})
```

Avoid using live streams as a default replacement for local variables. For simple component state, a variable in a stateful component is usually enough. Use live streams when you need their API: observation, derived values, function-shaped setters, or automatic redraws from outside normal event flow.
