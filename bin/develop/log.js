globalThis.p = globalThis.l = globalThis.log = log

let only = false

export default function log(...xs) {
  only || console.log(...xs) // eslint-disable-line
  return xs.pop()
}

log.only = function(...xs) {
  only = true
  console.log(...xs) // eslint-disable-line
  return xs.pop()
}

log.debug = function debug(...xs) {
  if (!process.env.DEBUG)
    return xs.pop()

  console.log(...xs) // eslint-disable-line
  return xs.pop()
}

log.error = function log(...xs) {
  console.error(...xs) // eslint-disable-line
  return xs.pop()
}

log.trace = function(...xs) {
  console.trace ? console.trace(...xs) : console.log(...xs) // eslint-disable-line
  return xs.pop()
}

log.inspect = function(...xs) {
  console.log(...xs) // eslint-disable-line
  // Consider having inspect pre stringify the args
  return xs.pop()
}

log.observe = function(...xs) {
  console.log(...xs) // eslint-disable-line
  // we can use the stack trace as an id
  // if typeof x is an object we monitor it for changes
  // if x is a value we wait for new calls to observe
  return xs.pop()
}
