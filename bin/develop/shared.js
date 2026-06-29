import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'

import config from './config.js'
import rewriter from './rewriter.js'
import { isScript, extensionless, modify, canRead, parsePackage } from '../shared.js'

const resolveCache = Object.create(null)
const pkgJsonCache = Object.create(null)

export async function tryRead(x) {
  return fsp.readFile(x, 'utf8')
    .catch(async() => (await new Promise(r => setTimeout(r, 10)), fsp.readFile(x, 'utf8')))
    .catch(async() => (await new Promise(r => setTimeout(r, 20)), fsp.readFile(x, 'utf8')))
}

export function isModule(x) {
  const c = x.charCodeAt(0)
  return c === 64              // @
      || c === 35              // #
      || (c >= 48 && c <= 57)  // 0-9
      || (c >= 65 && c <= 90)  // A-Z
      || (c >= 97 && c <= 122) // a-z
}

export function rewrite(x, file) {
  const dir = path.dirname(file)
  if (file.endsWith('/cofound/src/view.js'))
    x = x.replace('// dev-stack', 'hasOwn.call(window, stackTrace) && (this[stackTrace] = new Error().stack)')
  if (file.endsWith('/cofound/src/index.js'))
    x = x.replace('// dev-stack', 'hasOwn.call(view, stackTrace) && (dom[stackTrace] = view[stackTrace])')

  return 'import.meta.dev=true;'
      + (config.unsafeEnv ? 'import.meta.env=' + JSON.stringify(config.unsafeEnv) + ';' : '')
      + rewriter(
        modify(x, file, config),
        x => {
          x = tryImportMap(x, file) || x
          isModule(x) || isScript(x) || (x = extensionless(x, dir) || x)
          const entry = isModule(x) && resolveEntry(x.match(/^cofound([/?].*|$)/) ? '' : fs.realpathSync(file), x)
          return entry
            ? '/' + entry
            : x
        }
      )
}

function tryImportMap(x, file) {
  let pkg
  let dir = path.dirname(file)
  while (!(pkg = readPkgJson(path.join(dir, 'package.json')))) {
    const next = path.dirname(dir)
    if (dir === next)
      return
    dir = next
  }
  const importPath = pkg && pkg.imports && firstString(pkg.imports, x, 'default')
  const relative = path.relative(config.cwd, dir)
  return importPath && ((relative ? '/' + relative : '') + '/' + removeRelativePrefix(importPath))
}

function readPkgJson(x) {
  try {
    return pkgJsonCache[x] || (pkgJsonCache[x] = JSON.parse(fs.readFileSync(x)))
  } catch (error) {
    return null
  }
}

export function resolveEntry(from, n, force = false) {
  const root = path.join(config.cwd, 'node_modules')
  const linked = (from.match(/^(.*)[/\\]node_modules[/\\]/) || [])[0]
  const { name, version, pathname, query } = parsePackage(n)

  let modulePath = path.join(root, ...name.split('/'))
  if (linked && !fs.existsSync(modulePath))
    modulePath = path.join(linked, ...name.split('/'))

  if (modulePath + force + n in resolveCache)
    return resolveCache[modulePath + force + n]

  const urlPath = path.relative(process.cwd(), modulePath).replaceAll(path.sep, path.posix.sep)
  const fullPath = path.join(modulePath, ...pathname.split('/'))
  const pkgPath = path.join(modulePath, 'package.json')
  const entry = canRead(fullPath)
    ? urlPath + pathname
    : pkgLookup(name, version, pathname, pkgPath, urlPath, force)

  return entry && (resolveCache[modulePath + force + n] = entry + query)
}

function removeRelativePrefix(x) {
  return x.replace(/^\.\//, '')
}

function pkgLookup(name, version, pathname, pkgPath, urlPath, force) {
  if (!force && config.bundleNodeModules && name !== 'cofound') // never bundle cofound
    return urlPath + pathname

  const pkg = readPkgJson(pkgPath) || (name === 'cofound' && readPkgJson(path.join(config.local, 'package.json')))

  if (!pkg)
    return

  const entry = resolveExports(pkg, '.' + pathname) || resolveLegacy(pkg, urlPath)

  if (!entry)
    return urlPath

  return urlPath + '/' + removeRelativePrefix(entry)
}

function resolveExports(x, subPath) {
  return firstString(x, 'exports', subPath, 'browser', 'import', 'default')
      || firstString(x, 'exports', subPath, 'import', 'default')
      || resolveWildcardExport(x.exports, subPath)
}

function resolveWildcardExport(exports, subPath) {
  if (!exports || typeof exports !== 'object')
    return

  for (const key of Object.keys(exports)) {
    const starIdx = key.indexOf('*')
    if (starIdx === -1)
      continue

    const prefix = key.slice(0, starIdx)
    const suffix = key.slice(starIdx + 1)

    if (subPath.startsWith(prefix) && subPath.endsWith(suffix) && subPath.length >= prefix.length + suffix.length) {
      const matched = subPath.slice(prefix.length, suffix.length ? -suffix.length : undefined)
      const target = firstString(exports, key, 'browser', 'import', 'default')
                  || firstString(exports, key, 'import', 'default')
      if (target)
        return target.replaceAll('*', matched)
    }
  }
}

function resolveLegacy(pkg, urlPath) {
  let x = pkg.browser
    ? typeof pkg.browser === 'string'
      ? pkg.browser.includes('umd.')
        ? pkg.module || pkg.main
        : pkg.browser
      : pkg.browser[pkg.module || pkg.main]
    : pkg.module || pkg.main || (fs.existsSync(path.join(urlPath, 'index.js')) && 'index.js')

  if (x && !x.endsWith('.js'))
    x = x + '.js'

  return x
}

function firstString(x, ...props) {
  for (const prop of props) {
    const type = typeof x[prop]
    if (type === 'object')
      x = x[prop]
    else if (type === 'string')
      return x[prop]
  }
}

export function transform(buffer, filePath, type, r) {
  r.headers.accept === '*/*' && r.set('Content-Type', 'text/javascript')
  return isScript(filePath)
    ? rewrite(Buffer.from(buffer).toString(), filePath)
    : buffer
}

export function Watcher(fn) {
  const start = Date.now()
  const watched = new Map()

  return {
    add,
    remove
  }

  function add(x) {
    if (watched.has(x))
      return

    try {
      const watcher = fs.watch(x, { persistent: false }, t => {
        t === 'rename'
          ? readd(x, watcher)
          : changed(x, watcher)
      })
      watched.set(x, watcher)
      return watcher
    } catch (e) {
      // noop - watch is best effort
    }
  }

  function readd(x, watcher) {
    const time = watcher.time
    remove(x)
    setTimeout(() => {
      const watcher = add(x)
      if (watcher) {
        watcher.time = time
        changed(x, watcher)
      }
    }, 20)
  }

  function remove(x) {
    if (!watched.has(x))
      return x
    const watcher = watched.get(x)
    watcher.close()
    watched.delete(x)
    return x
  }

  function changed(x, watcher) {
    const time = modified(x)
    if ((watcher.time && time - watcher.time < 5) || start > time)
      return

    watcher.time = time
    setTimeout(fn, 0, x)
  }

  function modified(x) {
    try {
      return fs.statSync(x).mtimeMs
    } catch (error) {
      return Math.random()
    }
  }
}
