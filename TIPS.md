# Cosine Development Tips & Gotchas

## CSS Shorthands
- `min-h` is **not** a valid shorthand. Use `min-height` instead.
- See `pkg/src/shorthands.js` for the full list of valid shorthands (e.g., `w`, `h`, `d`, `p`, `m`, `bc`, `c`, etc.)
- Invalid shorthands are silently passed through as-is, producing broken CSS with no error.

## Component Lifecycle — NO constructors
- `s.mount(() => { ... return () => ... })` does **NOT** create a one-time constructor. The outer function runs on every redraw, just like the inner one. There is no constructor pattern in cos.
- **Never create `s.live()` inside a component function.** Every redraw re-creates them, losing state.
- **Never fire `s.http.get()` unconditionally inside a component function.** Each call fires a real network request. With `s.redraw()` in the `.then()` callback, this creates an infinite request loop.
- The correct pattern: use module-scope variables for state, and guard one-time initialization with a `loaded` flag.
- `oncreate` is **not** a supported lifecycle hook in cos. It is silently ignored.

## Controlled Inputs
- cos uses controlled inputs: setting `value: someValue` in vdom attrs causes cos to reset the DOM input value on each redraw.
- An `oninput` handler is required to capture user typing into local state, otherwise the value gets overwritten on the next redraw.
- The `onblur` handler should read from local state, not `e.target.value`, since cos may have already reset it.
- Use `e.redraw = false` in `onblur` and `onkeydown` (Enter) handlers to prevent cos from triggering an immediate redraw that interferes with the blur/save flow.

## Event Handling
- cos automatically calls `redraw()` after every event handler (line 1306 in `pkg/src/index.js`).
- For async handlers, cos also calls `result.then(redraw)` if the handler returns a promise.
- Set `e.redraw = false` to suppress the automatic redraw for events where you want to control the timing yourself.
- cos uses event delegation via vdom — checking `element.onclick` in the DOM will return `false` even when handlers are properly attached.

## Template Literal Interpolation
- Cos uses CSS custom properties (`--var`) for template literal interpolations. The interpolated expression becomes the value of the custom property.
- **Units must be inside the interpolation**, not outside. `top ${val}px` produces `top: var(--xxx)px` which is invalid CSS. Use `top ${val + 'px'}` so the custom property value is `33px` and the rule becomes `top: var(--xxx)` → `top: 33px`.
- Each unique set of interpolated values generates a new CSS class. This is fine for typical use.

## Browser Automation (Claude in Chrome)
- The `type` action doesn't reliably work with cos's controlled inputs. Use `javascript_tool` with native value setter + `input` event dispatch instead:
  ```js
  const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeSet.call(input, 'value');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  ```
- Use `dispatchEvent(new Event('blur', { bubbles: true }))` to blur, not `element.blur()`.
- Console/network tracking starts when the tool is first called. Must call the tracking tool first, *then* reload the page to capture load-time events.
- Navigation resets tracking — need to re-establish tracking after each `navigate` call.
