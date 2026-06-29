import fs from 'node:fs'
import cp from 'node:child_process'
import path from 'node:path'
import readline from 'node:readline'

import c from '../color.js'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

const argv = process.argv.slice(3)
    , cwd = process.cwd()
    , xs = fs.readdirSync(cwd)
    , empty = !xs.some(x => x[0] !== '.')
    , yes = argv.some(x => x === '-y' || x === '--yes')
    , name = argv.find(x => x[0] !== '-') || (empty ? path.basename(cwd) : (await ask('Project name?')))
    , target = empty ? cwd : path.join(cwd, name)
    , cd = target !== cwd
    , pkg = JSON.parse(fs.readFileSync(new URL('package.json', import.meta.url)))
    , full = await prompt('Full Setup?')
    , script = !full && await prompt('Just Run Node (script)?')
    , noscript = !full && !script && await prompt('Only SSR (--noscript)?')
    , staticServe = !full && !script && !noscript && await prompt('Just serve static files (static)?')
    , server = !full && !script && !noscript && !staticServe && await prompt('Just HTTP?')
    , git = !hasGit(cwd) && await prompt('Git?')
    , install = await prompt('Install?')

const serverScript = `export default async function(app) {
  app.get('/hello', r => r.end('Welcome to cofound'))
}
`

const clientScript = `import s from 'cofound'

s.mount(() =>
  s\`h1\`('Welcome to cofound')
)
`

pkg.name = name

mk(target)
process.chdir(target)

pkg.scripts.build = 'cofound build'
pkg.scripts.generate = 'cofound generate'

if (full) {
  pkg.scripts.start = 'cofound start'
  pkg.scripts.dev = 'cofound dev'
  mk(path.join(target, '+server'), 'index.js', serverScript)
  mk(path.join(target, '+public'))
  mk(target, 'index.js', clientScript.replace('export', '// Add `export default` to enable ssr with hydration\nexport'))
} else if (script) {
  pkg.scripts.start = 'cofound start script index.js'
  pkg.scripts.dev = 'cofound dev script index.js'
  mk(target, 'index.js', '// Do your thing\n')
} else if (noscript) {
  pkg.scripts.start = 'cofound start noscript'
  pkg.scripts.dev = 'cofound dev noscript'
  mk(path.join(target, '+server'), 'index.js', serverScript)
  mk(path.join(target, '+public'))
  mk(target, 'index.js', clientScript)
} else if (staticServe) {
  pkg.scripts.start = 'cofound start static'
  pkg.scripts.dev = 'cofound dev static'
} else if (server) {
  pkg.scripts.start = 'cofound start server'
  pkg.scripts.dev = 'cofound dev server'
  mk(target, 'index.js', serverScript)
}

mk(target, 'package.json', JSON.stringify(pkg, null, 2))

cpDir(new URL('../../template/docs', import.meta.url).pathname, path.join(target, 'docs'))

git && (cp.execSync('git init', { stdio: 'inherit' }), mk(target, '.gitignore', 'node_modules\n.env'))
install && cp.execSync('npm install cofound', { stdio: 'inherit' })

!global.print && console.log( // eslint-disable-line
  cd
    ? '\nRun `cd ' + name + '` and then `npm run dev` to start developing\n'
    : '\nRun `npm run dev` to start developing\n'
)

rl.close()

function cpDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    entry.isDirectory() ? cpDir(s, d) : fs.copyFileSync(s, d)
  }
}

function mk(x, file, data = '') {
  fs.mkdirSync(x, { recursive: true })
  file && !fs.existsSync(path.join(x, file)) && fs.writeFileSync(path.join(x, file), data)
}

async function prompt(x) {
  return yes || (await ask(x + c.dim(' (Y/n)'))).toLowerCase() !== 'n'
}

async function ask(x) {
  return new Promise(r => rl.question(x + ' ', r))
}

function hasGit(x) {
  let prev
  while (x !== prev) {
    prev = x
    if (fs.existsSync(path.join(x, '.git')))
      return true
    x = path.dirname(x)
  }
}
