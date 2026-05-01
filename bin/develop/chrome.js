/* eslint no-console: 0 */

// https://chromedevtools.github.io/devtools-protocol/

import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import cp from 'node:child_process'

import exit from 'cos/exit'
import config from './config.js'
import api from './api.js'
import { rewrite } from './shared.js'
import coverage from '../test/coverage.js'

import s from '../../src/index.js'

if (!config.chromePath || !fs.existsSync(config.chromePath))
  throw new Error('Could not find a Chrome installation. Install Chrome or set a valid path using CHROME_PATH=')

let root

const hmr = 'window.self===window.top&&(window.cosdevhmr=1);Error.stackTraceLimit=128;'
    , replace = Math.random()

api.log({ replace, from: 'browser', type: 'status', value: '⏳' })
ensurePrefs()

let closed
let exited
const close = new Promise(r => closed = r)
const exiting = new Promise(r => exited = r)
const tabs = new Map()
const noop = () => { }
const timeout = (config.ci ? 60 : 20) * 1000
const chrome = await Promise.race([
  spawn(),
  s.sleep(timeout).then(() => Promise.reject('Chrome spawn timed out'))
])

await Promise.race([
  updateTabs(true),
  s.sleep(timeout).then(() => Promise.reject('Chrome connect timed out'))
])

api.browser.hotload.observe(hotload)
api.log({ replace, from: 'browser', type: 'status', value: '🚀' })

await close

async function hotload(x) {
  await Promise.all([...tabs].map(async([_, { ws }]) => {
    if (ws && ws.scripts.has(x.path)) {
      let scriptSource = ''
      try {
        scriptSource = rewrite(x.next, x.path)
      } catch (e) {
        return api.log({
          from: 'browser transform',
          type: 'error',
          args: [e.message]
        })
      }

      try {
        const r = await ws.request('Debugger.setScriptSource', {
          scriptId: ws.scripts.get(x.path),
          scriptSource,
          allowTopFrameEditing: true
        })

        r.status === 'CompileError' && api.log({
          from: 'browser',
          type: 'hotload error',
          args: [{ type: 'string', value: r.exceptionDetails?.text }],
          stackTrace: {
            callFrames: [{ url: x.path, ...r.exceptionDetails }]
          }
        })
      } catch (e) {
        config.debug && api.log({ from: 'browser', type: 'hotload error', args: util.inspect(e) })
        ws.request('Page.reload').catch(noop)
      }
    } else if (ws && ws.sheets.has(x.path)) {
      ws.request('CSS.setStyleSheetText', { styleSheetId: ws.sheets.get(x.path), text: x.next })
    } else if (ws) {
      ws.request('Page.reload').catch(noop)
    }
  }))
  api.browser.redraw()
}

async function updateTabs(launch) {
  let xs = await getTabs(config.origin)
  while (launch && xs.length === 0) {
    s.sleep(100)
    xs = await getTabs(config.origin)
  }

  await Promise.all(
    xs.map(async x => {
      if (x.type !== 'page')
        return

      if (x.url === 'about:blank')
        launch && await connect(x, api.url())
      if (x.url === 'chrome://newtab/')
        launch && s.http(root + '/json/close/' + x.id, { responseType: 'text' })
      else if (x.url.indexOf(config.origin) === 0) {
        launch && tabs.size === 0 && s.http(root + '/json/activate/' + x.id, { responseType: 'text' }).catch(noop)
        await connect(x)
      }
    })
  )

  if (launch && tabs.size === 0) {
    const x = await s.http.put(root + '/json/new?about:blank')
    await connect(x, api.url())
  }
}

async function connect(tab, url) {
  if (tabs.has(tab.webSocketDebuggerUrl))
    return

  tabs.set(tab.webSocketDebuggerUrl, tab)
  let id = 1

  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  const requests = new Map()

  tab.ws = ws

  ws.scripts = new Map()
  ws.sheets = new Map()
  ws.onmessage = onmessage
  ws.onerror = noop
  ws.onclose = () => tabClosed(tab)
  ws.request = request

  return new Promise(r => ws.onopen = () => onopen().then(r))

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
    await Promise.all([
      request('Runtime.enable'),
      request('Debugger.enable').catch(e => api.log({ from: 'browser', type: 'chrome error', args: String(e) })),
      request('Network.enable'),
      request('Log.enable'),
      request('Page.enable'),
      request('DOM.enable'),
      request('CSS.enable')
    ])

    await Promise.all([
      request('Runtime.setAsyncCallStackDepth', { maxDepth: 128 }),
      request('Debugger.setBlackboxPatterns', { patterns: api.blackbox }),
      request('Target.setDiscoverTargets', { discover: true }),
      request('Network.setCacheDisabled', { cacheDisabled: true }),
      request('Page.addScriptToEvaluateOnNewDocument', { source: hmr, runImmediately: true })
    ])

    if (config.coverage && config.coverage !== 'node') {
      ws.coverage = true
      await Promise.all([
        request('Profiler.enable'),
        request('Profiler.startPreciseCoverage', { callCount: true, detailed: true })
      ])
    }

    url && await request('Page.navigate', { url: api.url() })
    await request('Runtime.evaluate', { expression: hmr })
  }

  function onmessage({ data }) {
    const { id, method, params, error, result } = JSON.parse(data)
    if (method === 'Debugger.scriptParsed' && params.url)
      return parsed(params)

    if (method === 'CSS.styleSheetAdded')
      return css(params.header)

    if (method === 'Page.navigatedWithinDocument' && params.url.indexOf(config.origin) === 0)
      return api.url(params.url)

    if (method === 'Page.frameNavigated' && !params.frame.parentId && params.frame.url.indexOf(config.origin) === 0)
      return api.url(params.frame.url)

    if (method === 'Log.entryAdded')
      return api.log({ from: 'browser', type: params.entry.level, args: [{ type: 'string', value: params.entry.text }], stackTrace: { callFrames: [{ url: params.entry.url }] } })

    if (method === 'Runtime.consoleAPICalled')
      return api.log({ ws, replace: Math.random(), from: 'browser', ...params })

    if (method === 'Runtime.exceptionThrown')
      return api.log({ from: 'browser', type: 'exception', ...params.exceptionDetails })

    if (method === 'Target.targetCreated' || method === 'Target.targetInfoChanged')
      return updateTabs()

    if (!requests.has(id))
      return

    const { reject, resolve } = requests.get(id)
    requests.delete(id)

    error
      ? reject(error)
      : resolve(result)
  }

  function parsed(script) {
    const x = path.join(config.cwd, new URL(script.url).pathname)
    if (script.url.indexOf(config.origin) !== 0 || !isFile(x))
      return

    const p = fs.realpathSync(path.isAbsolute(x) ? x : path.join(process.cwd(), x))
    ws.scripts.set(p, script.scriptId)
    api.browser.watch(p)
  }

  function css(sheet) {
    if (!sheet.sourceURL)
      return

    const x = path.join(config.cwd, config.publicDir, new URL(sheet.sourceURL).pathname)
    if (sheet.sourceURL.indexOf(config.origin) !== 0 || !isFile(x))
      return

    const p = fs.realpathSync(path.isAbsolute(x) ? x : path.join(process.cwd(), x))
    ws.sheets.set(p, sheet.styleSheetId)
    api.browser.watch(p)
  }

}

async function tabClosed(tab) {
  tabs.delete(tab.webSocketDebuggerUrl)
  if (tabs.size === 0 && (await getTabs(config.origin, 20).catch(() => [])).length === 0)
    closed()
}

function isFile(x) {
  try {
    return fs.statSync(x).isFile()
  } catch (e) {
    return false
  }
}

async function getTabs(url, retries = 0) {
  try {
    return await s.http(root + '/json/list/')
  } catch (err) {
    if (retries > 20)
      throw new Error('Could not fetch Chrome tabs: ' + err)

    await new Promise(r => setTimeout(r, 200))
    return getTabs(url, ++retries)
  }
}

async function spawn() {
  return new Promise((resolve, reject) => {
    const chrome = cp.spawn(config.chromePath, [
      ...(config.headless ? ['--headless=new'] : []),
      ...(config.devtools ? ['--auto-open-devtools-for-tabs'] : []),
      '--no-first-run',
      '--disable-features=PrivacySandboxSettings4',
      '--disable-search-engine-choice-screen',
      '--no-default-browser-check',
      '--disable-web-security',
      '--disable-translate',
      '--disable-features=TranslateUI',
      '--disable-features=Translate',
      '--disable-infobars',
      '--test-type', // Remove warning banner from --disable-web-security usage
      config.test ? '' : '--restore-last-session',
      '--user-data-dir=' + userDataDir(config.project),
      '--remote-debugging-port=0'
    ].filter(x => x))

    exit.wait('chrome', async() => {
      let ok
      try {
        for (const x of tabs.values()) {
          if (x.ws) {
            if (x.ws.coverage) {
              const { result } = await x.ws.request('Profiler.takePreciseCoverage')
              console.log('Chrome Coverage', await coverage(result))
            }
            ok = await x.ws.request('Browser.close')
            break
          }
        }
      } finally {
        ok || chrome.kill()
      }
      await exiting
    })

    chrome.stderr.setEncoding('utf8')
    chrome.stderr.on('data', x => {
      config.debug && console.error('Chrome stderr: ' + x)
      if (root)
        return

      const [_, port] = x.match(/DevTools listening on .+:([0-9]+)\//) || []
      if (!port)
        return

      root = 'http://127.0.0.1:' + port
      resolve(chrome)
    })

    chrome.stdout.setEncoding('utf8')
    chrome.stdout.on('data', x => {
      config.debug && console.error('Chrome stdout: ' + x)
      resolve(chrome)
    })

    chrome.on('error', reject)
    chrome.on('close', x => {
      x && reject('Chrome Closed with exit code: ' + x)
      exited()
    })
  })
}

function userDataDir(x) {
  return process.env.WSL_DISTRO_NAME
    ? 'C:' + x.slice(6).replace(/\//g, '\\')
    : x
}

function ensurePrefs() {
  const def = path.join(config.project, 'Default')
  const prefs = path.join(def, 'Preferences')

  if (fs.existsSync(prefs))
    return

  fs.mkdirSync(def, { recursive: true })

  fs.writeFileSync(prefs,
    JSON.stringify({
      privacy_sandbox: {
        anti_abuse_initialized: true,
        first_party_sets_data_access_allowed_initialized: true,
        m1: {
          ad_measurement_enabled: true,
          consent_decision_made: true,
          eea_notice_acknowledged: true,
          fledge_enabled: true,
          topics_enabled: false
        },
        topics_consent: {
          consent_given: false,
          last_update_reason: 1,
          last_update_time: Date.now() * 1000 - Date.UTC(1601, 0, 1) * 1000,
          text_at_last_update: 'Turn on an ad privacy feature We’re launching new privacy features that give you more choice over the ads that you see. Ad topics help sites show you relevant ads while protecting your browsing history and identity. Chrome can note topics of interest based on your recent browsing history. Later, a site that you visit can ask Chrome for relevant topics to personalise the ads that you see. You can see ad topics in settings and block the ones that you don’t want shared with sites. Chrome also auto-deletes ad topics that are older than four weeks. You can change your mind at any time in Chrome settings More about ad topics What data is used: Your ad topics are based on your recent browsing history – a list of sites that you’ve visited using Chrome on this device. How we use this data: Chrome notes topics of interest as you browse. Topic labels are predefined and include things like Arts and entertainment, Shopping and Sports. Later, a site that you visit can ask Chrome for a few of your topics (but not your browsing history) to personalise the ads that you see. How you can manage your data: Chrome auto-deletes topics that are older than four weeks. As you keep browsing, a topic might reappear on the list. You can also block topics that you don’t want Chrome to share with sites and turn ad topics off at any time in Chrome settings. Learn more about how Google protects your data in our privacy policy.'
        }
      }
    })
  )
}
