import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { isMainThread, parentPort } from 'node:worker_threads'

import exit from 'cofound/exit'
import Server from 'cofound/server'
import '../favicon.js'

import ssr, { wrap } from '../../ssr/index.js'
import { tryPromise } from '../../src/shared.js'

import config, { resolve } from '../config.js'
// Lazy + guarded, mirroring bin/start/node.js: only load the acme module when
// ACME domains are actually configured. Without this, a deploy that terminates
// TLS upstream (e.g. behind nginx) and never sets ACME_DOMAINS still crashes on
// a missing/optional acme module at import time. Acme is only ever dereferenced
// below behind `config.acme.domains.length &&`, so `false` is safe when unset.
const Acme = config.acme.domains.length && (await import('../acme/core.js')).default

let sslListener
exit.wait('https', () => sslListener?.close())

const { server, mount, src, modified } = await resolve(config.entry)
const router = Server()

config.acme.domains.length && router.route(Acme.route(isMainThread ? {} : { get: getFromParent }))

if (server) {
  server.esbuild && (await import('../../build/index.js')).default(server.esbuild)
  server.default && await server.default(router)
}

if (config.static) {
  router.get(router.files(config._[0] || process.cwd()))
} else {
  router.get(router.files(config.outputDir))
  router.get(router.files(config.publicDir))
  router.get(render)
}

if (config.httpPort)
  await listenHttp()

if (config.secure) {
  await listenHttps()
  let certChangeThrottle
  fs.watch(config.ssl.cert, () => {
    console.log('SSL certificate file changed - reload in 5 seconds') // eslint-disable-line
    clearTimeout(certChangeThrottle)
    certChangeThrottle = setTimeout(() => {
      console.log('Reloading to update SSL certificate') // eslint-disable-line
      listenHttps().catch(error => {
        console.error('Error reloading to update SSL certificate', error) // eslint-disable-line
      })
    }, 5000)
  })
}

async function listenHttp() {
  if (config.secure && config.ssl.mode === 'redirect') {
    const redirect = Server()

    config.acme.domains.length && redirect.route(Acme.route(isMainThread ? {} : { get: getFromParent }))
    redirect.all(r => {
      const target = r.headers.host || config.domain
      target
        ? r.statusEnd(301, { Location: 'https://' + target.split(':')[0] + r.url + (r.rawQuery ? '?' + r.rawQuery : '') })
        : r.statusEnd(404)
    })
    const listener = await redirect.listen(config.httpPort, config.address)
    exit.wait('http redirect', listener.close)
    console.log('HTTP Redirecting to HTTPS on', config.httpPort) // eslint-disable-line
  } else {
    const listener = await router.listen(config.httpPort, config.address)
    exit.wait('http', listener.close)
    console.log('HTTP Listening on', config.httpPort) // eslint-disable-line
  }
}

function getFromParent(challenge) {
  return new Promise(resolve => {
    const message = { acme: crypto.randomUUID(), challenge }
    parentPort.on('message', reply)
    parentPort.postMessage(message)
    function reply(x) {
      if (x && x.acme === message.acme) {
        resolve(x.content)
        parentPort.off('message', reply)
      }
    }
  })
}

function render(r) {
  if (r.url.match(/\.[a-z0-9]+$/i) && !(r.headers.accept || '').startsWith('text/html'))
    return

  return tryPromise(
    ssr(
      mount,
      { ...r.attrs },
      { modified, location: (r.protocol || 'http') + '://' + (r.headers.host || ('localhost' + config.port)) + r.url, ...r.context },
      r.attrs,
      r.context
    ),
    x => {
      r.end(
        wrap(x, {
          body: src ? '<script>window.cofoundLastModified = "' + modified + '";</script><script type=module src="/index.js?v=' + modified + '"></script>' : ''
        }),
        x.status || 200,
        {
          ETag: null,
          'Cache-Control': 'max-age=0, no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: new Date().toUTCString(),
          ...x.headers
        }
      )
    }
  )
}

async function listenHttps() {
  isMainThread && config.acme.domains.length && await runAcme()
  sslListener && (sslListener.close(), sslListener = null)
  sslListener = await router.listen(config.httpsPort, config.address, config.ssl)
  console.log('HTTPS Listening on', config.httpsPort) // eslint-disable-line
}

async function runAcme() {
  await fsp.mkdir(config.acme.dir, { recursive: true })
  const acmeFile = path.join(config.acme.dir, config.acme.ca + '.json')
  const account = JSON.parse(await readOrNull(acmeFile))
  const acme = await Acme({ ...account, ...(Object.fromEntries(Object.entries(config.acme).filter(([k, v]) => v !== undefined))) })
  await fsp.writeFile(acmeFile, JSON.stringify(acme, null, 2))

  setTimeout(runAcme, 12 * 60 * 60 * 1000).unref()
  const dir = path.join(config.acme.dir, config.acme.ca + (config.acme.rsa ? '-rsa' + config.acme.rsa : '') + '_' + config.acme.domains.join(',').replace(/\*/g, '_'))
  const jsonPath = path.join(dir, 'cert.json')
  const certPath = config.ssl.cert || path.join(dir, 'cert.pem')
  const keyPath = config.ssl.key || path.join(dir, 'key.pem')
  const cert = await readOrNull(certPath)
  const left = cert && new Date(new crypto.X509Certificate(cert).validTo).getTime() - Date.now()

  if (!cert || left < 30 * 24 * 60 * 60 * 1000) { // 30 days
    if (account && !config.acme.kid && config.acme.ca !== 'zerossl') {
      await acme.rotate()
      await fsp.writeFile(acmeFile, JSON.stringify(acme, null, 2))
      console.log('ACME: Waiting for 15 seconds so key change can propogate remotely') // eslint-disable-line
      await new Promise(r => setTimeout(r, 15000))
    }
    const x = await acme.create({
      ...config.acme,
      key: config.ssl.key && fs.readFileSync(keyPath, 'utf8'),
      passphrase: config.ssl.passphrase
    })
    await fsp.mkdir(dir, { recursive: true })
    await Promise.all([
      fsp.writeFile(jsonPath, JSON.stringify(x, null, 2)),
      fsp.writeFile(certPath, x.cert),
      fsp.writeFile(keyPath, x.key)
    ])
  } else {
    console.log('ACME: Certificate valid for', Math.round(left / 1000 / 60 / 60 / 24), 'more day(s)') // eslint-disable-line
  }
  config.ssl.cert = process.env.COFOUND_SSL_CERT = process.env.SSL_CERT = certPath
  config.ssl.key = process.env.COFOUND_SSL_KEY = process.env.SSL_KEY = keyPath
}

async function readOrNull(x) {
  return fsp.readFile(x, 'utf8').catch(x => x.code === 'ENOENT' ? null : Promise.reject(x))
}
