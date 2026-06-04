# Server Request Object

Route handlers receive one terse request object, conventionally named `r`.
It owns both the incoming request and outgoing response:

```js
export default function(app) {
  app.post('/api/items/:id', async r => {
    const body = await r.body('json')
    r.json({ id: r.params.id, body })
  })
}
```

## Request Data

```js
r.method      // lower-case method, such as 'get', 'post', or 'head'
r.url         // path without query string
r.pathname    // same value as r.url
r.rawQuery    // raw query string without '?'
r.query       // URLSearchParams
r.params      // route params from /path/:name
r.headers     // lower-case request headers
r.ip          // client IP, honoring x-forwarded-for
r.protocol    // 'http' or 'https'
r.secure      // true when protocol is https
```

`r.query` is lazy:

```js
app.get('/search', r => {
  const q = r.query.get('q') || ''
  r.json({ q })
})
```

## Request Body

Use `r.body(type)` when the body should be read into memory:

```js
await r.body()            // Buffer
await r.body('text')      // string
await r.body('json')      // parsed JSON
await r.body('multipart') // parsed multipart parts
```

For streaming uploads, use `r.readable`:

```js
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

app.post('/upload', async r => {
  await pipeline(r.readable, createWriteStream('upload.bin'))
  r.end('', 204)
})
```

`r.onData(fn)` exposes the lower-level chunk callback used by `r.body()` and
`r.readable`. Prefer `r.body()` or `r.readable` unless the handler needs direct
chunk control.

## Responses

```js
r.status(201)
r.header('X-App', 'cofound')
r.header({ 'Cache-Control': 'no-store' })
r.set('X-App', 'cofound') // alias for r.header()
r.end('ok')
r.end('created', 201, { Location: '/items/1' })
r.json({ ok: true })
r.html('<h1>ok</h1>')
r.statusEnd(404)
```

`r.end(body, status, headers)` is the compact form for most custom responses.
`r.statusEnd(status, headers)` sends the standard HTTP status text.

For streaming responses, use `r.writable`, `r.write()`, or `r.tryEnd()`:

```js
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'

app.get('/download', async r => {
  const info = await stat('movie.mp4')
  r.header(200, {
    'Content-Type': 'video/mp4',
    'Content-Length': info.size,
  })
  await pipeline(createReadStream('movie.mp4'), r.writable)
})
```

`r.writable` handles backpressure through Cofound's response writer. When a
`Content-Length` header is set, it uses `tryEnd()` internally.

## Files

Use `r.file(file, options)` to serve a local file:

```js
app.get('/media/:name', r => {
  r.file('media/' + r.params.name)
})
```

`r.file()` handles content type, optional compression, cache headers, ETags,
last-modified headers, byte ranges, and `HEAD` responses.

Common options:

```js
r.file(file, {
  fallthrough: true,
  cache: true,
  compressions: ['gzip', 'deflate'],
  minStreamSize: 512 * 1024,
  maxCacheSize: 128 * 1024,
  minCompressSize: 1280,
})
```

## Cookies

```js
const session = r.cookie('session')

r.cookie('session', token, {
  Path: '/',
  HttpOnly: true,
  SameSite: 'Lax',
  Expires: new Date(Date.now() + 86400_000),
})
```

## Lifecycle

```js
r.handled  // true once a response has been claimed
r.ended    // true once the response has ended
r.aborted  // true if the client disconnects

r.onAborted(() => cleanup())
r.onHandled(() => logStart())
r.onEnded(() => logDone())
r.close()
```

Async route handlers automatically register abort handling while they run. Use
`r.onAborted()` directly for long streams, uploads, proxying, or external work
that should stop when the client disconnects.

## Per-request State

```js
r.attrs.foo = 'route local'
r.context.user = user
```

`r.attrs` and `r.context` are lazily-created objects for middleware-style state.
They are scoped to the current request.

## Proxying

```js
app.all('/api/*', r => {
  r.proxy('http://127.0.0.1:4000' + r.url)
})
```

`r.proxy(url, options)` streams the incoming request to another HTTP service and
streams the response back through the same Cofound request object.

## Idioms

Use the request object directly when writing Cofound server helpers:

```js
export async function serveThing(r, thing) {
  if (!thing) return r.statusEnd(404)
  r.json(thing)
}
```

Avoid reaching for raw Node `req`/`res`. Cofound does not expose them as public
fields; the public streaming surface is `r.readable` and `r.writable`.
