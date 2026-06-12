import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import t from 'cofound/test'
import { iterateParts, multipartBoundary } from '../shared/server/multipart.js'
import { makeTestServer } from '../shared/server/test-utils.js'

const BOUNDARY = 'test-boundary-123'

function payload(parts, { preamble = '', epilogue = '' } = {}) {
  const chunks = [Buffer.from(preamble)]
  for (const part of parts) {
    let head = 'content-disposition: form-data; name="' + part.name + '"'
    if (part.filename != null)
      head += '; filename="' + part.filename + '"'
    if (part.type)
      head += '\r\ncontent-type: ' + part.type
    chunks.push(Buffer.from('--' + BOUNDARY + '\r\n' + head + '\r\n\r\n'))
    chunks.push(Buffer.isBuffer(part.data) ? part.data : Buffer.from(part.data))
    chunks.push(Buffer.from('\r\n'))
  }
  chunks.push(Buffer.from('--' + BOUNDARY + '--' + epilogue))
  return Buffer.concat(chunks)
}

async function collect(body, { chunks = null, consume = true } = {}) {
  const source = chunks
    ? Readable.from(chunks)
    : Readable.from([body])
  const out = []
  for await (const part of iterateParts(source, BOUNDARY)) {
    out.push({
      name: part.name,
      filename: part.filename,
      type: part.type,
      data: consume ? await part.buffer() : null
    })
  }
  return out
}

t`multipart`(
  t`extracts boundaries from content-type headers`(() => {
    t.is(BOUNDARY, multipartBoundary('multipart/form-data; boundary=' + BOUNDARY))
    t.is('a b', multipartBoundary('multipart/form-data; boundary="a b"; charset=utf-8'))
    t.is(null, multipartBoundary('application/json'))
    t.is(null, multipartBoundary(''))
    t.is(null, multipartBoundary('multipart/form-data; boundary=' + 'x'.repeat(71)))
  }),

  t`parses fields and files in order`(async () => {
    const parts = await collect(payload([
      { name: 'field', data: 'hello world' },
      { name: 'file', filename: 'clip.mp4', type: 'video/mp4', data: 'binary-ish\r\ncontent' },
      { name: 'empty', filename: 'empty.bin', type: 'application/octet-stream', data: '' },
    ]))
    t.is(3, parts.length)
    t.is('field', parts[0].name)
    t.is(null, parts[0].filename)
    t.is('hello world', parts[0].data.toString())
    t.is('clip.mp4', parts[1].filename)
    t.is('video/mp4', parts[1].type)
    t.is('binary-ish\r\ncontent', parts[1].data.toString())
    t.is(0, parts[2].data.length)
  }),

  t`tolerates preambles and epilogues`(async () => {
    const parts = await collect(payload(
      [{ name: 'only', data: 'value' }],
      { preamble: 'ignore me\r\n', epilogue: '\r\ntrailing junk' }
    ))
    t.is(1, parts.length)
    t.is('value', parts[0].data.toString())
  }),

  t`parses identically across every two-chunk split`(async () => {
    // Part data deliberately contains delimiter lookalikes.
    const body = payload([
      { name: 'a', data: 'plain' },
      { name: 'b', filename: 'tricky.bin', type: 'application/octet-stream', data: '\r\n--' + BOUNDARY.slice(0, -1) + '!\r\n--almost' },
    ])
    const expected = JSON.stringify((await collect(body)).map(part => ({ ...part, data: part.data.toString('base64') })))

    for (let split = 1; split < body.length; split++) {
      const parts = await collect(null, { chunks: [body.subarray(0, split), body.subarray(split)] })
      const actual = JSON.stringify(parts.map(part => ({ ...part, data: part.data.toString('base64') })))
      if (actual !== expected)
        throw new Error('Parse mismatch when split at byte ' + split)
    }
  }),

  t`streams large file parts chunk by chunk`(async () => {
    const big = crypto.randomBytes(4 * 1024 * 1024)
    const body = payload([
      { name: 'before', data: 'x' },
      { name: 'file', filename: 'big.bin', type: 'application/octet-stream', data: big },
      { name: 'after', data: 'y' },
    ])
    const chunks = []
    for (let i = 0; i < body.length; i += 64 * 1024)
      chunks.push(body.subarray(i, i + 64 * 1024))

    const source = Readable.from(chunks)
    const seen = []
    for await (const part of iterateParts(source, BOUNDARY)) {
      if (part.name !== 'file') {
        seen.push([part.name, await part.text()])
        continue
      }
      const hash = crypto.createHash('sha1')
      let pieces = 0
      for await (const chunk of part.stream) {
        hash.update(chunk)
        pieces++
      }
      t.is(true, pieces > 1)
      seen.push(['file', hash.digest('hex')])
    }
    t.is(JSON.stringify([
      ['before', 'x'],
      ['file', crypto.createHash('sha1').update(big).digest('hex')],
      ['after', 'y'],
    ]), JSON.stringify(seen))
  }),

  t`drains unconsumed parts when the consumer advances`(async () => {
    const body = payload([
      { name: 'skipped', filename: 'skip.bin', data: 'z'.repeat(256 * 1024) },
      { name: 'wanted', data: 'still here' },
    ])
    const names = []
    let wanted = null
    for await (const part of iterateParts(Readable.from([body]), BOUNDARY)) {
      names.push(part.name)
      if (part.name === 'wanted')
        wanted = await part.text()
      // 'skipped' is intentionally never read
    }
    t.is('skipped,wanted', names.join(','))
    t.is('still here', wanted)
  }),

  t`rejects truncated bodies and oversized headers`(async () => {
    const truncated = payload([{ name: 'cut', data: 'data' }]).subarray(0, 40)
    let error = null
    try {
      await collect(truncated)
    } catch (err) {
      error = err
    }
    t.is(true, /Unexpected end of multipart/.test(error?.message || ''))

    const hugeHeader = Buffer.concat([
      Buffer.from('--' + BOUNDARY + '\r\ncontent-disposition: form-data; name="' + 'h'.repeat(32 * 1024) + '"\r\n\r\nx\r\n--' + BOUNDARY + '--'),
    ])
    error = null
    try {
      await collect(hugeHeader)
    } catch (err) {
      error = err
    }
    t.is(true, /headers too large/.test(error?.message || ''))
  }),

  t`r.parts() streams a real upload through the node server`(async () => {
    const server = await makeTestServer(app => {
      app.post('/upload', async r => {
        const fields = {}
        const files = []
        for await (const part of r.parts()) {
          if (part.filename == null) {
            fields[part.name] = await part.text()
            continue
          }
          const hash = crypto.createHash('sha1')
          let bytes = 0
          for await (const chunk of part.stream) {
            hash.update(chunk)
            bytes += chunk.length
          }
          files.push({ name: part.name, filename: part.filename, type: part.type, bytes, sha1: hash.digest('hex') })
        }
        r.json({ fields, files })
      })
    })

    try {
      const bytes = crypto.randomBytes(3 * 1024 * 1024)
      const form = new FormData()
      form.append('deviceAssetId', 'device-1')
      form.append('fileCreatedAt', '2024-06-15T10:30:00.000Z')
      form.append('assetData', new Blob([bytes], { type: 'video/mp4' }), 'phone-clip.mp4')

      const res = await fetch('http://localhost:' + server.port + '/upload', { method: 'POST', body: form })
      t.is(200, res.status)
      const data = await res.json()
      t.is('device-1', data.fields.deviceAssetId)
      t.is('2024-06-15T10:30:00.000Z', data.fields.fileCreatedAt)
      t.is(1, data.files.length)
      t.is('phone-clip.mp4', data.files[0].filename)
      t.is('video/mp4', data.files[0].type)
      t.is(bytes.length, data.files[0].bytes)
      t.is(crypto.createHash('sha1').update(bytes).digest('hex'), data.files[0].sha1)
    } finally {
      await server.close()
    }
  }),
)
