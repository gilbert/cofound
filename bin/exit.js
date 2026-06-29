const events = 'SIGINT SIGABRT SIGTERM SIGHUP SIGQUIT exit beforeExit uncaughtException unhandledRejection'.split(' ')
const listeners = new Map()
const handlers = new Set()
const running = new Set()
const errors = new Set()

let exiting = false
let exitEvent = null
let exitSignal = null
let exitResolve = null

const exited = new Promise(r => exitResolve = r)

export default exit

function exit(signal = 'SIGTERM', x = signal) {
  process.emit(signal, x)
  return exiting
}

exit.timeout = null
Object.defineProperties(exit, {
  exited  : { get() { return exited } },
  exiting : { get() { return exiting } },
  event   : { get() { return exitEvent } },
  signal  : { get() { return exitSignal } }
})

exit.wait = function wait(name, timeout, fn) {
  const x = {
    name,
    timeout,
    fn
  }

  if (!fn) {
    x.fn = timeout
    x.timeout = null
  }

  if (typeof x.name !== 'string')
    throw new Error('First argument to exit.wait must be a name for the job')

  if (typeof x.fn !== 'function')
    throw new Error('Second argument to exit.wait must be a function')

  if (x.timeout !== null && typeof x.timeout !== 'number')
    throw new Error('Second argument to exit.wait must be a function')

  if (handlers.size === 0) {
    for (const event of events) {
      const fn = handle(name, timeout, event)
      listeners.set(event, fn)
      process.on(event, fn)
    }
  }

  handlers.add(x)
  exiting && runHandler(x)
  return () => removeHandler(x)
}

function removeHandler(x) {
  handlers.delete(x)
  if (handlers.size === 0) {
    for (const [event, fn] of listeners)
      process.off(event, fn)
  }
}

function handle(name, timeout, event) {
  return async function(signal) {
    const start = performance.now()
    exitEvent = event
    exitSignal = signal
    if (process.listenerCount('SIGHUP') > 1)
      return

    if (event === 'uncaughtException' || event === 'unhandledRejection')
      console.error(signal)

    exiting = true

    for (const x of handlers) {
      removeHandler(x)
      runHandler(x)
    }

    if (running.size && event !== 'exit') {
      await Promise.race([
        Promise.allSettled([...running].map(x =>
          Promise.race([
            x.result,
            new Promise(r => x.timeout === null || setTimeout(r, x.timeout).unref())
          ])
        )),
        new Promise(r => exit.timeout === null || setTimeout(r, exit.timeout).unref())
      ])
    }

    for (const x of running)
      console.error('Exit job \'' + x.name + '\' timed out')

    for (const [name, error] of errors)
      console.error('Exit job "' + name + '" errored with', error)

      process.exitCode || (process.exitCode =
        event === 'uncaughtException'  ? 1
      : event === 'unhandledRejection' ? 1
      : event === 'SIGINT'             ? 130
      : event === 'SIGQUIT'            ? 131
      : event === 'SIGTSTP'            ? 131
      : event === 'SIGHUP'             ? 129
      : event === 'SIGABRT'            ? 134
      : errors.size || running.size    ? 1
      : 0
    )

    exitResolve()
    if (exit.timeout === null) {
      setTimeout(waiting, 1000, 1000).unref()
      function waiting(timeout) {
        if (process.env.NODE_ENV === 'production') {
          setTimeout(waiting, timeout, timeout * 2).unref()
          return console.error('Exiting - waiting for unknown handlers to finish')
        }

        console.error('Exited while waiting for unknown handlers to finish')
        process.exit()
      }
    } else {
      setTimeout(() => {
        console.error('Process did not exit cleanly')
        process.exitCode || (process.exitCode = 1)
        process.exit()
      }, exit.timeout - (performance.now() - start)).unref()
    }
  }
}

function runHandler(x) {
  try {
    x.result = x.fn(exit.event, exit.signal)
    if (x.result && typeof x.result.then === 'function') {
      running.add(x)
      x.result.then(
        () => running.delete(x),
        error => {
          errors.add([x.name, error])
          running.delete(x)
        }
      )
    }
  } catch (error) {
    errors.add([x.name, error])
  }
}
