# Context

Every component receives three arguments:

```js
s((attrs, children, context) => [])
```

`context` is the capability surface for the current component instance. It carries document helpers, routing, lifecycle hooks, redraw controls, location state, and custom values passed from `s.mount()`.

## Mount Context

Pass root context as the third argument to `s.mount()`:

```js
s.mount(
  (attrs, children, context) => s`h1`('Hello ', context.user.name),
  {},
  { user: { name: 'Ada' } }
)
```

Custom context is inherited by descendants through the component tree.

## Runtime Values

```js
context.location   // window.location on the client, request location during SSR
context.hydrating  // true while an SSR-rendered node is hydrating
context.modified   // production server build timestamp when provided by the server
```

`context.location` is the stable way to inspect the current URL inside components.

## Document Helpers

`context.doc` changes document-level output. These helpers work during SSR and on the client where applicable.

```js
s((attrs, children, { doc }) => {
  doc.lang('en')
  doc.title('Dashboard')
  doc.head([
    s`meta`({ name: 'description', content: 'Admin dashboard' })
  ])

  return s`main`('Dashboard')
})
```

Server-rendered routes can also set response details:

```js
s((attrs, children, { doc }) => {
  doc.status(404)
  doc.headers({ 'Cache-Control': 'no-store' })
  return s`h1`('Not found')
})
```

Available helpers:

```js
context.doc.lang(value)
context.doc.title(value)
context.doc.head(children)
context.doc.status(code)
context.doc.headers(headers)
context.doc.doctype(value)
```

## Routing

`context.route` is the router scoped to the current component position.

```js
s((attrs, children, { route }) =>
  route({
    '/': () => 'Home',
    '/users/:id': ({ id }) => 'User ' + id
  })
)
```

See [Routing](routing.md) for matching, nested routes, navigation options, and query handling.

## Lifecycle

Lifecycle helpers are available on component context.

```js
const Timer = s((attrs, children, { onremove, redraw }) => {
  let seconds = 0
  const timer = setInterval(() => {
    seconds++
    redraw()
  }, 1000)

  onremove(() => clearInterval(timer))

  return () => s`span`(seconds)
})
```

`onremove(fn)` runs `fn` when the component instance is removed or recreated.

## Redraw Controls

```js
context.redraw()      // redraw this component instance
context.reload()      // remove and rebuild this component instance
context.refresh()     // rebuild optimistically while preserving the current DOM until updated
context.ignore(true)  // skip normal global redraw updates for this instance
```

Use these when an instance owns external subscriptions, timers, or imperative work. Most event handlers do not need them because Cofound redraws after handlers by default.

## Component Attributes

The same controls can be wired from observable attributes:

```js
const reload = s.event()

s`section`(
  Widget({ reload })
)

reload()
```

`redraw`, `reload`, and `refresh` attributes are observed when passed to components.
