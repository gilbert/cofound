import crypto from 'node:crypto'
import fs from 'node:fs'

let unmasked = Buffer.alloc(0)
let mask = Buffer.alloc(0)
let done = false
let t = null
let op = 0
let i = -1
let o = 0
let l = 0

const utf8 = new TextDecoder('utf8', { fatal: true })
const wsStart = [
  'HTTP/1.1 101 Switching Protocols',
  'Upgrade: websocket',
  'Connection: Upgrade',
  'Sec-WebSocket-Accept: '
].join('\r\n')

class Request {
  constructor(req) {
    this._req = req
  }
  getMethod() { return this._req.method.toLowerCase() }
  getHeader(k) { return this._req.headers[k] }
  forEach(fn) { Object.entries(this._req.headers).forEach(([k, v]) => fn(k, v)) }

  getUrl() {
    i = this._req.url.indexOf('?')
    return i > -1
      ? this._req.url.slice(0, i)
      : this._req.url
  }
  getQuery() {
    i = this._req.url.indexOf('?')
    return i > -1
      ? this._req.url.slice(i + 1)
      : ''
  }
}

class WS {
  constructor(res, data, handlers) {
    this.data = data
    this._res = res
    this._handlers = handlers
    this._frames = null
    this._binary = false
    this._closed = false
    this._topics = new Set()
    this._buffers = null
    this._rest = 0
    this._length = 0
    this._last = Buffer.alloc(0)
    this._handlers.open(this)
    this._closeTimer = null
  }
  close() {
    this._res.end()
  }
  cork(fn) {
    this._res.cork()
    fn()
    this._res.uncork()
    return this
  }
  end(code, x) {
    typeof x === 'number' ? (x = Buffer.from('' + x)) :
    typeof x === 'string' && (x = Buffer.from(x))
    t = closeCode(code || 1000)
    frame(this, 8, x ? Buffer.concat([t, x]) : t)
    this._closeTimer = setTimeout(() => this.close(), 30 * 1000)
  }
  getBufferedAmount() {
    return 0
  }
  getRemoteAddress() { return Buffer.alloc(0) }
  getRemoteAddressAsText() { return Buffer.from(this._res.remoteAddress) }
  getTopics() {
    return [...this._topics]
  }
  getUserData() {
    return this._data
  }
  isSubscribed(topic) {
    return this._topics.has(topic)
  }
  ping(x) {
    typeof x === 'number' ? (x = Buffer.from('' + x)) :
    typeof x === 'string' && (x = Buffer.from(x))
    frame(this, 9, x || '')
  }
  publish(topic, message, binary, compress) {
    if (!this._topics.has(topic))
      return false
    this.send(message, binary, compress)
    return true
  }
  send(x, binary) {
    typeof x === 'number' ? (x = Buffer.from('' + x)) :
    typeof x === 'string' && (x = Buffer.from(x))
    return frame(this, binary ? 2 : 1, x) ? 1 : 0
  }
  subscribe(topic) {
    this._topics.add(topic)
    return true
  }
  unsubscribe(topic) {
    this._topics.delete(topic)
    return true
  }
}

class Response {
  constructor(res, req) {
    this._res = res
    this._req = req
    this._drain = null
    this._headers = [['Server', 'cofound']]
    this._res.on('close', () => this._aborted && this._aborted())
    this._res.on('error', () => this._aborted && this._aborted())
  }

  close() { return (this._req.destroy(), this) }
  cork(fn) {
    this._res.cork()
    fn()
    this._res.uncork()
    return this
  }
  end(x) { return (writeHeaders(this, null), this._res.end(x), this) }
  endWithoutBody() { return (this._res.end(), this) }
  getProxiedRemoteAddress() { throw new Error('Not Implemented') }
  getProxiedRemoteAddressAsText() { throw new Error('Not Implemented') }
  getRemoteAddress() { return Buffer.alloc(0) }
  getRemoteAddressAsText() { return Buffer.from(this._req.socket.remoteAddress) }
  getWriteOffset() {
    return this.offset
  }
  onAborted(cb) { (this._aborted = cb, this) }
  onData(fn) {
    this._req.on('data', fn)
    this._req.on('end', () => fn(Buffer.alloc(0), true))
    return this
  }
  onWritable(fn) {
    this._drain === null && this._res.on('drain', () => this._drain(this.offset))
    this._drain = fn
    return this
  }
  pause() { this._req.resume() }
  resume() { this._req.resume() }
  tryEnd(x, total) {
    if (this.offset === 0) {
      this._headers.push(['Content-Length', total])
      writeHeaders(this, total)
    }
    typeof x === 'string' && (x = Buffer.from(x))
    this.offset += x.byteLength
    done = this.offset === total
    return [
      done ? (this._res.end(x), true) : this._res.write(x),
      done
    ]
  }
  upgrade(x, key, protocol, extensions, handlers) {
    this.ws = new WS(this._res, x.data, handlers)
    this._res.on('data', x => ondata(this.ws, x))
    this._res.write(
      wsStart
      + crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
      + (protocol ? '\r\nSec-WebSocket-Protocol: ' + protocol : '')
      + (this._headers.length ? '\r\n' + this._headers.map(([k, v]) => k + ': ' + v).join('\r\n') : '')
      + '\r\n\r\n'
    )
  }
  writeHeader(h, v) { return (this._headers.push([h, v]), this) }
  write(x) {
    writeHeaders(this, null)
    typeof x === 'string' && (x = Buffer.from(x))
    this.offset += x.byteLength
    return this._res.write(x)
  }
  writeStatus(x) {
    i = x.indexOf(' ')
    this._res.statusCode = parseInt(i > -1 ? x.slice(0, i) : x)
    i > -1 && (this._res.statusMessage = x.slice(i + 1))
    return this
  }
}

export default {
  SSLApp(options) {
    options.key = fs.readFileSync(options.key_file_name)
    options.cert = fs.readFileSync(options.cert_file_name)
    return init(options, true)
  },
  App(options) { return init(options, false) },
  us_socket_local_port(handle) { return handle.address().port },
  async us_listen_socket_close(handle) {
    return new Promise((resolve, reject) => {
      handle.close(error => error ? reject(error) : resolve())
    })
  },
  getParts
}

function init(options, https) {
  let sockets = new Set()
    , wsHandlers = new Map()
    , httpHandler
    , server

  return {
    any: (_, x) => httpHandler = x,
    ws: (path, x) => wsHandlers.set(path, x),
    close: () => {
      sockets.forEach(x => {
        x.destroy()
        sockets.delete(x)
      })
      server?.close()
      server = null
    },
    listen(a, b, callback) {
      const [host, listenOptions, port] = [
        typeof a === 'string' ? a : '0.0.0.0',
        typeof b === 'number' ? {} : b,
        typeof b === 'number' ? b : a
      ]

      return Promise.resolve().then(async() => {
        try {
          const http = https
            ? await import('node:https')
            : await import('node:http')

          server = http.createServer(options, (req, res) => {
            sockets.add(req.socket)
            httpHandler
              ? httpHandler(new Response(res, req), new Request(req))
              : (res.statusCode = 404, res.statusMessage = 'Not Found', res.end('Not Found'))
          })

          server.on('upgrade', wsHandler)

          server.on('error', error => {
            console.error(error) // eslint-disable-line
            callback()
          })

          server.listen({
            host,
            port,
            reusePort: process.platform === 'linux',
            ...options,
            ...listenOptions
          },
            () => callback(server)
          )
        } catch (error) {
          console.error(error) // eslint-disable-line
          callback()
        }
      })
    }
  }

  async function wsHandler(req, res) {
    res = new Response(res, req)
    req = new Request(req)

    if (req.getHeader('sec-websocket-version') !== '13')
      return res.writeStatus('400 Bad Request').writeHeader('Sec-WebSocket-Version', '13').end()

    if (!wsHandlers.has(req.url) && !wsHandlers.has('/*'))
      return res.writeStatus('404 Not Found').end()

    const handler = wsHandlers.get(req.url) || wsHandlers.get('/*')

    return handler.upgrade
      ? handler.upgrade(res, req, handler)
      : res.upgrade(
        {},
        req.getHeader('sec-websocket-key'),
        req.getHeader('sec-websocket-protocol'),
        req.getHeader('sec-websocket-extensions'),
        handler
      )
  }
}

function invalid(x) {
  try {
    utf8.decode(x)
    return false
  } catch (e) {
    return true
  }
}

function closeCode(x) {
  t = Buffer.allocUnsafe(2)
  t.writeUInt16BE(x)
  return t
}

function invalidCloseCode(x) {
  return x < 1000 || x === 1004 || x === 1005 || x === 1006 || x === 1016 || x === 1100 || x === 2000 || x === 2999
}


function writeHeaders(res) {
  // appendHeader, not setHeader: repeated headers (multiple Set-Cookie) must
  // all reach the response, matching the uws adapter's per-header writes.
  res._headers.forEach(([k, v]) => res._res.appendHeader(k, String(v)))
}

function ondata(ws, x) {
  if (ws._buffers) {
    ws._buffers.push(x)
    ws._rest -= x.byteLength
    if (ws._rest > 0)
      return
  }

  x = ws._buffers
    ? Buffer.concat(ws._buffers, ws._length - ws._rest)
    : ws._last.byteLength === 0
      ? x
      : Buffer.concat([ws._last, x], ws._last.byteLength + x.byteLength)

  while (x.byteLength >= 6) {
    if (x[0] & 112)
      return ws.end(1002)

    if ((x[1] & 128) === 0)
      return ws.end(1002)

    l = x[1] & 127
    o = 2

    l === 126
      ? (l = x.readUInt16BE(o), o = 4)
      : l === 127 && (l = Number(x.readBigUInt64BE(o)), o = 10)

    ws._length = 4 + o + l
    if (ws._length > x.byteLength) {
      ws._rest = ws._length - x.byteLength
      ws._buffers = [x]
      break
    }

    mask = x.subarray(o, o += 4)
    unmasked = Buffer.allocUnsafe(l)
    for (let i = 0; i < l; i++)
      unmasked[i] = x[o + i] ^ mask[i % 4]

    op = x[0] & 0xf
    if (op === 8) { // close
      if (ws._closed)
        return ws.close()
      t = unmasked.subarray(2)
      i = l < 2 ? 1000 : unmasked.readUint16BE(0)
      if (i >= 5000)
        return ws.close()
      frame(ws, 8, invalidCloseCode(i) || l > 125 || invalid(t) ? closeCode(1002) : unmasked.subarray(0, 2))
      ws._res.end()
      ws._handlers.close(ws, i, t)
      ws._closed = true
      clearTimeout(ws._closeTimer)
      break
    } else if (ws._closed) {
      break
    } else if (op === 0) { // continuation
      if (ws._frames === null)
        return ws.close()
      ws._frames.push(unmasked)
      if (x[0] & 128) { // fin
        t = Buffer.concat(ws._frames)
        if (!ws._binary && invalid(t))
          return ws.close()
        ws._handlers.message(ws, t, ws._binary)
        ws._frames = null
      }
    } else if (op === 1 || op === 2) { // text or binary
      if (ws._frames)
        return ws.close()
      ws._binary = op === 2
      if (x[0] & 128) { // fin
        if (!ws._binary && invalid(unmasked))
          return ws.close()
        ws._handlers.message(ws, unmasked, ws._binary)
      } else {
        ws._frames = [unmasked]
      }
    } else if (op === 9) { // ping
      if ((x[0] & 128) === 0 || l > 125)
        return ws.close()
      ws._handlers.ping(ws, unmasked)
      frame(ws, 10, unmasked)
    } else if (op === 10) { // pong
      if ((x[0] & 128) === 0 || l > 125)
        return ws.close()
      ws._handlers.pong(ws, unmasked)
    } else {
      return ws.close()
    }

    x = x.subarray(ws._length)
    ws._rest = ws._length = 0
    ws._buffers = null
  }

  ws._last = x
}

function frame(ws, op, x) {
  l = x.byteLength
  t = Buffer.allocUnsafe(l < 126 ? 2 : l < 65536 ? 4 : 10)
  t[0] = 128 + op
  if (l < 126) {
    t[1] = l
  } else if (l < 65536) {
    t[1] = 126
    t.writeUInt16BE(l, 2)
  } else {
    t[1] = 127
    t.writeBigUInt64BE(BigInt(l), 2)
  }

  ws._res.cork()
  ws._res.write(t)
  t = ws._res.write(x)
  ws._res.uncork()
  return t
}

function getParts(body, contentType) {
  if (!Buffer.isBuffer(body))
    body = Buffer.from(body)

  const boundary = getBoundary(contentType)
  if (!boundary)
    return []

  t = Buffer.from('--' + boundary)
  o = 0


  i = body.indexOf(t, o)
  if (i === -1)
    return []

  const parts = []
  o = i + t.length
  if (body[o] === 13 && body[o + 1] === 10)
    o += 2
  else if (body[o] === 10)
    o++

  while (o < body.length) {
    i = body.indexOf(t, o)
    if (i === -1)
      break

    let x = body.subarray(o, i)
    while (x.length && (x[x.length - 1] === 13 || x[x.length - 1] === 10))
      x = x.slice(0, x.length - 1)

    let delim = Buffer.from('\r\n\r\n')
    let end = x.indexOf(delim)
    if (end === -1) {
      delim = Buffer.from('\n\n')
      end = x.indexOf(delim)
    }
    if (end === -1) {
      o = i + t.length
      continue
    }
    const headers = getHeaders(x.subarray(0, end))
    const data = x.subarray(end + delim.length)
    const { name, filename } = getParameters(headers['content-disposition'])

    parts.push({
      name: name,
      filename: filename,
      data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      type: headers['content-type']
    })

    o = i + t.length
    if (body[o] === 45 && body[o + 1] === 45)
      break
    if (body[o] === 13 && body[o + 1] === 10)
      o += 2
    else if (body[o] === 10)
      o++
  }
  return parts
}

function getBoundary(x) {
  if (!x)
    return null

  i = x.indexOf('boundary=')
  if (i === -1)
    return null

  t = x.substring(i + 9).trim()
  if (t.startsWith('"') && t.endsWith('"'))
    t = t.slice(1, -1)

  if (t.length < 1 || t.length > 70)
    return null

  return t
}

function getHeaders(h) {
  const xs = {}
  let o = 0
  while (o < h.length) {
    let eol = h.indexOf(10, o)
    if (eol === -1)
      eol = h.length
    let x = h.subarray(o, eol)
    if (x.length && x[x.length - 1] === 13)
      x = x.subarray(0, x.length - 1)
    if (x.length === 0)
      break
    const i = x.indexOf(58)
    if (i !== -1)
      xs[x.subarray(0, i).toString().trim().toLowerCase()] = x.subarray(i + 1).toString().trim()
    o = eol + 1
  }
  return xs
}

function getParameters(p) {
  if (!p)
    return {}

  const xs = {}
  for (let x of p.split(';')) {
    x = x.trim()
    const i = x.indexOf('=')
    if (i === -1)
      continue

    let t = x.substring(i + 1).trim()
    if (t.startsWith('"') && t.endsWith('"'))
      t = t.slice(1, -1)

    xs[x.substring(0, i).trim()] = t
  }
  return xs
}
