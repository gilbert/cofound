import Server from './index.js'

export async function makeTestServer(setupRoutes) {
  const app = Server({ node: true })
  await setupRoutes(app)
  const { port, close } = await app.listen(0)
  const base = 'http://localhost:' + port

  async function request(method, path, body) {
    const options = {
      method,
      headers: {}
    }
    if (body !== undefined) {
      options.headers['content-type'] = 'application/json'
      options.body = JSON.stringify(body)
    }
    const res = await fetch(base + path, options)
    const text = await res.text()
    let parsed = null
    try { parsed = JSON.parse(text) } catch {}
    return { status: res.status, body: parsed }
  }

  return {
    port,
    get:    (path)       => request('GET', path),
    post:   (path, body) => request('POST', path, body),
    patch:  (path, body) => request('PATCH', path, body),
    delete: (path)       => request('DELETE', path),
    put:    (path, body) => request('PUT', path, body),
    close
  }
}
