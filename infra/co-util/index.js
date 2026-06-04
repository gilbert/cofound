export function debounce(fn, ms) {
  let timer = null
  let pendingArgs = null

  function debounced(...args) {
    pendingArgs = args
    if (timer != null) clearTimeout(timer)
    timer = setTimeout(flush, ms)
  }

  function flush() {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
    if (pendingArgs != null) {
      const args = pendingArgs
      pendingArgs = null
      fn(...args)
    }
  }

  function cancel() {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
    pendingArgs = null
  }

  debounced.flush = flush
  debounced.cancel = cancel
  return debounced
}
