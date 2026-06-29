import cp from 'node:child_process'
import url from 'node:url'

'SIGINT SIGTERM SIGHUP SIGBREAK'.split(' ').forEach(x => process.on(x, () => { /* noop - child handles */ }))

process.env.NODE_ENV = 'production'
process.exitCode = cp.spawnSync(
  process.execPath, [
    '--import',
      url.fileURLToPath(new URL('import.js', import.meta.url)),
    url.fileURLToPath(new URL('node.js', import.meta.url)),
    ...process.argv.slice(2)
  ], {
    stdio: 'inherit'
  }
).status
