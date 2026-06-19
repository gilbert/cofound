# Live (Reactive Streams)

The `s.live` method creates reactive streams that automatically update the UI when their values change. Streams support numbers, strings, objects, and more. They can be observed, transformed, and used to drive dynamic behavior.

```js
const live = s.live()
live.value                                   // Current value of the stream
live.valueOf()                               // Coerce value for operations (e.g., arithmetic)
live.toJSON()                                // JSON serialization
live.toString()                              // String representation
live.get('')                                 // Derive a new stream from a property
live.get((value) => {})                      // or function
live.set()                                   // Set the value directly or via a function
live.observe((new, old, detach) => {})       // Observe value changes, returns unsubscribe function
live.detach()                                // Detach all observers
live.reduce((acc, value, i) => {}, initial)  // Reduce values into a new stream
live.if(equals, isTrue, isFalse)             // Conditional value based on equality
```

Create streams where their lifetime matches the state they hold:

- **Module scope:** one stream shared by every use of that module.
- **Stateful component initializer:** one stream per component instance.
- **Stateless render function:** a new stream every time that function renders, which usually means the value is lost on redraw.

```js
const counter = s(() => {
  const count = s.live(0)

  return () => s`button`({
    onclick: count.set(x => x + 1)
  },
    'Count: ', count
  )
})
```

A stateful component initializer runs when the component instance is first mounted. It runs again only when that instance is recreated, such as when the component is removed and mounted again, its `key` changes, the component initializer function changes, or the instance is explicitly reloaded/refreshed.

> Use `s.live` with consideration and avoid composing streams with large or complex datasets to prevent performance bottlenecks and putting strain on the auto-redraw system.
