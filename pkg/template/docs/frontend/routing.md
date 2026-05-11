# Routing

Cofound includes a minimal router. There is always a scoped router available in context which lets you implement routing (as nested as you like) without worrying about the mount point. Using `href` is the default way of telling cofound to route.

Every route instance has a `.toString` method, so you can do `href: route + 'sub-page'`. You can use `route.has()` to check which route is active, and cofound also sets an `[active]` attribute for styling.

```js
s.mount(({ route }) => [
  s`nav`(
    ['/', '/about', '/users', '/profile'].map(x =>
      s`a
        background ${ route.has(x) && 'lightblue' }
      `({
        href: '/' + x
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

## Target

For any `s`a`({ href: "/my/route" }, ...)` tag, cofound automatically hooks it into `history.pushState` routing. If you don't want this behavior (e.g. to hit a backend route like `/oauth/github`), add a `target: '_self'` attribute to your anchor tag.
