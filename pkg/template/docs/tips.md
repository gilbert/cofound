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

## Event System and Redraw

Cofound automatically calls a global `redraw()` after every JSX event handler (e.g. `onclick`, `oninput`) completes. This re-renders ALL mounted components, diffs the virtual DOM, and patches the real DOM.

For most handlers (button clicks, tab switches, form submits) this is exactly what you want — the UI reflects the new state.

**However**, for high-frequency events like `oninput` on a textarea or text input, this causes lag: every keystroke triggers a full re-render of the entire page. The browser already updates the input's displayed value natively, so the redraw is wasted work.

**Fix: set `e.redraw = false`** to tell Cofound to skip the redraw:

```tsx
oninput={(e: any) => {
  e.redraw = false
  text = e.target.value
  onChange(text)
}}
```

The closure variables are still updated synchronously — they'll be correct when a future event (Save button, tab switch) triggers a natural redraw.

**When to use `e.redraw = false`:**
- `oninput` / `onkeydown` / `onkeyup` on text inputs and textareas
- Any high-frequency handler where the DOM already reflects the change natively
- Scroll, mousemove, or resize handlers that only update local state

**When NOT to use it:**
- `onclick` handlers that change what's displayed (tab switches, toggles, navigation)
- Any handler where other components need to reflect the state change immediately

**Additional notes:**
- For async handlers, cofound also calls `result.then(redraw)` if the handler returns a promise.
- cofound uses event delegation via vdom — checking `element.onclick` in the DOM will return `false` even when handlers are properly attached.

## Backend Links Need `target: '_self'`
- For any `s\`a\`({ href: "/my/route" }, ...)` tag, cofound automatically hooks it into `history.pushState` routing.
- If you do not want frontend routing, such as hitting a backend route like `/oauth/github`, downloading a file, opening uploaded media, or viewing a JSON endpoint, add `target: '_self'`.

```js
s`a`({
  href: '/files/video.mp4',
  target: '_self'
}, 'video.mp4')
```

## Template Literal Interpolation
- Cofound uses CSS custom properties (`--var`) for template literal interpolations. The interpolated expression becomes the value of the custom property.
- **Units must be inside the interpolation**, not outside. `top ${val}px` produces `top: var(--xxx)px` which is invalid CSS. Use `top ${val + 'px'}` so the custom property value is `33px` and the rule becomes `top: var(--xxx)` → `top: 33px`.
- Each unique set of interpolated values generates a new CSS class. This is fine for typical use.

## Styled Overrides, Not CSS Fragment Interpolation
- `s\`...\`` interpolation is not general string concatenation. Cofound parses the raw template string as CSS once, then stores interpolated values as CSS custom properties or selector attribute toggles.
- This is correct for values: `s\`w ${width + 'px'}; c ${color}\``.
- It is **not** correct for injecting declarations, shorthands, selectors, or layout fragments: `s\`${layout}; font-size 12px\`` does not make Cofound parse `layout` as CSS syntax.
- The idiomatic way to share a base style and extend it is a styled component override:

```js
// Bad: the fragment is treated as an interpolated value, not parsed CSS.
function fileHead(label, layout) {
  return s`
    ${layout}
    font-size 12px
  `(label)
}

// Good: FileHead is a styled component, and the override is
// its own tagged template, so Cofound parses it as CSS.
const FileHead = s`span
  font-size 12px
  text-transform uppercase
`

FileHead`
  w 110px
`('Size')
```

- If the override adds styles only, start it with whitespace/newline as above. A LEADING TOKEN BEFORE WHITESPACE IS PARSED AS THE ELEMENT/TAG SELECTOR:

```js
FileHead`
  w 110px
`('Size')       // style override

FileHead`span
  w 110px
`('Size')       // explicit tag + style override

FileHead`w 110px`('Size') // wrong: `w` is parsed as a tag name
```

- For genuinely dynamic property values, keep using interpolation: `FileHead\`w ${width + 'px'}\``.
