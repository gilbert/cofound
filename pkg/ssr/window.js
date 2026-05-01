import window from '../src/window.js'
import { asLocation } from './shared.js'
import { hasOwn, noop } from '../src/shared.js'
import px from './px.js'

const rules = new Set()

class Node {
  constructor(x) {
    this.trusted = x
  }
}

export default window

Object.assign(window, {
  isServerCos: true,
  Node,
  XMLHttpRequest,
  scrollTo: noop,
  requestAnimationFrame: noop,
  cancelAnimationFrame: noop,
  addEventListener: noop,
  location: asLocation(new URL('', 'http://localhost')),
  history: {
    pushState: routeChange,
    replaceState: routeChange,
    state: null
  },
  CSS: {
    supports: () => true
  },
  document: {
    body: {},
    querySelector: () => null,
    createElement: x => {
      const dom = {
        tagName: x,
        setAttribute: (x, v) => dom.x = v,
        getAttribute: x => dom[x],
        style: {
          ...px,
          setProperty: function(prop) {
            this[prop] = '1' + (px[prop] || '')
          }
        }
      }
      x === 'style' && Object.assign(dom, {
        sheet: {
          insertRule: (rule, index) => {
            if (rule.indexOf('@keyframes') === 0 && rules.has(rule))
              return
            rules.add(rule)
            return index
              ? dom.sheet.cssRules.splice(index, 0, rule)
              : dom.sheet.cssRules.push(rule)
          },
          cssRules: []
        }
      })
      return dom
    }
  }
})

function routeChange(state, title, path) {
  window.history.state = state
  window.location = asLocation(new URL(path, window.location.origin || 'http://localhost'))
}

function XMLHttpRequest(options) {
  const body = []
      , headers = {}
      , events = new Map()

  let req
    , res
    , method
    , url
    , auth
    , loaded = 0
    , total
    , responseText

  const xhr = {
    UNSENT:           0,
    OPENED:           1,
    HEADERS_RECEIVED: 2,
    LOADING:          3,
    DONE:             4,

    status: 0,
    readyState: 0,
    responseType: '',

    get response() {
      const x = Buffer.concat(body)
      return xhr.responseType === '' || xhr.responseType === 'text'
        ? x.toString()
        : xhr.responseType === 'json'
        ? JSON.parse(x)
        : xhr.responseType === 'arraybuffer'
        ? x.buffer
        : null
    },

    get responseText() {
      return responseText || (responseText = Buffer.concat(body).toString())
    },

    addEventListener(name, fn) {
      events.has(name) || events.set(name, new Set())
      events.get(name).add(fn)
    },

    removeEventListener(name, fn) {
      if (!events.has(name))
        return

      const xs = events.get(name)
      xs.delete(fn)
      xs.size === 0 && events.delete(name)
    },

    abort() {
      state(xhr.UNSENT)
      req && req.abort()
    },

    getResponseHeader(name) {
      return res && res.headers[name.toLowerCase()] || null
    },

    getAllResponseHeaders() {
      if (!res)
        return null
      let x = ''
      for (let i = 0; i < res.rawHeaders.length; i++)
        x += i % 2 === 0 ? (res.rawHeaders[i] + ': ') : (res.rawHeaders[i] + '\n')
      return x
    },

    setRequestHeader(header, value) {
      headers[header] = value
    },

    open(m, u, async, user = '', pass = '') {
      if (xhr.readyState !== xhr.UNSENT)
        return xhr.abort()

      state(xhr.OPENED)
      method = m
      url = (!u.match(/^[a-z]+:\//) && window.location.origin || '') + u
      user && (auth = user + ':' + pass)
    },

    async send(data) {
      const http = (url.startsWith('https:')
        ? await import('https')
        : await import('http')
      ).default

      try {
        req = http.request(url, {
          headers,
          method,
          auth,
          ...options
        }, r => {
          res = r
          xhr.headers = res.headers
          xhr.status = res.statusCode
          total = res.headers['content-length']
          state(xhr.HEADERS_RECEIVED)
          res.on('data', x => {
            state(xhr.LOADING)
            loaded += x.length
            emit('loadstart', { loaded, total, lengthComputable: total !== null })
            emit('progress', { loaded, total, lengthComputable: total !== null })
            body.push(x)
          })
          res.on('end', () => {
            emit('loadend', { loaded, total, lengthComputable: total !== null })
            emit('load', { loaded, total, lengthComputable: total !== null })
            state(xhr.DONE)
          })
          res.on('error', e => emit('error', e))
        })
        req.on('error', error)
        xhr.timeout && (req.setTimeout(xhr.timeout), req.on('timeout', () => req.abort()))
        data !== undefined && req.write(data)
        req.end()
      } catch (e) {
        error(e)
      }
    }
  }

  return xhr

  function state(x) {
    if (xhr.readyState === x)
      return
    xhr.readyState = x
    emit('readystatechange', {})
  }

  function error(error) {
    // xhr.response = null
    xhr.status = 0
    emit('error', error)
    emit('loadend', { loaded, total, lengthComputable: total === 0 || total > 0 })
  }

  function emit(name, x) {
    hasOwn.call(xhr, 'on' + name) && xhr['on' + name](x)
    events.has(name) && events.get(name).forEach(fn => fn(x))
  }
}
