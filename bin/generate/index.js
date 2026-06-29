import cp from 'node:child_process'
import url from 'node:url'

cp.spawnSync(
  process.execPath, [
    '--import',
    url.fileURLToPath(new URL('../start/import.js', import.meta.url)),
    url.fileURLToPath(new URL('generate.js', import.meta.url)),
    ...process.argv.slice(2)
  ], {
    stdio: 'inherit'
  }
)
