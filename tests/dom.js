// Client-renderer DOM behavior, run in node against a happy-dom window.
// The globals must be bound BEFORE the browser entry is imported —
// src/window.js captures `window` at import time — hence the dynamic import.
//
// These pin renderer behaviors documented in docs/tips.md.
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
const { cssRules } = await import('../src/style.js')

const tick = () => new Promise(resolve => setTimeout(resolve, 60))

test('a null hole can be introduced into a keyed list', async () => {
  let open = true
  s.mount(document.body, () => s`div#list`([
    s`div`({ key: 'a' }, 'A'),
    open ? s`div`({ key: 'b' }, 'B') : null,
  ]))
  await tick()
  assert.equal(document.body.innerHTML, '<div id="list"><div>A</div><div>B</div></div>')

  open = false
  s.redraw()
  await tick()
  assert.equal(document.body.innerHTML, '<div id="list"><div>A</div></div>')
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

test('replacing a component runs onremove for its nested component', async () => {
  let first = true
  let removals = 0
  const Child = s((attrs, children, { onremove }) => {
    onremove(() => removals++)
    return () => s`span`('child')
  })
  const First = s(() => () => Child())
  const Second = s(() => () => s`span`('replacement'))

  s.mount(document.body, () => first ? First() : Second())
  await tick()
  assert.equal(document.body.textContent, 'child')

  first = false
  s.redraw()
  await tick()
  assert.equal(document.body.textContent, 'replacement')
  assert.equal(removals, 1)
})

test('an unchanged srcset is not reassigned after the browser normalizes it', async () => {
  s.mount(document.body, () => s`img#responsive`({ srcset: '/small.png 1x, /large.png 2x' }))
  await tick()

  const image = document.querySelector('#responsive')
  let assignments = 0
  Object.defineProperty(image, 'srcset', {
    configurable: true,
    get: () => 'http://cofound.test/small.png 1x, http://cofound.test/large.png 2x',
    set: () => assignments++,
  })

  s.redraw()
  await tick()
  assert.equal(assignments, 0)
})

test('internal links forward scroll options to the router', async () => {
  const originalScrollTo = window.scrollTo
  let scrolls = 0
  window.scrollTo = () => scrolls++

  try {
    history.replaceState(null, '', '/')
    s.mount(document.body, () => s`a#no-scroll`({ href: '/next', scroll: false }, 'Next'))
    await tick()
    scrolls = 0

    document.querySelector('#no-scroll').dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      button: 0,
    }))
    await tick()

    assert.equal(location.pathname, '/next')
    assert.equal(scrolls, 0)
  } finally {
    window.scrollTo = originalScrollTo
    history.replaceState(null, '', '/')
  }
})

test('CSS at-rules preserve functional property definitions', () => {
  s.css`@supports (padding:max(0)) { p 1 }`
  assert.equal(cssRules().at(-1).conditionText, '(padding:max(0))')
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
