import { noop, isFunction } from './shared.js'

export default function Live(value, ...fns) {
  const observers = new Set()
  fns.forEach(fn => isFunction(fn) && observers.add(fn))
  live.value = value
  live.observe = observe
  live.valueOf = live.toString = live.toJSON = () => value
  live.detach = noop
  live.reduce = reduce
  live.set = x => (...args) => (live(isFunction(x) ? x(...args) : x), live)
  live.get = x => Object.assign(getter.bind(null, x), { observe: fn => live.observe(() => fn(getter(x))) })
  live.if = (...xs) => Object.assign(ternary.bind(null, ...xs), { observe: fn => live.observe(() => fn(ternary(...xs))) })

  return live

  function observe(x, once) {
    const fn = once ? ((...xs) => (observers.delete(fn), x(...xs))) : x
    observers.add(fn)
    return () => observers.delete(fn)
  }

  function getter(x) {
    return isFunction(x) ? x(live.value) : live.value[x]
  }

  function ternary(equals, a = true, b = false) {
    return live.value === equals ? a : b
  }

  function live(x) {
    if (!arguments.length)
      return live.value

    const prev = value
    live.value = value = x
    observers.forEach(fn => live.value !== prev && fn(live.value, prev, () => observers.delete(fn)))
    return live.value
  }

  function reduce(fn, initial) {
    let i = 1
    const result = Live(arguments.length > 1 ? fn(initial, live.value, i++) : live.value)
    live.observe(x => result(fn(result.value, x, i++)))
    return result
  }
}

Live.from = function(...xs) {
  const fn = xs.pop()
      , value = Live(fn(...xs.map(call)))
      , unobserve = xs.map(x => x.observe(() => value(fn(...xs.map(call)))))

  value.detach = () => unobserve.forEach(call)

  return value
}

function call(fn) {
  return fn()
}
