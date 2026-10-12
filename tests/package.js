import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'cofound-package-test-'))
let files

try {
  const manifest = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: cache }
  }))
  files = manifest[0].files
} finally {
  fs.rmSync(cache, { recursive: true, force: true })
}

const paths = files.map(x => x.path)

assert(paths.includes('bin/develop/tools/eyedropper/eyedropper.node'),
  'package must include the native eyedropper addon')
assert(!paths.some(x => /^shared\/server\/uws_.*\.node$/.test(x)),
  'package must not include downloaded uWebSockets binaries')

console.log('\u2713 package native binaries')
