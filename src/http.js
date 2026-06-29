import window from './window.js'

['head', 'get', 'put', 'post', 'delete', 'patch'].forEach(x =>
  http[x] = function(url, object = {}) {
    object.method = x
    return http(url, object)
  }
)

http.redraw = () => { /* noop */ }

const TypedArray = typeof Uint8Array === 'undefined' ? [] : [Object.getPrototypeOf(Uint8Array)]
    , rich = 'Blob ArrayBuffer DataView FormData URLSearchParams File'.split(' ').map(x => globalThis[x]).filter(x => x).concat(TypedArray)

export default function http(x, {
  url = new URL(x, window.location.origin),
  method = 'GET',
  responseType,
  json = 'application/json',
  query,
  body,
  user = url.username,
  pass = url.password,
  headers = {},
  config,
  timeout = 0,
  ...options
} = {}) {
  const origin = typeof 'chrome' === 'undefined' && new Error()
  const xhr = new window.XMLHttpRequest(options)
  let full = false
  const promise = new Promise((resolve, reject) => {
    let accept
      , contentType

    method = method.toUpperCase()

    xhr.addEventListener('readystatechange', function() {
      if (xhr.readyState !== xhr.DONE)
        return

      try {
        xhr.headers = xhr.headers || parse(xhr.getAllResponseHeaders())
        xhr.status && Object.defineProperty(xhr, 'body', {
          value: accept === json
            ? xhr.response === undefined || xhr.response === ''
              ? undefined
              : JSON.parse(xhr.response)
            : xhr.response
        })
        xhr.status === 304 || (xhr.status >= 200 && xhr.status < 300)
          ? resolve(full ? xhr : xhr.body)
          : reject(statusError(xhr))
      } catch (e) {
        reject(e)
      }
    })
    xhr.addEventListener('error', reject)
    xhr.addEventListener('abort', () => reject(new Error('ABORTED')))
    query && (query = new URLSearchParams(query)) && query.size && query.forEach((v, k) => url.searchParams.append(k, v))
    xhr.open(method, '' + url, true, user, pass)
    xhr.timeout = timeout
    responseType && (xhr.responseType = responseType)

    Object.entries(headers).forEach(([x, v]) => {
      v && xhr.setRequestHeader(x, v)
      x.toLowerCase() === 'accept' && (accept = v)
      x.toLowerCase() === 'content-type' && (contentType = v)
    })

    !accept && !responseType && json && xhr.setRequestHeader('Accept', accept = json)
    !contentType && body !== undefined && !rich.some(x => body instanceof x) && json && xhr.setRequestHeader('Content-Type', contentType = json)

    config && config(xhr)
    xhr.send(contentType === json ? JSON.stringify(body) : body)
  }).catch(error => {
    origin && !origin.message && Object.defineProperty(origin, 'message', { value: error.message })
    const x = Object.assign(origin || new Error(error.message), {
      ...error,
      url,
      status: xhr.status,
      headers: xhr.headers,
      body: xhr.body || xhr.response
    })
    Object.defineProperty(x, 'xhr', { value: xhr })
    throw x
  })

  Object.defineProperty(promise, 'xhr', {
    get() {
      full = true
      return promise
    }
  })

  return promise
}

function statusError(xhr) {
  return new Error(xhr.status
    ? xhr.status + (xhr.statusText ? ' ' + xhr.statusText : '')
    : 'Unknown'
  )
}

function parse(x) {
  const xs = {}
  x.split('\n').forEach(x => {
    const i = x.indexOf(':')
    const name = x.substring(0, i).trim().toLowerCase()
    const value = x.substring(i + 1).trim()
    name === 'set-cookie'
      ? xs[name] ? xs[name].push(value) : (xs[name] = [value])
      : xs[name] = value
  })
  return xs
}
