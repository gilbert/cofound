# DOM Helpers

Cofound provides DOM helper methods for improved interfacing on the element and component level.

## is `s.is.<alias>`

The `s.is.*` object contains read-only getter/setter references assigned at runtime. Entries return a `boolean` and are maintained internally.

```js
// Whether code is executing on the server
s.is.server

// All CSS Aliases are exposed on s.is
s.is.mobile
s.is.tablet
s.is.desktop
```

## isAttrs `s.isAttrs(value)`

The `s.isAttrs` function is a type guard that distinguishes whether a given value should be interpreted as a component's `attrs` object. Since the `s(...)` signature is flexible, the first argument can be either attributes or children — this helper ensures cofound knows how to interpret what you've passed in.

```js
s.isAttrs({ id: 'foo', class: 'bar' })   // -> true
s.isAttrs(s`div`())                      // -> false
s.isAttrs(document.createElement('p'))   // -> false
s.isAttrs([1,2,3])                       // -> false
```

## on `s.on(target, event, handler, options?)`

The `s.on` function simplifies attaching and cleaning up DOM event listeners. It wraps `addEventListener` and `removeEventListener` with a functional API that fits naturally into the component lifecycle. It returns a function that can be used as a dom hook or called manually.

```js
// Attach via dom hook
s`pre`({
  dom: s.on(window, 'keydown', (event, dom) => {
    dom.append(`Pressed: ${event.key}`)
  })
})

// Manual usage
const detach = s.on(button, 'click', () => alert('hi'))()
detach() // -> Remove the listener
```

> Invoking the returned function attaches the event listener, and it returns a cleanup function that will detach the listener.

## event `s.event(handler?)`

The `s.event` helper creates a lightweight, reactive event bus. Instead of custom Pub/Sub systems, use `s.event` to manage internal signals that any number of consumers can listen to. An `s.event` instance returns a function you invoke like a normal callback — when called, it synchronously dispatches to all registered observers.

```js
const listen = s.event()

listen.observe(() => console.log("Called"))
listen.observe(() => console.log("Called Once"), true)

listen()  // -> Both observers trigger
listen()  // -> Only first observer triggers
listen()  // -> Only first observer triggers
```

Each event instance exposes a `.signal` getter for an `AbortSignal` that aborts once the event fires, integrating with DOM APIs like `fetch` or `addEventListener` that support cancellation:

```js
const reload = s.event(x => console.log(x))

reload.observe(x => console.log(x ? "Trigger" : "Reloaded!"))

reload('s') // -> Trigger
reload('i') // -> Trigger
reload('n') // -> Trigger

fetch('/api', { signal: reload.signal }) // -> Integration with AbortController APIs
```

## animate `s.animate`

The `s.animate` helper triggers entry/exit transitions on DOM nodes. It sets an `animate` attribute on the element, letting you define transitions in CSS, and automatically cleans up after the animation frame.

```js
s`
  opacity 1
  transform translateY(0)
  transition opacity 200ms, transform 200ms

  [animate=entry] {
    opacity 0
    transform translateY(10)
    transition opacity 200ms, transform 200ms
  }
  [animate=exit] {
    opacity 0
    transform translateY(-10)
  }
`({
  dom: s.animate
})
```

> The helper sets `[animate="entry"]` to trigger CSS entry styles, removes it on the next frame, and returns a function that (with deferrable) sets `[animate="exit"]` and waits for exit transitions before removal.

## `p(...)`

`p()` is available in `globalThis` as a log helper. Unlike native `console.*` methods, `p` is a pass-through interceptor that returns the last known value.

```js
const x = 333 + p('x', 333) // logs "x 333" and returns 333
const v = p(x) / 2          // v will equal 333
```

## Trust `s.trust`

Converts HTML or SVG strings into unescaped HTML or SVG nodes.

```js
s.trust`<small>Rendered HTML</small>`   // Literal Expression
s.trust(`<h1>Rendered HTML</h1>`)       // Function Expression
```
