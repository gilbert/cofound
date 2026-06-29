import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import url, { fileURLToPath, pathToFileURL } from 'node:url'

let _esbuild
function esbuild() {
  return _esbuild || (_esbuild = createRequire(import.meta.url)('esbuild'))
}

export function safeId({ name, version }) {
  return name[0] + name.slice(1).replace(/[#@!:/\\]+/g, '+') + '@' + version.replace(/[#@!:/\\]+/g, '+')
}

export function isScript(x) {
  return /\.[mc]?[jt]sx?$/i.test(x)
}

export function parsePackage(x) {
  const [_, name, version = '', pathname = '', query = '', hash = ''] =
    x.match(/((?:@[^/@]+\/)?[^@/?]+)(?:@([^/?#]+))?(\/[^?#]+)?(\?[^/#]+)?(#.+)?/)

  return { name, version, pathname, query, hash, raw: x }
}

export function extensionless(x, root = '') {
  x.indexOf('file://') === 0 && (x = fileURLToPath(x))
  root = path.isAbsolute(x) ? process.cwd() : root
  x.indexOf(root) === 0 && (root = '')
  return isScript(x)                           ? x
    : canRead(path.join(root, x + '.js'))      ? x + '.js'
    : canRead(path.join(root, x, 'index.js'))  ? x + '/index.js'
    : canRead(path.join(root, x + '.ts'))      ? x + '.ts'
    : canRead(path.join(root, x, 'index.ts'))  ? x + '/index.ts'
    : canRead(path.join(root, x + '.tsx'))     ? x + '.tsx'
    : canRead(path.join(root, x, 'index.tsx')) ? x + '/index.tsx'
    : canRead(path.join(root, x + '.jsx'))     ? x + '.jsx'
    : canRead(path.join(root, x, 'index.jsx')) ? x + '/index.jsx'
    : null
}

export function canRead(x) {
  try {
    return fs.statSync(x).isFile()
  } catch (_) {
    return
  }
}

export function getTSConfigRaw(x, config) {
  const xs = config.tsconfig && fs.existsSync(config.tsconfig)
    ? JSON.parse(esbuild().transformSync('export default ' + fs.readFileSync(config.tsconfig), { minifyWhitespace: true }).code.slice(14, -2))
    : {}

  return {
    ...xs,
    compilerOptions: {
      jsx: 'react',
      jsxFactory: 's',
      jsxFragmentFactory: 's.jsx',
      ...xs.compilerOptions
    }
  }
}

export function jail(x) {
  return '' + x
}

export function getPkgs(cwd) {
  const root = path.parse(cwd).root
  let pkgs = []
  let dir = cwd
  while (dir !== root) {
    try {
      pkgs.push({ dir, json: JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))) })
    } catch (e) {
      if (e.code !== 'ENOENT')
        throw e
    }
    dir = path.dirname(dir)
  }
  return pkgs
}

export async function getSucrase(x, { pkgs = [] }) {
  for (const { dir, json } of pkgs) {
    if (json.dependencies?.sucrase || json.devDependencies?.sucrase)
      return import(pathToFileURL(path.join(dir, 'node_modules', 'sucrase', 'dist', 'index.js')))
  }
}

export function modify(x, file, {
  debug = false,
  nojail = false,
  sucrase,
  tsconfigRaw
}) {
  const tsx = /\.[jt]sx$/.test(file)
  if (tsx || file.endsWith('.ts')) {
    x = sucrase
      ? sucraseTS(sucrase, x, debug, tsx, tsconfigRaw, file)
      : esbuildTS(x, debug, tsx, tsconfigRaw, file)
  }

  return nojail ? x : jail(x)
}

function sucraseTS(sucrase, x, debug, tsx, tsconfigRaw, file) {
  try {
    return sucrase.transform('' + x, {
      transforms: ['typescript', 'jsx'],
      jsxPragma: 's',
      jsxFragmentPragma: 's.jsx',
      production: true
    }).code
  } catch (e) {
    return esbuildTS(x, debug, tsx, tsconfigRaw, file)
  }
}

function esbuildTS(x, debug, tsx, tsconfigRaw, file) {
  return esbuild().transformSync(x, {
    ...(debug ? { logLevel: 'debug' } : {}),
    jsx: 'transform',
    jsxFactory: 's',
    jsxFragment: 's.jsx',
    loader: tsx ? 'tsx' : 'ts',
    tsconfigRaw: tsconfigRaw,
    sourcefile: path.relative(process.cwd(), file.indexOf('file://') === 0 ? fileURLToPath(file) : file)
  }).code
}

export function getLocal(x) {
  if (x)
    return x

  const local = path.join(process.cwd(), 'node_modules', 'cofound')
  return fs.existsSync(local)
    ? local
    : path.join(url.fileURLToPath(new URL('.', import.meta.url)), '..')
}
