# HTTP

The `s.http` method performs HTTP requests with minimal boilerplate. Built on top of XMLHttpRequest, it offers a promise-based interface for asynchronous operations with support for common HTTP methods and customizable request configurations.

```js
const status = { loaded: 0, total: 0 }
const x = (await s.http.put('/url', {
  body: file,
  responseType: 'text',
  config: xhr => xhr.upload.addEventListener('progress', e => {
    status.loaded = e.loaded
    status.total = e.total
    s.redraw()
  })
}).xhr).getResponseHeader('ETag').slice(1, -1)
```

## Request Methods

```js
s.http({})
s.http('/url', {})
s.http.get({})
s.http.put({})
s.http.post({})
s.http.patch({})
s.http.delete({})
s.http.head({})
```

## Request Options

```js
s.http({
  url: '',                  // Request URL, can also be defined as first argument
  method: 'GET',            // HTTP method 'HEAD' | 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH'
  redraw: true,             // Trigger redraw after resolution
  responseType: 'json',     // '' | 'arraybuffer' | 'blob' | 'document' | 'json' | 'text'
  query: {},                // Query parameters (default: {})
  body: undefined,          // Request body data (default: undefined)
  user: undefined,          // Username for HTTP authorization (default: undefined)
  pass: undefined,          // Password for HTTP authorization (default: undefined)
  headers: {},              // Request headers (default: {})
  timeout: 0,               // Request timeout in milliseconds (default: 0, no timeout)
  config: (xhr) => {},      // Custom XMLHttpRequest configuration
})
```
