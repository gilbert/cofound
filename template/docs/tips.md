# Tips & Gotchas

## CSS Shorthands
- `min-h` is **not** a valid shorthand. Use `min-height` instead.
- See the [shorthands table](frontend/css.md#shorthands) for the full list of valid shorthands (e.g., `w`, `h`, `d`, `p`, `m`, `bc`, `c`, etc.)
- Invalid shorthands are silently passed through as-is, producing broken CSS with no error.

## Component Lifecycle — NO constructors
- `s.mount(() => { ... return () => ... })` does **NOT** create a one-time constructor. The outer function runs on every redraw, just like the inner one. There is no constructor pattern in cofound.
- **Never create `s.live()` inside a component function.** Every redraw re-creates them, losing state.
- **Never fire `s.http.get()` unconditionally inside a component function.** Each call fires a real network request. With `s.redraw()` in the `.then()` callback, this creates an infinite request loop.
- The correct pattern: use module-scope variables for state, and guard one-time initialization with a `loaded` flag.
- `oncreate` is **not** a supported lifecycle hook in cofound. It is silently ignored.

## Controlled Inputs
- cofound uses controlled inputs: setting `value: someValue` in vdom attrs causes cofound to reset the DOM input value on each redraw.
- An `oninput` handler is required to capture user typing into local state, otherwise the value gets overwritten on the next redraw.
- The `onblur` handler should read from local state, not `e.target.value`, since cofound may have already reset it.
- Use `e.redraw = false` in `onblur` and `onkeydown` (Enter) handlers to prevent cofound from triggering an immediate redraw that interferes with the blur/save flow.

## Event Handling
- cofound automatically calls `redraw()` after every event handler.
- For async handlers, cofound also calls `result.then(redraw)` if the handler returns a promise.
- Set `e.redraw = false` to suppress the automatic redraw for events where you want to control the timing yourself.
- cofound uses event delegation via vdom — checking `element.onclick` in the DOM will return `false` even when handlers are properly attached.

## Template Literal Interpolation
- Cofound uses CSS custom properties (`--var`) for template literal interpolations. The interpolated expression becomes the value of the custom property.
- **Units must be inside the interpolation**, not outside. `top ${val}px` produces `top: var(--xxx)px` which is invalid CSS. Use `top ${val + 'px'}` so the custom property value is `33px` and the rule becomes `top: var(--xxx)` → `top: 33px`.
- Each unique set of interpolated values generates a new CSS class. This is fine for typical use.
