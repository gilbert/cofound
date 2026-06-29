// https://datatracker.ietf.org/doc/html/rfc8555

import crypto from 'node:crypto'
import cp from 'node:child_process'

const consoleLog = (...xs) => console.log('ACME:', ...xs) // eslint-disable-line
const challenges = new Map()

const needsEAB = ['sslcom', 'google', 'buypass']
const cas = {
  letsencrypt: 'https://acme-v02.api.letsencrypt.org/directory',
  'letsencrypt-staging': 'https://acme-staging-v02.api.letsencrypt.org/directory',
  zerossl: 'https://acme.zerossl.com/v2/DV90',
  sslcom: 'https://acme.ssl.com/sslcom-dv-ecc',
  google: 'https://dv.acme-v02.api.pki.goog/directory',
  'google-test': 'https://dv.acme-v02.test-api.pki.goog/directory',
  buypass: 'https://api.buypass.com/acme/directory',
  'buypass-test': 'https://api.test4.buypass.no/acme/directory'
}

const revokeReasons = [
  'unspecified',
  'keyCompromise',
  'cACompromise',
  'affiliationChanged',
  'superseded',
  'cessationOfOperation',
  'certificateHold',
  undefined, // value 7 is not used
  'removeFromCRL',
  'privilegeWithdrawn',
  'aACompromise'
]

Acme.route = route
Acme.challenges = challenges
Acme.revoke = revoke

export default Acme

async function Acme({
  email,
  eab,
  kid,
  key,
  ca = 'letsencrypt',
  log = consoleLog
} = {}) {
  let root = cas[ca]
  if (!root)
    throw new Error('ACME: Endpoint for CA ' + ca + ' not found')

  if (!email && !kid && !eab)
    throw new Error('ACME: Either email, EAB or kid+key required for acme auth')

  if (needsEAB.includes(ca) && !kid && !eab)
    throw new Error('ACME: You must supply kid+key or EAB credentials for ' + ca)

  if (kid && !key)
    throw new Error('ACME: Kid provided but key missing')

  log(kid && key ? 'Reusing acme keypair with' : 'Creating acme keypair for', ca)
  let acmePair = kid && key
    ? await getKeypair(key)
    : await generate()

  kid || (key = await exportKey(acmePair.privateKey, true))

  log(kid ? 'Using account ' + kid : 'Creating new account')
  kid || (kid = await createAccount())

  const acme = {
    create,
    revoke,
    rotate,

    get key() { return key },
    get kid() { return kid },
    email,
    eab,
    ca
  }

  return acme

  async function create(options) {
    let {
      domains,
      challenge: challenger = 'http-01',
      key,
      passphrase,
      rsa
    } = options

    if (domains.length === 0)
      throw new Error('ACME: No domain(s) specified')

    if (challenger === 'http-01' && domains.some(x => x.includes('*')))
      throw new Error('ACME: Wildcard certificates only works with DNS challenges')

    rsa && (rsa = parseInt(rsa === true ? 2048 : rsa))
    key || (key = await createPrivateKey(rsa))
    ca === 'sslcom' && rsa && (root = root.replace(/-ecc$/, '-rsa'))

    log('Create', rsa ? 'rsa' + rsa : 'ecdsa', 'order for', domains, 'using', ca)
    const request = await session(root, acmePair.privateKey, kid)

    const { finalize, authorizations, identifiers } = await request(request.dir.newOrder, {
      identifiers: domains.map(value => ({ type: 'dns', value }))
    }).then(x => x.json())

    log('Starting challenges')

    const dns = challenger !== 'http-01' && await import('./dns/' + challenger + '.js')
    const dnsAuth = dns && getAuth(dns.auth, options.auth)

    for (const [i, auth] of authorizations.entries()) {
      const domain = identifiers[i].value
      log('Request challenge for', domain)

      const challenge = (await request(auth, '').then(x => x.json())).challenges.find(x =>
        dns ? x.type === 'dns-01' : x.type === challenger
      )

      const reply = challenge.token + '.' + await jwkThumbprint(acmePair.publicKey)
      const challengeResponse = dns
        ? await addDNS(dns, challenger, reply, domain, dnsAuth)
        : challenges.set(challenge.token, { domain, reply })

      log('Ready to answer challenge for', domain)
      try {
        let body
          , status
          , retries = 0

        while (status !== 'valid') {
          if (++retries > 10)
            throw new Error('ACME: Challenge timed out during status: ' + status)

          body = await request(challenge.url, !status ? {} : '').then(x => x.json())
          status = body.status
          log('Challenge', status, 'for', domain)
          if (status === 'invalid')
            throw new Error('ACME: Challenge failed with status: invalid ' + JSON.stringify(body))
          else if (status !== 'valid')
            await new Promise(r => setTimeout(r, retries * 1000))
        }
      } finally {
        dns
          ? await import('./dns/' + challenger + '.js').then(x => x.remove(challengeResponse, dnsAuth))
          : challenges.delete(challenge.token)
      }
    }

    log('Create Certificate Signing Request for', domains)
    const csr = await createCSR(domains, key, passphrase)

    log('Finalize order')
    const x = await request(finalize, { csr: base64Encode(pemToDer(csr)) })

    let location = x.headers.get('location')
      , retries = 0
      , status
      , body

    log('Await certificate')
    while (status !== 'valid') {
      if (++retries > 10)
        throw new Error('ACME: Challenge timed out during status: ' + status + ' ' + JSON.stringify(body))

      const x = await request(location)
      body = await x.json()
      status = body.status
      const retry = x.headers.get('retry-after') || 10
      log('Status: ' + status, ...(status !== 'valid' && retry ? ['retry in', retry, 'seconds'] : []))
      if (status === 'processing')
        await new Promise(r => setTimeout(r, retry * 1000))
      else if (status !== 'valid')
        throw new Error('ACME: Challenge failed with status: ' + status + ' ' + JSON.stringify(body))
    }

    log('Fetch certificate URL')
    const { certificate } = await request(location).then(x => x.json())

    log('Fetch actual certificate')
    const cert = await request(
      certificate,
      '',
      {},
      'text'
    ).then(x => x.text())

    log('Certificate ready')

    return {
      created: new Date(),
      expires: new Date(new crypto.X509Certificate(cert).validTo),
      challenge: challenger,
      auth: dnsAuth,
      passphrase,
      domains,
      cert,
      rsa,
      key,
      ca
    }

    function getAuth(auth, oldAuth) {
      return Object.entries(auth).reduce((acc, [key, value]) => {
        acc[key] = process.env[value] || oldAuth[key]
        if (!acc[key])
          throw new Error('ACME: Missing auth ' + value + ' for ' + challenger)
        return acc
      }, {})
    }
  }

  async function revoke(certificate, options) {
    return Acme.revoke(certificate, {
      ca,
      kid,
      key,
      ...options
    })
  }

  async function rotate() {
    log('Rotate key for', ca)
    const newAcmePair = await generate()
    const request = await session(root, acmePair.privateKey, kid)
    await request(
      request.dir.keyChange,
      {
        resource: 'key-change',
        ...(
          await jws(newAcmePair.privateKey, {
            account: kid,
            oldKey: await getJWK(acmePair.publicKey)
          }, {
            alg: 'ES256',
            jwk: await getJWK(newAcmePair.publicKey),
            url: request.dir.keyChange
          })
        )
      }
    )
    key = await exportKey(newAcmePair.privateKey, true)
    acmePair = newAcmePair
    log('Successfully rotated key for', ca)
    return acme
  }

  async function createAccount() {
    const request = await session(root, acmePair.privateKey)
    const jwk = await getJWK(acmePair.publicKey)

    ca === 'zerossl' && !eab && (eab = await createZeroSSLEAB(email, log))

    const externalAccountBinding = eab && await jws(
      await crypto.subtle.importKey(
        'raw',
        Buffer.from(eab.split(':')[1], 'base64'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      ),
      jwk,
      { alg: 'HS256', kid: eab.split(':')[0], url: request.dir.newAccount },
      'HMAC'
    )

    const x = await request(request.dir.newAccount, {
      contact: ['mailto:' + email],
      termsOfServiceAgreed: true,
      externalAccountBinding
    }, { jwk })

    log('New account created')
    return x.headers.get('location')
  }

  async function addDNS(dns, challenger, reply, domain, dnsAuth) {
    log('Set TXT record for', domain, 'using', challenger)
    const x = await dns.add('_acme-challenge.' + domain.replace('*.', ''), await sha256base64(reply), domain, dnsAuth)
    log('TXT record set for', domain, 'wait', dns.timeout / 1000, 'seconds for propogation')
    await new Promise(r => setTimeout(r, dns.timeout))
    return x
  }
}

async function revoke(certificate, {
  reason = 0,
  kid,
  key,
  ca = 'letsencrypt',
  log = consoleLog
}) {
  const root = cas[ca]
  certificate[0] === '-' && (certificate = certificate.trim().split(/\n\n/)[0])
  certificate = pemToDer(certificate)
  typeof reason === 'string' && (reason = revokeReasons.indexOf(reason))
  const parsed = crypto.X509Certificate && new crypto.X509Certificate(certificate)
  log(
    'Revoking certificate with reason', reason,
    (revokeReasons[reason] ? '(' + revokeReasons[reason] + ')' : ''),
    parsed ? 'for ' + parsed.subjectAltName : ''
  )
  const acmePair = await getKeypair(key)
  const request = await session(root, acmePair.privateKey)
  await request(request.dir.revokeCert, {
    certificate: base64Encode(certificate),
    reason
  },
    kid ? { kid } : { jwk: await getJWK(acmePair.publicKey) }
  )
  log('Revoked certificate', parsed ? 'for ' + parsed.subjectAltName : '')
}

async function createCSR(domains, key, passphrase) {
  return new Promise((resolve, reject) => {
    cp.exec('echo "' + key + '" | ' + [
      'openssl',
      'req',
      '-new',
      '-sha256',
      '-key', '/dev/stdin',
      '-subj', '/C=DK/O=' + domains[0] + '/CN=' + domains[0],
      '-addext', 'subjectAltName=' + domains.map(x => 'DNS:' + x).join(','),
      ...(passphrase ? ['-passin', 'pass:' + passphrase] : [])
    ].join(' '), (error, stdout, stderr) => {
      error || stderr
        ? reject(Object.assign(error || {}, { stdout, stderr }))
        : resolve(stdout.trim())
    })
  })
}

async function getKeypair(key, rsa) {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(key),
    rsa
      ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
      : { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign']
  )

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    await getJWK(privateKey),
    rsa
      ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
      : { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify']
  )

  return {
    privateKey,
    publicKey
  }
}

async function generate(rsa) {
  return crypto.subtle.generateKey(
    rsa
      ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: rsa, publicExponent: new Uint8Array([0x01, 0x00, 0x01]) }
      : { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )
}

async function getJWK(publicKey) {
  // content, and especially object key order is important - hence the desctructure
  const { crv, kty, x, y } = await crypto.subtle.exportKey('jwk', publicKey)
  return { crv, kty, x, y }
}

function route({
  log = consoleLog,
  get = x => challenges.has(x) ? challenges.get(x) : null
} = {}) {
  return function(app) {
    app.get('/.well-known/acme-challenge/:token', async r => {
      log('Received challenge', r.params.token)
      let x = get(r.params.token)
      x && typeof x.then === 'function' && (x = await x)
      if (!x) {
        log('Received challenge not found', r.params.token)
        return r.statusEnd(400)
      }

      log('Responding to challenge for', x.domain)
      r.end(x.reply, { 'content-type': 'text/plain' })
    })
  }
}

function pemToDer(x) {
  return Buffer.from(
    x[0] === '-' ? x.trim().split('\n').slice(1, -1).join('') : x,
    'base64'
  )
}

async function exportKey(key, priv) {
  const x = btoa(
    String.fromCharCode.apply(null, new Uint8Array(
      await crypto.subtle.exportKey(priv ? 'pkcs8' : 'spki', key)
    ))
  ).match(/.{1,64}/g).join('\n')

  return priv
    ? `-----BEGIN PRIVATE KEY-----\n${ x }\n-----END PRIVATE KEY-----\n`
    : `-----BEGIN PUBLIC KEY-----\n${ x }\n-----END PUBLIC KEY-----\n`
}

function base64Encode(x) {
  if (!x)
    return ''

  if (typeof x === 'string')
    x = new TextEncoder().encode(x)

  return btoa(String.fromCharCode.apply(null, new Uint8Array(x)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function jwkThumbprint(publicKey) {
  return sha256base64(JSON.stringify(await getJWK(publicKey)))
}

async function sha256base64(x) {
  return base64Encode(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(x)
    )
  )
}

async function createPrivateKey(rsa) {
  return exportKey(
    (await crypto.subtle.generateKey(
      rsa
        ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: rsa, publicExponent: new Uint8Array([0x01, 0x00, 0x01]) }
        : { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign']
    )).privateKey,
    true
  )
}

async function session(root, key, kid) {
  let queue = Promise.resolve()
  kid && (request.kid = kid)
  request.dir = await fetch(root).then(x => x.json())
  request.nonce = (await fetch(request.dir.newNonce, { method: 'HEAD' })).headers.get('replay-nonce')
  return request

  async function request(url, payload, header) {
    return queue = queue.then(async() => {
      try {
        const x = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/jose+json' },
          body: JSON.stringify(
            await jws(key, payload, {
              kid: request.kid,
              alg: 'ES256',
              b64: true,
              nonce: request.nonce,
              url,
              ...header
            })
          )
        })

        request.nonce = x.headers.get('replay-nonce')
        return x
      } catch (error) {
        request.nonce = error.response?.headers.get('replay-nonce') || request.nonce
        throw error
      }
    })
  }
}

async function jws(key, payload, header, alg = { hash: 'SHA-256', name: 'ECDSA', namedCurve: 'P-256' }) {
  const encodedPayload = base64Encode(typeof payload === 'string' ? payload : JSON.stringify(payload))
  const encodedHeader = base64Encode(JSON.stringify(header))

  return {
    signature: base64Encode(await crypto.subtle.sign(
      alg,
      key,
      new TextEncoder().encode(encodedHeader + '.' + encodedPayload)
    )),
    protected: encodedHeader,
    payload: encodedPayload
  }
}

async function createZeroSSLEAB(email, log) {
  log('ZeroSSL specified with no EAB - creating EAB', email)
  const x = await fetch('https://api.zerossl.com/acme/eab-credentials-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
    headers: { 'Content-Type': 'application/json' }
  }).then(x => x.json())

  if (!x.eab_kid || !x.eab_hmac_key)
    throw new Error('ACME: Could not create ZeroSSL eab credentials: ' + JSON.stringify(x))

  log('New ZeroSSL EAB created')
  return x.eab_kid + ':' + x.eab_hmac_key
}

async function fetch(url, options = {}) {
  return globalThis.fetch(url, { timeout: { signal: AbortSignal.timeout(60 * 1000) }, ...options }).then(async x => {
    if (x.ok)
      return x

    throw Object.assign(new Error('Bad status: ' + x.status), {
      status: x.status,
      body: await x.text()
    })
  })
}
