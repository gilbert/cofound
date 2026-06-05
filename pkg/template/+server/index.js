export default async function(app) {
  app.get('/api/hello', r => {
    r.json({ hello: 'world' })
  })
}
