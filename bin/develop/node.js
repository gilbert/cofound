import fs from 'node:fs'
import URL from 'node:url'
import path from 'node:path'
import cp from 'node:child_process'

import exit from 'cofound/exit'
import color from '../color.js'
import coverage from '../test/coverage.js'

import config from './config.js'
import api from './api.js'
import { Watcher } from './shared.js'
import { modify } from '../shared.js'

const dirname = path.dirname(URL.fileURLToPath(import.meta.url))
    , replace = Math.random()

let node
  , ws
  , scripts = new Map()
  , startPerf
  , closed
  , restarting = false

export const closing = new Promise(r => closed = r)

exit.wait('node', async() => {
  await close()
  closed()
})

export const onlyServer = await tryStart()

config.script
  ? api.node.watch(config.entry)
  : api.log('🔥 ' + api.url)

Watcher(() => api.node.restart('reload')).add('.env')
api.node.restart.observe(restart)
api.node.hotload.observe(hotload)

async function hotload(x) {
  if (!node)
    return restart()

  if (!scripts.has(x.path))
    return

  let scriptSource = ''
  try {
    scriptSource = modify(x.next, x.path, config)
  } catch (e) {
    return api.log({
      from: 'node transform',
      type: 'error',
      args: [e.message]
    })
  }

  const r = ws && await ws.request('Debugger.setScriptSource', {
    scriptId: scripts.get(x.path),
    scriptSource
  })

  r && r.status === 'CompileError'
  ? api.log({
    from: 'node',
    type: 'error',
    args: [{ type: 'string', value: r.exceptionDetails?.text }],
    stackTrace: {
      callFrames: [{ url: x.path, ...r.exceptionDetails }]
    }
  })
  : api.log({ replace, from: 'node', type: 'status', value: '🔥' })
}

async function restart(x) {
  restarting = true
  try {
    api.log({ replace: 'nodeend', from: 'node', type: 'status', value: '🔄' })
    await close()
    await tryStart()
    x === 'reload' && setTimeout(() => api.browser.reload(), 200)
  } finally {
    restarting = false
  }
}

async function tryStart() {
  let onlyServer = null
  let tries = 0
  while (onlyServer === null) {
    onlyServer = await start().catch(err => {
      if (tries++ > 10)
        throw err
      return null
    })
    if (onlyServer === null)
      await   new Promise(r => api.node.hotload.observe(r, true))
  }
  return onlyServer
}

async function close() {
  if (ws && ws.coverage) {
    const { result } = await ws.request('Profiler.takePreciseCoverage')
    console.log('Node Coverage', await coverage(result)) // eslint-disable-line
  }
  if (!node)
    return

  const child = node
  const closed = new Promise(r => child.once('close', r))
  child.kill()
  await closed
}

async function start() {
  startPerf = performance.now()
  let resolve
    , reject
    , closeTimer

  const promise = new Promise((r, e) => (resolve = r, reject = e))

  api.log({ replace, from: 'node', type: 'status', value: '⏳' })
  node = cp.fork(
    config.script ? config.entry : path.join(dirname, 'serve.js'),
    process.argv.slice(2),
    {
      stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      execArgv: [
        '--import', '' + URL.pathToFileURL(path.join(dirname, 'import.js')),
        '--trace-uncaught',
        '--inspect=' + config.nodePort
      ]
    }
  )

  node.stdout.setEncoding('utf8')
  node.stdout.on('data', x => {
    config.debug && console.error('Node stdout: ' + x) // eslint-disable-line
    api.log({ from: 'node', type: 'stdout', args: x })
  })
  node.stderr.setEncoding('utf8')
  node.stderr.on('data', async x => {
    config.debug && console.error('Node stderr: ' + x) // eslint-disable-line
    x.includes('Debugger listening on ws://127.0.0.1:' + config.nodePort)
      ? ws = connect(x.slice(22).split('\n')[0].trim())
      : x.includes('Waiting for the debugger to disconnect...')
      ? ws && (closeTimer = setTimeout(() => ws.close(), 200))
      : x.trim() !== 'Debugger attached.'
      ? api.log({ from: 'node', type: 'stderr', args: x })
      : null
  })

  config.script || node.on('message', x => {
    x.startsWith('started:')
      ? resolve(x.slice(8) === 'true')
      : x.startsWith('watch:') && api.browser.watch(fs.realpathSync(x.slice(6)))
  })

  node.on('close', async(code, signal) => {
    ws && ws.close()
    clearTimeout(closeTimer)
    ws = node = null

    exit.exiting || api.log({
      replace: 'nodeend',
      from: 'node',
      type: 'status',
      right: color.dim(duration()),
      value: code
        ? '💥 (' + code + ')'
        : '🏁'
    })

    if (!exit.exiting && !restarting) {
      process.exitCode = code || 1
      exit('SIGTERM')
      return
    }

    code
      ? reject('Exited with code: ' + code + (signal ? 'on ' + signal : ''))
      : resolve()
  })

  const result = await promise
  startPerf = performance.now()
  api.log({ replace, from: 'node', type: 'status', value: '🚀' })

  return result

  function duration() {
    return (performance.now() - startPerf).toFixed(2) + 'ms'
  }

  function connect(url) {
    const requests = new Map()

    let id = 1

    const ws = new WebSocket(url)
    ws.onopen = onopen
    ws.onmessage = onmessage
    ws.request = request
    ws.onclose = () => clearTimeout(closeTimer)

    return ws

    async function request(method, params) {
      return ws.readyState === 1 && new Promise((resolve, reject) => {
        const message = {
          id: id++,
          method,
          params,
          resolve,
          reject
        }
        requests.set(message.id, message)
        ws.send(JSON.stringify(message))
      })
    }

    async function onopen() {
      await request('Runtime.enable')
      await request('Runtime.setAsyncCallStackDepth', { maxDepth: 128 })
      await request('Debugger.enable')
      if (config.coverage && config.coverage !== 'chrome') {
        ws.coverage = true
        await request('Profiler.enable')
        await request('Profiler.startPreciseCoverage', { callCount: true, detailed: true })
      }
      config.script && resolve(true)
    }

    function onmessage({ data }) {
      const { id, method, params, error, result } = JSON.parse(data)
      if (method === 'Debugger.scriptParsed' && params.url)
        return parsed(params)

      if (method === 'Runtime.consoleAPICalled')
        return api.log({ from: 'node', ...params })

      if (!requests.has(id))
        return

      const x = requests.get(id)
      requests.delete(id)

      error
        ? x.reject(error)
        : x.resolve(result)
    }

    function parsed(script) {
      if (!script.url.startsWith('file://'))
        return

      const x = URL.fileURLToPath(script.url)
      const p = fs.realpathSync(path.isAbsolute(x) ? x : path.join(process.cwd(), x))
      scripts.set(p, script.scriptId)
      api.node.watch(p)
    }
  }
}
