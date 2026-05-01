import { symbols as $, hasOwn, isPromise } from './shared.js'
import fs from 'node:fs'
import Request from './request.js'
import files from './files.js'
import mimes from './mimes.js'
import { Websocket, Message } from './ws.js'

export default function Server({
  methods = ['head', 'get', 'put', 'post', 'delete', 'patch', 'options', 'trace', 'all'],
  ...o
} = {}) {
  'node' in o || (o.node = process.env.HTTP_SERVER === 'node')

  let uws
    , handle
    , wrapper

  const handlers = new Map()
      , connects = new Set()
      , wss = new Set()
      , asn = new Set()
      , msn = new Set()
      , rsn = new Set()

  hasOwn.call(o, 'compressions') || (o.compressions = o.cert ? ['br', 'gzip', 'deflate'] : ['gzip', 'deflate'])
  methods.forEach(register)

  router.route = route
  router.mimes = mimes
  router.files = files(Server)
  router.handlers = handlers
  router.ws = ws
  router.connect = (...xs) => connects.add(xs)
  router.listen = listen(o)
  router.publish = (...xs) => uws ? uws.publish(...xs) : false
  router.subscribers = (...xs) => uws ? uws.numSubscribers(...xs) : 0
  router.addServerName = (...xs) => (uws ? addServerName(...xs) : asn.add(xs), router)
  router.removeServerName = (...xs) => (uws ? removeServerName(...xs) : rsn.add(xs), router)
  router.missingServerName = (...xs) => (uws ? uws.missingServerName(...xs) : msn.add(xs), router)
  router.close = () => uws && uws.close()

  return router

  function addServerName(name, options) {
    uws.addServerName(name, options)
    uws.domain(name).any('/*', wrapper)
  }

  function removeServerName(name) {
    uws.removeServerName(name)
    uws.domain(name).any('/*', null)
  }

  async function router(r) {
    if (r.handled)
      return

    const method = handlers.has(r.method)
      ? handlers.get(r.method)
      : handlers.get('all')

    for (const x of method) {
      if (r.handled)
        break

      if (hasOwn.call(r, $.error) !== x.error)
        continue

      const match = x.match(r)
      if (!match)
        continue

      try {
        let response = x.handler({ error: r[$.error], r, match })
        if (isPromise(response)) {
          r.onAborted()
          response = await response
        }
        if (response instanceof Response)
          return await r.end(response)
        else
          r.response = response
      } catch (error) {
        r[$.error] = error
      }
    }

    if (!handle) // Ensure we only use fallback responses in root listen router
      return

    if (r.handled)
      return

    hasOwn.call(r, $.error)
      ? r[$.error] instanceof URIError
        ? (r.statusEnd(400), console.error(400, r.url, '->', r[$.error])) // eslint-disable-line
        : (r.statusEnd(500), console.error(500, 'Uncaught route error', r[$.error].stack)) // eslint-disable-line
      : r.response instanceof Response
        ? r.end(r.response.body, r.response.status || 200 + (r.response.statusText ? ' ' + r.response.statusText : ''), r.response.headers)
        : r.statusEnd(404)
  }

  function route(...xs) {
    const x = xs.pop()
    if (typeof x !== 'function')
      return Server(x)

    const app = Server()
    x(app)
    router.all(...xs, app)
    return router
  }

  function listen(defaultOptions) {
    return async(port, address, options = {}) => {
      const backend = options.node || (options.node !== false && defaultOptions.node)
        ? await import('./node.js').then(x => x.default)
        : await import('./uws.js').then(x => x.default)

      return new Promise((resolve, reject) => {
        typeof address === 'object' && (options = address, address = null)
        const o = {
          [$.backend]: backend,
          ...defaultOptions,
          ...(options || {})
        }

        // Prettier errors than uws if missing
        o.cert && fs.accessSync(o.cert, fs.constants.R_OK) && fs.accessSync(o.key || 'private.key', fs.constants.R_OK)

        port = parseInt(port)
        wrapper = wrap
        uws = o.cert
          ? backend.SSLApp({ cert_file_name: o.cert, key_file_name: o.key, ...o })
          : backend.App(o)
        asn.forEach(xs => addServerName(...xs))
        rsn.forEach(xs => removeServerName(...xs))
        msn.forEach(xs => uws.missingServerName(...xs))
        connects.forEach((xs) => uws.connect(...xs))
        wss.forEach(([pattern, handlers]) =>
          uws.ws(
            pattern,
            {
              maxPayloadLength: 128 * 1024,
              ...handlers,
              ...(handlers.upgrade ? { upgrade: upgrader(o, pattern, handlers) } : {})
            }
          )
        )

        uws.any('/*', wrap)

        address
          ? uws.listen(address, port, callback)
          : uws.listen(port, o, callback)

        function callback(x) {
          if (!x)
            return reject(new Error('Could not listen on ' + port))

          handle = x
          resolve({ port: backend.us_socket_local_port(handle), handle, unlisten })
        }

        function unlisten() {
          return handle && backend.us_listen_socket_close(handle)
        }

        function wrap(res, req) {
          router(new Request(res, req, o))
        }
      })
    }
  }

  function ws(pattern, handlers) {
    typeof pattern !== 'string' && (handlers = pattern, pattern = '/*')
    wss.add([
      pattern,
      {
        ...handlers,
        open: catcher('open', handlers, open),
        message: catcher('message', handlers, message),
        subscription: catcher('subscription', handlers),
        drain: catcher('drain', handlers),
        ping: catcher('ping', handlers, message),
        pong: catcher('pong', handlers, message),
        close: catcher('close', handlers, close)
      }
    ])
  }

  function close(fn, ws, code, data) {
    ws[$.ws].open = false
    fn && fn(ws[$.ws], code, new Message(data, false))
  }

  function open(fn, ws) {
    ws[$.ws] = new Websocket(ws)
    fn && fn(ws[$.ws])
  }

  function message(fn, ws, data, binary) {
    fn && fn(ws[$.ws], new Message(data, binary))
  }

  function catcher(name, handlers, fn) {
    if (!(name in handlers) && !fn)
      return

    const method = handlers[name]
    return function(ws, ...xs) {
      try {
        fn
          ? fn(method, ws, ...xs)
          : method(ws[$.ws], ...xs)
      } catch (error) {
        name === 'close' || ws.end(1011, 'Internal Server Error')
        console.error(500, 'Uncaught ' + name + ' error', error) // eslint-disable-line
      }
    }
  }

  function register(name) {
    handlers.set(name, new Set())
    router[name] = function(match, options, ...fns) {
      if (typeof options === 'function') {
        fns.unshift(options)
        options = undefined
      }

      if (typeof match === 'function') {
        fns.unshift(match)
        match = true
      }

      if (typeof match === 'object' && match instanceof RegExp === false) {
        options = match
        match = true
      }

      options = {
        ...o,
        ...options,
        headers: o.headers
          ? o.headers.concat(options.headers || [])
          : options && options.headers
      }

      fns.forEach(fn => {
        if (typeof fn !== 'function')
          throw new Error(fn + ' is not a function')

        const isRouter = hasOwn.call(fn, 'handlers')
        const route = {
          options,
          handler: handler(fn),
          error: !isRouter && fn.length === 2,
          match: prepare(match, isRouter)
        }

        if (name === 'all') {
          for (const key of handlers.keys())
            handlers.get(key).add(route)
        } else {
          handlers.get(name).add(route)
          name === 'get' && handlers.get('head').add(route)
        }
      })

      return router
    }
  }
}

function handler(fn) {
  return hasOwn.call(fn, 'handlers')
    ? sub
    : direct

  function sub(x) {
    const url = x.r.url
    if (typeof x.match === 'string')
      x.r.url = x.r.url.slice(x.match.length)
    const result = direct(x)
    result && typeof result.then === 'function'
      ? result.finally(() => x.r.url = url)
      : x.r.url = url
    return result
  }

  function direct({ error, r }) {
    return error
      ? fn(error, r)
      : fn(r)
  }
}

function prepare(match, sub) {
  const fn = typeof match === 'string'
    ? prepareString(match, sub)
    : match instanceof RegExp
      ? prepareRegex(match, sub)
      : Array.isArray(match)
        ? prepareArray(match, sub)
        : match === true && (() => true)

  if (!fn)
    throw new Error('Unknown match type')

  return fn
}

function prepareString(match, sub) {
  const named = match.match(/\/:([a-z][a-z0-9_]*)?/g)
      , wildcard = match.endsWith('*') ? '.*?' : ''

  if (wildcard)
    match = match.slice(0, -1)

  if (!named && !wildcard) {
    return sub
      ? (r) => r.url.indexOf(match) === 0 && match
      : (r) => (r.url === match || r.url + '/' === match) && match
  }

  const names = named && named.map(n => n.slice(2))
  const regex = new RegExp(
       '^('
     + match.replace(/:.+?(\/|$)/g, '([^/]+?)$1').replace(/\*/, '')
     + ')'
     + wildcard
     + (sub ? '(/|$)' : '$')
  )

  return function(r) {
    const result = r.url.match(regex)
    result && names && names.forEach((n, i) => r.params[n] = decodeURIComponent(result[i + 2]))
    return result && result[1]
  }
}

function prepareRegex(match) {
  return function(r) {
    const result = r.url.match(match)
    result && result.forEach((m, i) => r.params[i] = m)
    return result && result[0]
  }
}

function prepareArray(match, sub) {
  match = match.map(m => prepare(m, sub))
  return function(r) {
    return match.some(fn => fn(r))
  }
}

function upgrader(options, pattern, handlers) {
  handlers.headers
    ? handlers.headers.push('sec-websocket-key', 'sec-websocket-protocol', 'sec-websocket-extensions')
    : handlers.headers === false && (handlers.headers = ['sec-websocket-key', 'sec-websocket-protocol', 'sec-websocket-extensions'])

  return async function(res, req, context) {
    res.options = options
    const r = new Request(res, req, { ...options, headers: handlers.headers })
    ;(pattern.match(/\/:([^/]+|$)/g) || []).map((x, i) => r.params[x.slice(2)] = res.getParameter(i))
    let error
      , data
    try {
      data = handlers.upgrade(r)
      data && typeof data.then === 'function' && (r.onAborted(), data = await data)
    } catch (err) {
      error = err
      console.error(500, 'Uncaught upgrade error', error) // eslint-disable-line
    }

    if (r.ended)
      return

    if (error)
      return r.statusEnd(500)

    r.status(101)
    r.cork(() =>
      res.upgrade(
        { data },
        r.headers['sec-websocket-key'],
        r.headers['sec-websocket-protocol'],
        r.headers['sec-websocket-extensions'],
        context
      )
    )
  }
}
