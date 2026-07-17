// Client-renderer DOM behavior, run in node against a happy-dom window.
// The globals must be bound BEFORE the browser entry is imported —
// src/window.js captures `window` at import time — hence the dynamic import.
//
// These pin two behaviors documented in docs/tips.md ("Keyed Sibling Lists
// Must Be Dense" and "Empty-String Attributes Are Dropped"): if either test
// starts failing, the renderer changed and the docs need updating.
import assert from 'node:assert/strict'
import test from 'node:test'
import { Window } from 'happy-dom'

const win = new Window({ url: 'http://cofound.test/' })
for (const key of [
  'window', 'document', 'location', 'history', 'navigator', 'localStorage', 'sessionStorage',
  'Event', 'MouseEvent', 'HTMLElement', 'Element', 'SVGElement', 'Node', 'DocumentFragment',
  'MutationObserver',
]) {
  if (key in win) Object.defineProperty(globalThis, key, { value: win[key], configurable: true, writable: true })
}
globalThis.requestAnimationFrame = win.requestAnimationFrame.bind(win)
globalThis.cancelAnimationFrame = win.cancelAnimationFrame.bind(win)
globalThis.getComputedStyle = win.getComputedStyle.bind(win)

const { default: s } = await import('../src/index.js')

const tick = () => new Promise(resolve => setTimeout(resolve, 60))

test('a null hole introduced into a keyed list throws into the error boundary', async () => {
  const errors = []
  const original = console.error
  console.error = (...args) => errors.push(args.map(String).join(' '))
  try {
    let open = true
    s.mount(document.body, () => s`div#list`([
      s`div`({ key: 'a' }, 'A'),
      open ? s`div`({ key: 'b' }, 'B') : null,
    ]))
    await tick()
    // The hole is only a problem once it EXISTS: the initial render is fine.
    assert.equal(document.body.innerHTML, '<div id="list"><div>A</div><div>B</div></div>')

    open = false
    s.redraw()
    await tick()
    // The patch reads .key off the null sibling and the boundary replaces the
    // whole list — the only page-visible symptom of the mistake.
    assert.match(document.body.textContent, /Unexpected Error: Cannot read properties of null/)
    assert.match(errors.join('\n'), /Cannot read properties of null/)
  } finally {
    console.error = original
  }
})

test('a dense keyed list collapses the same rows without error', async () => {
  let open = true
  s.mount(document.body, () => {
    const rows = [s`div`({ key: 'a' }, 'A')]
    if (open) rows.push(s`div`({ key: 'b' }, 'B'))
    return s`div#dense`(rows)
  })
  await tick()
  assert.equal(document.body.innerHTML, '<div id="dense"><div>A</div><div>B</div></div>')

  open = false
  s.redraw()
  await tick()
  assert.equal(document.body.innerHTML, '<div id="dense"><div>A</div></div>')
})

test('empty-string attributes are dropped; `true` sets a selectable empty attribute', async () => {
  s.mount(document.body, () => s`div#attrs`(
    s`div`({ key: 'empty', 'data-empty': '' }),
    s`div`({ key: 'true', 'data-true': true }),
    s`div`({ key: 'string', 'data-string': '1' }),
  ))
  await tick()
  // '' is falsy → removeAttribute; true → setAttribute(name, '') → data-true="".
  assert.equal(!!document.querySelector('[data-empty]'), false)
  assert.equal(!!document.querySelector('[data-true]'), true)
  assert.equal(document.querySelector('[data-true]').getAttribute('data-true'), '')
  assert.equal(!!document.querySelector('[data-string]'), true)
})
