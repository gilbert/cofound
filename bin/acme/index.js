import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'

import Acme from './core.js'
import config from '../config.js'
import c from '../color.js'

const log = console.log // eslint-disable-line
await ({ create, list, renew, delete: del })[config.$[1] || 'create']()

async function create() {
  const domains = config.acme.domains
  if (domains.length && config._.length)
    throw new Error(`[sin acme] Cannot mix domains in config (${domains.join(',')}) and cli (${config._.join(',')})`)

  domains.push(...config._)
  fs.mkdirSync(config.acme.dir, { recursive: true })
  const caPath = path.join(config.acme.dir, config.acme.ca + '.json')
  const dir = path.join(config.acme.dir, config.acme.ca + (config.acme.rsa ? '-rsa' + config.acme.rsa : '') + '_' + domains.join(',').replace(/\*/g, '_'))
  const jsonPath = path.join(dir, 'cert.json')
  const certPath = config.ssl.cert || path.join(dir, 'cert.pem')
  const keyPath = config.ssl.key || path.join(dir, 'key.pem')

  fs.mkdirSync(dir, { recursive: true })

  const account = JSON.parse(await readOrNull(caPath))
  const acme = await Acme({ ...account, ...(Object.fromEntries(Object.entries(config.acme).filter(([k, v]) => v !== undefined))) })
  await fsp.writeFile(caPath, JSON.stringify(acme, null, 2))
  if (account && !acme.kid && acme.ca !== 'zerossl') {
    await acme.rotate()
    await fsp.writeFile(caPath, JSON.stringify(acme, null, 2))
    console.log('ACME: Waiting for 15 seconds so key change can propogate remotely') // eslint-disable-line
    await new Promise(r => setTimeout(r, 15000))
  }

  const x = await acme.create({
    ...config.acme,
    key: config.ssl.key && (fs.existsSync(keyPath) ? fs.readFileSync(keyPath, 'utf8') : null),
    passphrase: config.ssl.passphrase
  })

  await Promise.all([
    fsp.writeFile(jsonPath, JSON.stringify(x, null, 2)),
    fsp.writeFile(certPath, x.cert),
    fsp.writeFile(keyPath, x.key)
  ])
}

function list() {
  printList(getCerts())
}

async function renew() {
  const xs = config._.length > 0
    ? getSelected()
    : getCerts().filter(x => new Date(x.expires).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000)

  xs.length
    ? (log('\n  Renew', xs.length, 'certificate(s)'), printList(xs))
    : log('\n  No certificates up for renewal\n')

  xs.forEach(({ challenge }) => {
    if (!challenge || challenge === 'http-01') {
      log(' ' + c.inverse(c.bold(c.red(' http-01 challenge not supported with CLI  \n'))))
      process.exit(1)
    }
  })

  for (const cert of xs) {
    const jsonPath = path.join(cert.dir, 'cert.json')
    const certPath = config.ssl.cert || path.join(cert.dir, 'cert.pem')
    const keyPath = config.ssl.key || path.join(cert.dir, 'key.pem')
    const caPath = path.join(config.acme.dir, cert.ca + '.json')

    const acme = await Acme(JSON.parse(fs.readFileSync(caPath)))
    if (!acme.kid && acme.ca !== 'zerossl') {
      await acme.rotate()
      await fsp.writeFile(caPath, JSON.stringify(acme, null, 2))
      console.log('ACME: Waiting for 15 seconds so key change can propogate remotely') // eslint-disable-line
      await new Promise(r => setTimeout(r, 15000))
    }
    const x = await acme.create({
      ...cert,
      key: config.ssl.key && fs.readFileSync(keyPath, 'utf8'),
      passphrase: config.ssl.passphrase
    })
    await Promise.all([
      fsp.writeFile(jsonPath, JSON.stringify(x, null, 2)),
      fsp.writeFile(certPath, x.cert),
      fsp.writeFile(keyPath, x.key)
    ])
  }
}

function del() {
  const xs = getSelected()
  xs.forEach(({ dir }) => fs.rmSync(dir, { recursive: true }) )
  log('\n  Deleted', xs.length, 'certificate(s)\n')
  printList(xs)
}

function printList(xs) {
  if (xs.length === 0)
    return log('\n ' +c.inverse('  No Certificates  \n'))

  let caMax = 0
    , nameMax = 0
    , typeMax = 0

  xs.forEach(x => {
    x.type = x.rsa ? 'rsa' + x.rsa : 'ecdsa'
    x.name = x.domains.join(', ')
    x.name.length > nameMax && (nameMax = x.name.length)
    x.ca.length > caMax && (caMax = x.ca.length)
    x.type.length > typeMax && (typeMax = x.type.length)
  })
  log('\n ' +c.inverse(' #   ' + 'Domain(s)'.padEnd(nameMax + 3, ' '), 'Type'.padEnd(typeMax + 3, ' ') + 'CA'.padEnd(caMax + 3, ' ') + 'Expires'.padEnd(23, ' ') + 'Challenge'.padEnd(12, ' ')))
  xs.forEach(({ name, ca, type, expires, challenge }, i) => {
    log('  ' + (i + 1) + ': ', c.bold(name.padEnd(nameMax + 2, ' ')),
      type.padEnd(typeMax + 2, ' '),
      ca.padEnd(caMax + 2, ' '),
      (expires.replace('T', ' ').slice(0, -5) + 'Z').padEnd(22, ' '),
      challenge || 'http-01'
    )
  })
  log('')
}

async function readOrNull(x) {
  return fsp.readFile(x, 'utf8').catch(x => x.code === 'ENOENT' ? null : Promise.reject(x))
}

function getSelected() {
  const numbers = (config._[0] || '').split(',').filter(x => x)
  if (numbers.length === 0) {
    log('\n ' + c.inverse(c.bold(c.red(' No certificates selected  \n'))))
    log('  Select one of the following by #')
    printList(getCerts())
    process.exit(1)
  }
  const xs = getCerts()
  return numbers.map(number => {
    const cert = xs.find(x => x.id == number)
    if (!cert)
      throw new Error('No certificate with #' + number)
    return cert
  })
}

function getCerts() {
  let id = 0

  return fs.readdirSync(config.acme.dir).flatMap(x => {
    try {
      const cert = JSON.parse(fs.readFileSync(path.join(config.acme.dir, x, 'cert.json')))
      const dir = path.join(config.acme.dir, x)
      const expires = new Date(new crypto.X509Certificate(
        fs.readFileSync(path.join(dir, 'cert.pem'))
      ).validTo).toISOString().replace('T', ' ').slice(0, -5) + ' UTC'
      return {
        id: ++id,
        dir,
        expires,
        ...cert
      }
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'ENOTDIR')
        return []
      throw e
    }
  })
}
