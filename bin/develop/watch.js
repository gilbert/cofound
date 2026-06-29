import api from './api.js'
import config from './config.js'
import { Watcher, tryRead } from './shared.js'

const browserWatch = new Set()
    , nodeWatch = new Set()
    , watching = new Map()

const watcher = Watcher(changed)

api.node.watch.observe(x => watch(x, nodeWatch))
api.browser.watch.observe(x => watch(x, browserWatch))

async function watch(path, origin) {
  origin.add(path)
  if (watching.has(path))
    return watching.get(path)

  const file = { path }
  watching.set(path, file)
  await read(path)
  update(file)
  watcher.add(path)
  return file
}

async function changed(path) {
  const x = await read(path)
  nodeWatch.has(path)
    ? browserWatch.has(path)
      ? both(x)
      : node(x)
    : browserWatch.has(path)
      ? browser(x)
      : remove(x)

  update(x)
}

function remove(x) {
  watcher.remove(x)
  browserWatch.delete(x)
  nodeWatch.delete(x)
}

function node(x) {
  // For TypeScript files that might be imported by other modules,
  // restart the node process to ensure all imports are refreshed
  const isTypescript = x.path.endsWith('.ts') || x.path.endsWith('.tsx')
  const isProjectJavaScript = x.path.startsWith(config.cwd + '/') && /\.(mjs|cjs|js|jsx)$/.test(x.path)
  const isMainEntry = x.path.includes('/+server/index.') || x.path.includes('/index.')

  if (x.next === x.content) {
    api.node.restart(x)
  } else if (isTypescript && !isMainEntry) {
    // Restart for non-entry TypeScript files to ensure imports are refreshed
    api.node.restart(x)
  } else if (isProjectJavaScript && !isMainEntry) {
    // Restart for non-entry JavaScript files to refresh module top-level state
    api.node.restart(x)
  } else {
    api.node.hotload(x)
  }
}

function browser(x) {
  x.next === x.content
    ? api.browser.reload(x)
    : api.browser.hotload(x)
}

function both(x) {
  const isTypescript = x.path.endsWith('.ts') || x.path.endsWith('.tsx')
  const isProjectJavaScript = x.path.startsWith(config.cwd + '/') && /\.(mjs|cjs|js|jsx)$/.test(x.path)
  const isMainEntry = x.path.includes('/+server/index.') || x.path.includes('/index.')

  if (x.next === x.content) {
    x.content === x.pre
      ? api.node.restart('reload')
      : (api.node.hotload(x), api.browser.reload(x))
  } else if (isTypescript && !isMainEntry) {
    // Restart Node for non-entry TypeScript files, but try to hotload in browser
    api.node.restart(x)
    api.browser.hotload(x)
  } else if (isProjectJavaScript && !isMainEntry) {
    // Restart Node for non-entry JavaScript files, but try to hotload in browser
    api.node.restart(x)
    api.browser.hotload(x)
  } else {
    api.node.hotload(x)
    api.browser.hotload(x)
  }
}

async function read(path) {
  const x = watching.get(path)
  x.next = await tryRead(x.path, 'utf8')
  return x
}

function update(x) {
  x.pre = x.content
  x.content = x.next
}
