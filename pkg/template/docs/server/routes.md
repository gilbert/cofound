# Server Routes

The server entry point (`server/index.js`) exports a default async function that receives the `app` object for defining HTTP routes.

```js
export default async function(app) {
  app.get('/api/hello', r => {
    r.json({ hello: 'world' })
  })
}
```

## Route Methods

```js
app.get('/path', handler)      // Handle GET requests
app.post('/path', handler)     // Handle POST requests
app.patch('/path', handler)    // Handle PATCH requests
app.delete('/path', handler)   // Handle DELETE requests
```

## Route Parameters

Use `:param` syntax to capture URL parameters. They are available on `r.params`:

```js
app.get('/api/users/:id', r => {
  const userId = r.params.id
  r.json({ id: userId })
})
```

## Response Methods

### `r.json(data, statusCode?)`

Send a JSON response. Optionally pass a status code as the second argument (defaults to 200):

```js
app.get('/api/items', r => {
  r.json([{ id: 1, name: 'Item' }])
})

app.post('/api/items', async r => {
  const { name } = await r.body('json')
  r.json({ id: 2, name }, 201)
})
```

### `r.end(text)`

Send a plain text response:

```js
app.get('/health', r => {
  r.end('ok')
})
```

### `r.body(format)`

Read the request body. Pass `'json'` to parse as JSON:

```js
app.post('/api/items', async r => {
  const data = await r.body('json')
  // data is the parsed JSON body
  r.json({ received: data })
})
```

## Full CRUD Example

```js
export default async function(app) {
  const items = []
  let nextId = 1

  app.get('/api/items', r => {
    r.json(items)
  })

  app.post('/api/items', async r => {
    const { text } = await r.body('json')
    const item = { id: nextId++, text, done: false }
    items.push(item)
    r.json(item, 201)
  })

  app.patch('/api/items/:id', async r => {
    const item = items.find(i => i.id === +r.params.id)
    if (!item) return r.json({ error: 'Not found' }, 404)
    item.done = !item.done
    r.json(item)
  })

  app.delete('/api/items/:id', r => {
    const idx = items.findIndex(i => i.id === +r.params.id)
    if (idx === -1) return r.json({ error: 'Not found' }, 404)
    items.splice(idx, 1)
    r.json({ ok: true })
  })
}
```
