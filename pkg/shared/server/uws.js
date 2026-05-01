import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import process from 'node:process'
import { pipeline } from 'node:stream/promises'
import { createRequire } from 'node:module'

const version = '34298dcf'
const arch = process.platform === 'win32' ? 'x64' : process.arch
const base = 'uws_' + process.platform + '_' + arch + '_' + process.versions.modules
const remote = base + '.node'
const binary = path.join(import.meta.dirname, base + '_' + version + '.node')

fs.existsSync(binary) || await download()

let uws
try {
  uws = createRequire(import.meta.url)(binary)
} catch (e) {
  await download()
  uws = createRequire(import.meta.url)(binary)
}

export default uws

async function download(url = 'https://raw.githubusercontent.com/porsager/uWebSockets.js/' + version + '/' + remote, retries = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, async res => {
      if (retries > 10)
        return reject(new Error('Could not download uWebSockets binary - too many redirects - latest: ' + res.headers.location))

      if (res.statusCode === 302)
        return (res.destroy(), resolve(download(res.headers.location, retries + 1)))

      if (res.statusCode !== 200)
        return reject(new Error('Could not download uWebSockets binary - error code: ' + res.statusCode + ' - ' + url))

      pipeline(res, fs.createWriteStream(binary)).then(resolve, reject)
    })
    .on('error', reject)
    .end()
  })
}
