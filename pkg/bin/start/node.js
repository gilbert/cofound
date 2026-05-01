import { Worker, SHARE_ENV } from 'node:worker_threads'

import '../../ssr/index.js'
import config from '../config.js'

const url = config.$[1] === 'script'
  ? './script.js'
  : './serve.js'

await import(url)

const Acme = config.acme.domains.length && await import('../acme/core.js').then(x => x.default)

for (let i = 1; i < (config.workers || 0); i++) {
  const worker = new Worker(new URL(url, import.meta.url), {
    argv: process.argv,
    env: SHARE_ENV
  })
  config.acme && worker.on('message', x => x.acme && worker.postMessage({
    acme: x.acme,
    content: Acme.challenges.get(x.challenge)
  }))
}
