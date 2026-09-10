import net from 'node:net'
import tls from 'node:tls'
import process from 'node:process'
import { symbols as $ } from './shared.js'

const nets = new Map()
const tlss = new Map()
const keepAlive = parseInt(process.env.COFOUND_PROXY_KEEP_ALIVE || (2 * 60 * 1000))

export default function(r, url, options = {}) {
  url = new URL(url)
  url.secure = url.protocol === 'https:'
  const xs = url.secure ? tlss : nets
  const headers = options.headers ? { ...r.headers, ...options.headers } : r.headers
  const head = r.method.toUpperCase() + ' '
    + url.pathname + url.search + ' HTTP/1.1\r\n'
    + Object.entries(headers).map(([h, v]) => h + ': ' + v).join('\r\n')
    + '\r\n\r\n'

  return xs.has(url.host)
    ? reuse(r, url, xs, head)
    : open(r, url, url.secure ? tls : net, xs, head, options)
}

function reuse(r, url, xs, head) {
  const sockets = xs.get(url.host)
  const socket = sockets.pop()
  sockets.length || xs.delete(url.host)
  socket(r, url, head)
}

function remove(xs, host, x) {
  if (!xs.has(host))
    return

  const sockets = xs.get(host)
  const i = sockets.indexOf(x)
  i === -1 || sockets.splice(i, 1)
  sockets.length || xs.delete(host)
}

function open(r, url, x, xs, head, options) {
  let i = -1
  let header = -1
  let body = -1
  let colon = -1
  let char = -1
  let space = -1
  let name = ''
  let value = ''
  let lower = ''
  let offset = -1
  let aborted = null
  let timer = null
  let chunked = false
  let line = 1
  let size = 0
  let code = 0
  let empty = false
  let ended = false
  let pending = null

  const s = x.connect({
    host: url.hostname,
    port: url.port || (url.secure ? 443 : 80),
    ...options,
    servername: options.servername || options.headers?.host || (
      url.secure && !net.isIP(url.host) ? url.host : undefined
    ),
    onread: {
      buffer: Buffer.alloc(128 * 1024),
      callback: function read(length, buffer) {
        if (ended)
          return

        if (body !== -1)
          return write(r, buffer.subarray(0, length))

        if (pending !== null) {
          buffer = Buffer.concat([pending, buffer.subarray(0, length)])
          length = buffer.length
          pending = null
        }

        i = 0
        if (header === -1) {
          while (header === -1 && ++i < length) {
            if (buffer[i] === 10)
              header = i = i + 1
            else if (buffer[i] === 13)
              header = i = i + 2
          }
        }
        if (code === 0 && header !== -1) {
          code = (buffer[9] - 48) * 100 + (buffer[10] - 48) * 10 + buffer[11] - 48
          if (code < 200) {
            i = header - 1
            while (body === -1 && ++i < length) {
              if (buffer[i] === 10)
                i - header < 2 ? body = i + 1 : header = i + 1
            }

            const rest = body
            code = 0
            i = header = body = colon = space = -1

            if (rest === -1)
              return keep(buffer, length)

            if (rest === length)
              return

            return read(length - rest, buffer.subarray(rest))
          }

          r.status(buffer.toString('utf8', 9, header).trim())
          empty = code === 204 || code === 304 || (head[0] === 'H' && head[1] === 'E')
        }

        if (body === -1) {
          while (body === -1 && ++i < length) {
            char = buffer[i]
            if (char === 10) {
              if (i - header < 2) {
                body = i + 1
              } else {
                name = buffer.toString('utf8', header, colon)
                value = buffer.toString('utf8', colon > space ? colon : space, i - 1)
                lower = name.toLowerCase()
                lower === 'host'
                  ? r.set('Host', url.hostname)
                  : lower === 'transfer-encoding'
                  ? chunked = value.toLowerCase().indexOf('chunked') !== -1
                  : r.set(name, value)
                header = i + 1
              }
            } else if (colon < header && char === 58) {
              colon = i
            } else if (space < header && char === 32) {
              space = i + 1
            }
          }
        }
        body === -1
          ? keep(buffer, length)
          : empty ? end() : write(r, buffer.subarray(body, length))
      }
    }
  })

  r.onAborted(() => ended || (ended = true, aborted && aborted(), s.destroy()))
  s.setKeepAlive(true, keepAlive)
  s.once('connect', connect)
  s.once('error', error)
  s.once('close', close)

  function keep(buffer, length) {
    const from = Math.max(header, 0)
    if (length - from > 128 * 1024)
      return s.destroy(new Error('Header overflow from ' + url.host))

    pending = Buffer.from(buffer.subarray(from, length))
    header === -1 || (header = 0)
    colon = space = -1
  }

  function connect() {
    s.write(head)
    r.readable.pipe(s, { end: false })
  }

  function error(error) {
    ended || (ended = true, r.end(error, 500))
  }

  function close() {
    clearTimeout(timer)
    remove(xs, url.host, start)
    ended || (ended = true, r.end())
  }

  function finished() {
    ended = true
    aborted = null
    timer = setTimeout(() => s.destroy(), keepAlive)
    xs.has(url.host)
      ? xs.get(url.host).push(start)
      : xs.set(url.host, [start])
  }

  function start(...xs) {
    [r, url, head] = xs
    clearTimeout(timer)
    i = header = body = colon = char = space = offset = -1
    name = value = lower = ''
    chunked = empty = ended = false
    size = code = 0
    line = 1
    aborted = pending = null
    r.onAborted(() => ended || (ended = true, aborted && aborted(), s.destroy()))
    connect()
  }

  async function write(r, buffer) {
    if (chunked)
      return dechunk(r, buffer)

    if (r[$.length] !== null) {
      offset = r.getWriteOffset()
      const [ok, done] = r.tryEnd(buffer, r[$.length])
      if (done)
        return finished()

      ok || await new Promise(resolve => {
        s.pause()
        aborted = resolve
        r.onWritable(i => {
          const [ok] = r.tryEnd(buffer.subarray(i - offset), r[$.length])
          ok && resolve()
          return ok
        })
      })
      s.resume()
    } else {
      r.write(buffer) || await drain()
    }
  }

  async function dechunk(r, buffer) {
    let i = 0
    const l = buffer.length
    while (i < l) {
      if (line) {
        const c = buffer[i++]
        if (c === 10) {
          if (size === 0)
            return end()
          line = 0
        } else if (line === 1) {
          const n = c >= 48 && c <= 57 ? c - 48
            : c >= 97 && c <= 102 ? c - 87
            : c >= 65 && c <= 70 ? c - 55
            : -1
          n === -1 ? line = 2 : size = size * 16 + n
        }
      } else if (size > 0) {
        const n = size < l - i ? size : l - i
        const x = buffer.subarray(i, i + n)
        i += n
        size = size === n ? -2 : size - n
        r.write(x) || await drain()
        if (ended)
          return
      } else {
        i++
        ++size || (line = 1)
      }
    }
  }

  function drain() {
    s.pause()
    return new Promise(resolve => {
      aborted = resolve
      r.onWritable(() => (s.resume(), resolve(), true))
    })
  }

  function end() {
    if (ended)
      return

    ended = true
    r.end()
    finished()
  }
}
