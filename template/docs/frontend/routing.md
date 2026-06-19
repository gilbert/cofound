# Routing

Cofound includes a minimal scoped router. Every component receives the current router through `context.route`; the root router is also available as `s.route`.

Use normal anchors for navigation. Cofound intercepts internal links and routes them through `history.pushState`.

```js
s.mount((attrs, children, { route }) => [
  s`nav`(
    ['/', '/about', '/users', '/profile'].map(x =>
      s`a
        background ${ route.has(x) && 'lightblue' }
      `({
        href: x
      },
        x.slice(1) || 'Home'
      )
    )
  ),
  s`main`(
    route({
      '/': () => 'Welcome',
      '/:user': ({ user }) => 'Viewing ' + user,
      '/profile': () => 'Your profile'
    })
  )
])
```

## Matching

Call `route(routeMap)` to render the first matching route for the current scope. Route handlers receive path params as `attrs`.

```js
route({
  '/': () => 'Home',
  '/users/new': () => 'New user',
  '/users/:id': ({ id }) => 'User ' + id,
  '/?': () => 'Not found'
})
```

Routes are scored by specificity, not declaration order.

| Pattern | Meaning |
| --- | --- |
| `/` | Exact root of the current route scope. |
| `/static` | Literal path segment. |
| `/:param` | Required segment, decoded and passed as `attrs.param`. |
| `/*` | Any single path segment. |
| `/...` | Any remaining path segments. |
| `/?` | Fallback route. |

Static matches beat case-insensitive static matches, dynamic params, wildcards, and fallbacks.

## Scopes

A route rendered inside another route gets a scoped child router. The child router matches the remaining path under the parent route.

```js
s.mount((attrs, children, { route }) =>
  route({
    '/': () => 'Home',
    '/orders': (attrs, children, { route }) =>
      route({
        '/': () => 'Orders',
        '/:id': ({ id }) => 'Order ' + id
      })
  })
)
```

Route instances stringify to their scope root, so scoped links can be composed without hardcoding the parent path.

```js
const Orders = s((attrs, children, { route }) =>
  s`nav`(
    ['1001', '1002'].map(id =>
      s`a`({ href: route + id }, id)
    )
  )
)
```

## Introspection

Route instances expose state for links, navigation, and nested routing.

```js
route.path       // current path at this scope
route.params     // merged params from this route and parent routes
route.parent     // parent route instance
route.root       // root route instance
route.query      // URLSearchParams-like query helper
route.has('/x')  // whether /x is active under this scope
route + ''       // route scope as a string
```

Use `route.has()` for active navigation state:

```js
s`a`({
  href: '/settings',
  active: route.has('/settings')
}, 'Settings')
```

## Navigation

Navigate programmatically by calling a route with a string:

```js
route('/profile')
s.route('/profile')
```

Navigation options map to History API behavior and redraw/scroll behavior:

```js
route('/profile', {
  replace: true,      // use history.replaceState instead of pushState
  redraw: false,      // update the URL without triggering a redraw
  scroll: false,      // do not restore/reset scroll for this navigation
  state: { from: '/' } // data forwarded through history.state
})
```

`state`, `replace`, and `redraw` can also be passed as anchor attributes for intercepted links:

```js
s`a`({
  href: '/profile',
  replace: true,
  redraw: false,
  state: { from: 'nav' }
}, 'Profile')
```

## Query

`route.query` is a URLSearchParams-like helper backed by the current URL. Mutating it updates the current URL with `history.replaceState()` and redraws.

```js
route.query.get('q')
route.query.set('q', 'cofound')
route.query.append('tag', 'docs')
route.query.delete('page')
route.query.replace({ q: 'cofound', page: 1 })
route.query.clear()
```

After a query mutation, `route.query()` reads the latest emitted query string. For direct query reads, prefer the `URLSearchParams` methods such as `get()`, `has()`, and `entries()`.

## Target

For any `s`a`({ href: "/my/route" }, ...)` tag, cofound automatically hooks it into `history.pushState` routing. If you don't want this behavior, add `target: '_self'`.

```js
s`a`({
  href: '/oauth/github',
  target: '_self'
}, 'Sign in')
```
