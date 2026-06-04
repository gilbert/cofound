import assert from 'node:assert/strict'
import test from 'node:test'
import { debounce } from '../index.js'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

test('debounce delays invocation', async () => {
  let calls = 0
  const fn = debounce(() => calls++, 50)

  fn()
  fn()
  fn()
  assert.equal(calls, 0)

  await delay(80)
  assert.equal(calls, 1)
})

test('debounce passes last arguments', async () => {
  let result = null
  const fn = debounce((...args) => { result = args }, 50)

  fn(1)
  fn(2)
  fn(3)

  await delay(80)
  assert.deepEqual(result, [3])
})

test('flush triggers immediately', () => {
  let calls = 0
  const fn = debounce(() => calls++, 5000)

  fn()
  assert.equal(calls, 0)

  fn.flush()
  assert.equal(calls, 1)
})

test('flush is a no-op when nothing is pending', () => {
  let calls = 0
  const fn = debounce(() => calls++, 50)

  fn.flush()
  assert.equal(calls, 0)
})

test('cancel discards pending call', async () => {
  let calls = 0
  const fn = debounce(() => calls++, 50)

  fn()
  fn.cancel()

  await delay(80)
  assert.equal(calls, 0)
})

test('debounce resets timer on each call', async () => {
  let calls = 0
  const fn = debounce(() => calls++, 50)

  fn()
  await delay(30)
  fn() // reset
  await delay(30)
  assert.equal(calls, 0) // still within window

  await delay(40)
  assert.equal(calls, 1)
})

test('flush after cancel is a no-op', () => {
  let calls = 0
  const fn = debounce(() => calls++, 50)

  fn()
  fn.cancel()
  fn.flush()
  assert.equal(calls, 0)
})

test('can call again after flush', async () => {
  let calls = 0
  const fn = debounce(() => calls++, 50)

  fn()
  fn.flush()
  assert.equal(calls, 1)

  fn()
  await delay(80)
  assert.equal(calls, 2)
})
