import os from 'node:os'
import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'
import process from 'node:process'
import fsp from 'node:fs/promises'
import cp from 'node:child_process'
import { getLocal, getTSConfigRaw, getPkgs, getSucrase, isScript, extensionless, canRead } from './shared.js'

import args from './args.js'
import c from './color.js'

const env = process.env
const [runtime, bin, ...argv] = process.argv

let config
try {
  config = { runtime, bin, ...(await fromArgs()) }
  const pkg = config.pkgs?.[0]?.json
  if (pkg) {
    for (const name in (pkg.env || {})) {
      const value = pkg.env[name]
      if (value !== null && typeof value !== 'string')
        throw new Error('Package.json env values must be strings or null (optional)')
      
      name in process.env === false && value && (process.env[name] = value)
      if (!process.env[name] && !config.develop && value !== null)
        throw new Error('package.json requires env value: ' + name + ' - it is not set')
    }
  }
} catch (e) {
  if (process.argv.includes('-d') || process.argv.includes('--debug'))
    throw e
  error(e)
}

config.version && (config.$[0] = 'version')
config.help && (config.$[0] = 'help')

export default config

async function fromArgs() {
  const acme = {
    dir         : (x, xs) => path.join(xs.home, 'acme'),
    domains     : x => (x || env.ACME_DOMAIN || env.ACME_DOMAINS || '').split(',').filter(x => x),
    challenge   : getChallenge,
    rsa         : x => x || env.ACME_RSA,
    email       : x => x || env.ACME_EMAIL,
    test        : x => x || env.ACME_TEST,
    eab         : x => x || env.ACME_EAB,
    kid         : x => x || env.ACME_KID,
    key         : x => x || env.ACME_KEY,
    ca          : x => x || env.ACME_CA || 'letsencrypt'
  }

  return args(argv, {
    envPrefix: 'COFOUND',
    commands: {
      $         : 'help',
      build     : 1,
      create    : 0,
      develop   : { $: true, script: 1, static: 1 },
      generate  : 1,
      test      : 1,
      help      : 1,
      purge     : 1,
      script    : 1,
      start     : { $: true, script: 1, static: 1 },
      version   : 1
    },
    parameters: {
      publicDir   : 'public',
      outputDir   : 'dist',
      entry       : getEntry,
      cwd         : getCWD,
      root        : getRoot,
      local       : getLocal,
      home        : getHome,
      binDir      : (x, xs) => mkdir(x || path.join(xs.home, 'bin')),
      linkDir     : (x, xs) => mkdir(x || path.join(xs.home, 'link')),
      tempDir     : (x, xs) => mkdir(x || path.join(xs.home, 'temp')),
      cacheDir    : (x, xs) => mkdir(x || path.join(xs.home, 'cache')),
      globalDir   : (x, xs) => mkdir(x || path.join(xs.home, 'global')),
      projectsDir : getProjects,
      port        : getPort,
      unsafeEnv   : getUnsafeEnv,
      sucrase     : getSucrase,
      chromePath  : getChromePath,
      domain      : null,
      server      : null,
      ssl         : {
        mode        : getMode,
        cert        : x => x || env.SSL_CERT,
        key         : x => x || env.SSL_KEY,
        passphrase  : x => x || env.SSL_PASSPHRASE
      },
      acme,
      title       : (x, xs) => x || path.basename(xs.cwd),
      secure      : (x, xs) => !!(xs.ssl.cert || xs.acme.domains.length),
      httpsPort   : (x, xs) => x || (xs.secure ? (x ? parseInt(x) : (xs.port || 443)) : null),
      httpPort    : (x, xs) => xs.secure && xs.ssl.mode === 'only' ? null : (xs.secure ? 80 : x ? parseInt(x) : (xs.port || 80)),
      address     : x => x || env.ADDRESS || '0.0.0.0',
      workers     : x => x ? x === 'cpus' ? os.cpus().length : parseInt(x) : 1,
      tsconfig    : (x, xs) => xs.cwd + '/tsconfig.json',
      tsconfigRaw : getTSConfigRaw,
      coverage    : (x, xs) => (xs.nojail = true, x || false),
      logFile     : null
    },
    flags: {
      version           : false,
      debug             : false,
      help              : false,
      nochrome          : true,
      noscript          : false,
      nojail            : (x, xs) => !xs.develop || x,
      bundleNodeModules : false,
      showDeprecated    : false,
      ignoreScripts     : false,
      trustPostinstall  : false,
      saveOptional      : false,
      devtools          : false,
      config            : false,
      global            : false,
      ci                : (x) => x || argv[0] === 'ci' || env.CI || false,
      headless          : (x, xs) => x !== undefined ? x : xs.ci || false,
      production        : false,
      saveDev           : false,
      force             : false,
      coverage          : (x, xs) => (xs.nojail = true, x || false),
      oneoffScript      : (_, xs) => xs.$[0] === 'script',
      script            : (_, xs) => xs.$[1] === 'script',
      static            : (_, xs) => xs.$[1] === 'static'
    },
    alias: {
      development: 'develop',
      init: 'create',
      '-g': '--global',
      '-D': '--save-dev',
      '-O': '--save-optional',
      '-p': '--port',
      '-n': '--nochrome',
      '-h': '--help',
      '-v': '--version',
      '-d': '--debug',
      '--acme-domain': '--acme-domains'
    }
  })
}

function needsEntry(config) {
  return !config.static && (env.COFOUND_BUILD || config.build || config.generate || config.develop || config.start || config.test || config.oneoffScript)
}

export function getEntry(x, config) {
  config.test && (config.develop = true)
  x = x || config._[0] || (config.test ? 'tests/index.js' : '')
  x = path.isAbsolute(x) ? x : path.join(process.cwd(), x)
  let file = isScript(x) && path.basename(x)
  const dir = file ? path.dirname(x) : x

  if (!needsEntry(config)) {
    config.create || config.static || process.chdir(env.PWD = dir)
    return ''
  }

  config.pkgs = getPkgs(dir)
  const pkg = config.pkgs[0]

  if (pkg) {
    process.chdir(env.PWD = pkg.dir) // node doesn't update env.PWD
    file || (canRead(pkg.json.main) && isScript(pkg.json.main) && (file = pkg.json.main))
  }

  const entry = file
    ? path.join(dir, file)
    : extensionless(dir) || extensionless(path.join(dir, config.outputDir)) || path.join(dir, 'index.js')

  return canRead(entry)
    ? entry
    : error('Entry ' + (config._[0] || entry) + ' could not be accessed')
}

export function error(x) {
  process.stderr.write(
    '\n ' + c.inverse(' '.repeat(process.stdout.columns - 2)) +
    '\n ' + c.inverse(('   🚨 ' + x).padEnd(process.stdout.columns - 2, ' ')) +
    '\n ' + c.inverse(' '.repeat(process.stdout.columns - 2)) + '\n\n'
  )
  process.exit(1)
}

async function getCWD(x, xs) {
  if (!xs.acme)
    await import('./env.js')
  return process.cwd()
}

function getRoot(x, xs) {
  return path.parse(xs.cwd).root
}

function mkdir(x) {
  fs.mkdirSync(x, { recursive: true })
  return x
}

function getHome(x) {
  x = x || path.join(
    process.platform === 'win32' && env.USERPROFILE || env.HOME,
    '.cofound'
  )
  fs.mkdirSync(x, { recursive: true })
  return x
}

function getPort(x, config) {
  if (x || env.PORT)
    return parseInt(x || env.PORT)

  if (!config.develop && !config.purge)
    return

  const file = path.join(config.projectsDir, '.ports')
  const ports = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : {}

  if (config.cwd in ports)
    return ports[config.cwd]

  const port = 1 + (Object.values(ports).sort().find((x, i, xs) => xs[i + 1] !== x + 1) || 1336)
  ports[config.cwd] = port
  fs.writeFileSync(file, JSON.stringify(ports))
  return port
}

function getMode(x) {
  x = x || env.SSL_MODE || 'redirect'
  if (!'only redirect optional'.includes(x))
    throw new Error('SSL Mode must be: only | redirect | optional')
  return x
}

async function getChallenge(challenge, config, read) {
  challenge = challenge || env.ACME_CHALLENGE || 'http-01'
  if (challenge === 'http-01')
    return challenge

  const x = await import('./acme/dns/' + challenge + '.js')
  if (x.auth) {
    for (const value of Object.values(x.auth)) {
      const obj = { [value.replace(/_/g, '-').toLowerCase()]: x => env[value] = x || env[value] }
      await read(obj)
    }
  }

  return challenge
}

function getUnsafeEnv(_, xs) {
  const unsafe = {}
  for (let x in env)
    x.startsWith('UNSAFE_') && (unsafe[x] = env[x])
  return unsafe
}

function getProjects(x, xs) {
  return mkdir(x
    ? x
    : env.WSL_DISTRO_NAME
    ? env.PATH.match(/\/mnt\/c\/Users\/[^/]+\//)[0] + '.cofound/wsl_projects'
    : path.join(xs.home, 'projects')
  )
}

function getChromePath(x) {
  if (x || env.CHROME_PATH)
    return (x || env.CHROME_PATH).trim()

  if (process.platform === 'darwin') {
    return [
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ].find(fs.existsSync)
  } else if (env.WSL_DISTRO_NAME) {
    const [localAppData, programFiles, programFilesX86] = ['LOCALAPPDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)'].map(x =>
      cp.execSync('cmd.exe /c echo "%' + x + '%"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
        .trim().replace(/\r/g, '').replace(/\\/g, '/').replace(/^C:/, '/mnt/c')
    )
    return [
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ].find(x => fs.existsSync(x))
  } else if (process.platform === 'linux') {
    return cp.execSync('which google-chrome || which chromium || echo', { encoding: 'utf8' }).trim()
      || '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe'    // wsl
  } else if (process.platform === 'win32') {
    return [
      env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',      // eslint-disable-line
      env['PROGRAMFILES'] + '\\Google\\Chrome\\Application\\chrome.exe',      // eslint-disable-line
      env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe', // eslint-disable-line
      env['PROGRAMFILES'] + '\\Microsoft\\Edge\\Application\\msedge.exe',     // eslint-disable-line
      env['PROGRAMFILES(X86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe' // eslint-disable-line
    ].find(fs.existsSync)
  }
}

export async function resolve() {
  const cwd = process.cwd()
      , hasExport = config.entry && exportsDefault('\n' + await fsp.readFile(config.entry, 'utf8'))
      , main = hasExport && (globalThis.window = (await import('../ssr/window.js')).default, await import(config.entry))
      , http = main && typeof main.default === 'function' && main
      , src = !http && !config.noscript && path.relative(config.cwd, config.entry)
      , modified = src && (await fsp.stat(path.join(cwd, config.outputDir, src.replace(/\.tsx?$/, '.js'))).catch(() => fsp.stat(path.join(cwd, src)))).mtimeMs.toFixed(0)

  return {
    onlyServer: !!http,
    server: http ? main : await defaultServer(),
    mount: !http && main && main.default,
    modified,
    src
  }

  async function defaultServer() {
    const defaultServerPath = path.join(cwd, 'server')
    try {
      return await import(defaultServerPath)
    } catch (error) {
      if (!error.url || error.code !== 'ERR_MODULE_NOT_FOUND' || url.fileURLToPath(error.url) !== defaultServerPath)
        throw error
    }
  }
}

function exportsDefault(x) {
  if (!/(export|as)\s+default/.test(x))
    return false

  let i = 0
    , c = -1
    , b = -1
    , w = -1
    , l = -1
    , t = ''
    , ws = false
    , blocks = []
    , exp = false
    , found = false

  for (i = 0; i < x.length; i++) {
    c = x.charCodeAt(i)

      b === 39  ?  c === 39  && l !== 92 && pop()  // ' \
    : b === 34  ?  c === 34  && l !== 92 && pop()  // " \
    : b === 96  ?  c === 96  && l !== 92 && pop()  // ` \
    : b === 42  ?  c === 47  && l === 42 && pop()  // * /
    : b === 47  ?  c === 10  && pop()              // / \n
    : b === 91  && c === 93  ? pop()               // [ ]
    : b === 40  && c === 41  ? pop()               // ( )
    : b === 123 && c === 125 ? pop()               // { }
    : b === 112 && c === 125 ? pop()               // p }
    : c === 47  && l === 47  ? push()              // / /
    : c === 42  && l === 47  ? push()              // / *
    : c === 34  ? push()                           // "
    : c === 39  ? push()                           // '
    : c === 96  ? push()                           // `
    : c === 40  ? push()                           // (
    : c === 91  ? push()                           // [
    : c === 123 ? push()                           // {
    : isWS(c)   ? word()                           // \t \n \r space
    : ws = false

    l = c
    if (found)
      return true
  }

  return false

  function isWS(c) {
    return c === 9 || c === 10 || c === 13 || c === 32
  }

  function word() {
    if (ws === true || b !== -1)
      return w = i + 1

    ws = true
    t = x.slice(w, i)

    exp
      ? t === 'default'
        ? found = true
        : exp = false
      : t === 'export' || t === 'as'
      ? exp = true
      : exp = false

    w = i + 1
  }

  function push() {
    b !== -1 && blocks.push(b)
    b = c
  }

  function pop() {
    b = blocks.pop() || -1
  }
}
