import { Readable } from 'node:stream'

// Streaming multipart/form-data parsing: parts arrive as Readable streams in
// document order, so arbitrarily large file uploads never buffer in memory.
// The buffered r.body('multipart') path stays for small forms.

const HEADER_END = Buffer.from('\r\n\r\n')
const DEFAULT_MAX_HEADER_SIZE = 16 * 1024

export function multipartBoundary(contentType) {
  if (!contentType)
    return null

  const i = contentType.indexOf('boundary=')
  if (i === -1)
    return null

  let boundary = contentType.substring(i + 9).split(';')[0].trim()
  if (boundary.startsWith('"') && boundary.endsWith('"'))
    boundary = boundary.slice(1, -1)

  return boundary.length >= 1 && boundary.length <= 70 ? boundary : null
}

// Async generator of parts from a Buffer source (Readable / async iterable).
// Each part is { name, filename, type, headers, stream, text(), buffer() }.
// A part's stream must be consumed while the part is current; advancing the
// iterator drains whatever the consumer left unread.
export async function* iterateParts(source, boundary, options = {}) {
  const maxHeaderSize = options.maxHeaderSize || DEFAULT_MAX_HEADER_SIZE
  const delimiter = Buffer.from('\r\n--' + boundary)
  const iterator = source[Symbol.asyncIterator]()
  // The virtual leading CRLF lets the first `--boundary` line match the same
  // delimiter as every later one.
  let buf = Buffer.from('\r\n')
  let sourceDone = false

  async function pull() {
    if (sourceDone)
      return false
    const { value, done } = await iterator.next()
    if (done) {
      sourceDone = true
      return false
    }
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
    if (chunk.length)
      buf = buf.length ? Buffer.concat([buf, chunk]) : chunk
    return true
  }

  // Skip any preamble up to the first delimiter.
  while (true) {
    const i = buf.indexOf(delimiter)
    if (i !== -1) {
      buf = buf.subarray(i + delimiter.length)
      break
    }
    if (buf.length > delimiter.length)
      buf = buf.subarray(buf.length - delimiter.length)
    if (!await pull())
      return // no parts at all
  }

  while (true) {
    // After a delimiter: `--` closes the body, CRLF opens the next part.
    while (buf.length < 2) {
      if (!await pull())
        throw new Error('Unexpected end of multipart body')
    }
    if (buf[0] === 45 && buf[1] === 45)
      return
    if (buf[0] !== 13 || buf[1] !== 10)
      throw new Error('Malformed multipart boundary')
    buf = buf.subarray(2)

    let headerEnd
    while ((headerEnd = buf.indexOf(HEADER_END)) === -1) {
      if (buf.length > maxHeaderSize)
        throw new Error('Multipart part headers too large')
      if (!await pull())
        throw new Error('Unexpected end of multipart headers')
    }
    if (headerEnd > maxHeaderSize)
      throw new Error('Multipart part headers too large')
    const headers = parseHeaders(buf.subarray(0, headerEnd).toString())
    buf = buf.subarray(headerEnd + HEADER_END.length)
    const { name, filename } = dispositionParameters(headers['content-disposition'])

    // Body: pumped on demand by the part stream's reads, with the delimiter
    // tail held back until it's provably data.
    let partDone = false
    let draining = false
    let pumpError = null
    let active = null

    const stream = new Readable({
      read() {
        pump().catch(() => {}) // errors land on the stream and the iterator
      }
    })

    const emit = data => {
      if (!data.length || draining || stream.destroyed)
        return true
      return stream.push(data)
    }

    const pump = () => active ||= run().finally(() => { active = null })

    async function run() {
      try {
        while (!partDone) {
          const i = buf.indexOf(delimiter)
          if (i !== -1) {
            const data = buf.subarray(0, i)
            buf = buf.subarray(i + delimiter.length)
            partDone = true
            emit(data)
            stream.destroyed || stream.push(null)
            return
          }
          const keep = delimiter.length - 1
          let writable = true
          if (buf.length > keep) {
            const data = buf.subarray(0, buf.length - keep)
            buf = buf.subarray(buf.length - keep)
            writable = emit(data)
          }
          if (!writable)
            return // backpressure: the next read() resumes the pump
          if (!await pull())
            throw new Error('Unexpected end of multipart body')
        }
      } catch (error) {
        pumpError = error
        stream.destroyed || stream.destroy(error)
        throw error
      }
    }

    yield {
      name,
      filename,
      type: headers['content-type'] || null,
      headers,
      stream,
      async buffer() {
        const chunks = []
        for await (const chunk of stream)
          chunks.push(chunk)
        return Buffer.concat(chunks)
      },
      async text() {
        return (await this.buffer()).toString()
      }
    }

    // The consumer moved on — drain whatever it left unread.
    draining = true
    while (!partDone && !pumpError)
      await pump().catch(() => {})
    if (pumpError)
      throw pumpError
  }
}

function parseHeaders(block) {
  const headers = {}
  for (const line of block.split('\r\n')) {
    const i = line.indexOf(':')
    if (i === -1)
      continue
    headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim()
  }
  return headers
}

function dispositionParameters(disposition) {
  return {
    name: dispositionParameter(disposition, 'name'),
    filename: dispositionParameter(disposition, 'filename')
  }
}

function dispositionParameter(disposition, key) {
  const match = ('' + (disposition || '')).match(new RegExp(key + '="((?:[^"\\\\]|\\\\.)*)"|' + key + '=([^;]+)'))
  if (!match)
    return null
  const value = match[1] != null ? match[1].replace(/\\(.)/g, '$1') : match[2].trim()
  return value === '' ? value : value || null
}
