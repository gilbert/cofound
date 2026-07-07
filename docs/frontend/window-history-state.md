# Window History State

Cofound routing uses the browser History API for normal path routing. Internal anchors and `s.route('/path')` call `history.pushState()` by default, or `history.replaceState()` when `replace: true` is used.

## Route State

Pass state during navigation to forward data without adding query parameters or hash fragments.

```js
s`a`({
  href: '/profile',
  state: { from: 'settings' }
}, 'Profile')
```

```js
route('/profile', {
  state: { from: 'settings' }
})
```

When the destination route renders, the current `history.state` is merged into the route component's attrs.

```js
route({
  '/profile': ({ from }) => s`p`('From: ', from)
})
```

Use route state for short-lived navigation context. Use query parameters or server state for URLs that should be shareable or durable.

## Replace

Use `replace: true` to update the current history entry instead of adding a new one.

```js
route('/login', { replace: true })
```

Anchors can pass the same option:

```js
s`a`({ href: '/login', replace: true }, 'Login')
```

## Redraw

Use `redraw: false` to update history without immediately redrawing.

```js
route('/next', { redraw: false })
```

This is useful for advanced flows where another action will redraw shortly after. Most navigation should use the default redraw.

## Scroll Restoration

When `s.scroll` is true, Cofound sets `history.scrollRestoration = 'manual'` and stores document scroll state in `history.state.scroll`.

The saved scroll state contains:

```js
[
  scrollLeft,
  scrollTop,
  scrollWidth,
  scrollHeight
]
```

Cofound saves scroll state after scroll or resize events with a short debounce, restores it on `popstate`, and resets/restores scroll after route navigation.

Disable scroll handling globally before mounting:

```js
s.scroll = false
s.mount(app)
```

Disable it for one navigation:

```js
route('/next', { scroll: false })
```

`s.route.scroll = false` is also consumed by the next route navigation.

## Query Changes

`route.query` updates use `history.replaceState()` so changing query parameters does not add a new browser history entry.

```js
route.query.set('tab', 'activity')
route.query.clear()
```
