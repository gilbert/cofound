import fs from 'node:fs'
import Url from 'node:url'
import process from 'node:process'

import exit from 'cofound/exit'
import p from './log.js'
import config from './config.js'
import api from './api.js'
import c from '../color.js'

let logFile = config.logFile
  ? fs.createWriteStream(config.logFile, { flags: 'w' })
  : null

if (logFile) {
  api.node.restart.observe(() => {
    logFile.end()
    logFile = fs.createWriteStream(config.logFile, { flags: 'w' })
  })
}

let lines = 1
  , indent = 0

api.browser.reload.observe(() => std({ from: 'browser', replace: 'browserhot', type: 'status', value: '🔄' }))
api.browser.hotload.observe(() => std({ from: 'browser', replace: 'browserhot', type: 'status', value: '🔥' }))

api.log.observe(std)

if (process.stdin.isTTY) {
  exit.wait('stdin', () => process.stdin.pause())
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.on('data', x => {
    x = x.toString()
      x === '\x03' ? exit('SIGINT')
    : x === '\x1A' ? exit('SIGTSTP')
    : x === '\x1C' ? exit('SIGQUIT')
    : x === 'r' ? (process.stdout.write('r'), api.node.restart())
    : x === 'i' ? (process.stdout.write('i'), api.log() && more(api.log()))
    : x === '\r' ? process.stdout.write('\n')
    : process.stdout.write(x)
  })
}

async function more({ ws, from, type, stackTrace, timestamp, args, replace }) {
  if (!ws)
    return

  const x = await Promise.all(args.map(x =>
    ws.request('Runtime.getProperties', {
      objectId: x.objectId,
      ownProperties: true,
      generatePreview: true
    })
  ))

  args = x.map(({ result, internalProperties: [{ value }] }) => ({
    preview: {
      properties: result.flatMap(x =>
        value.subtype === 'array'
          ? x.name === 'length' ? [] : [x.value]
          : [{ name: x.name, ...x.value }]
      )
    },
    ...value
  }))

  api.log({
    max: 200,
    stackTrace,
    timestamp,
    replace,
    type,
    from,
    args
  })
}

function std(x) {
  indent = 0
  const heading = x.from && head(x.from + ' ' + x.type, x.type === 'error' || x.type === 'exception' || x.type === 'stderr')
  let output = ''

  output = x.type === 'status'
    ? x.value + ' ' + (x.from[0].toUpperCase() + x.from.slice(1))
    : x.args
    ? logInfo(x)
    : x.type === 'exception'
    ? logInfo(exception(x))
    : logArg(x, x.max)

  const changed = heading && heading !== std.heading
      , repeat = !changed && output === std.output ? ++std.count : std.count = 0
      , replace = x.replace && std.last && x.replace === std.last.replace

  if (std.heading && x.type !== 'status' && changed)
    p('\n' + heading)

  if (replace && !repeat) {
    for (let i = 0; i < lines; i++)
      process.stdout.write('\x1B[F\x1B[2K')
  }

  const write = repeat
    ? (std.count > 1 ? '\x1B[F\x1B[G' : '') + time(x.timestamp) + c.dim`last line repeated ${ c.white(std.count) } times`
    : time(x.timestamp) + output

  const out = x.right
    ? padBetween(write, x.right)
    : write

  p(out)

  if (logFile) {
    const plain = out.replace(/\x1b\[[0-9;]*m/g, '')
    logFile.write(plain + '\n')
  }

  lines = out.split('\n').reduce(
    (acc, x) => acc + Math.ceil(rawLength(x) / process.stdout.columns),
    0
  )

  x.type !== 'status' && (std.heading = heading)
  std.output = output
  std.last = x
}

function head(x, red) {
  return c[red ? 'bgRed' : 'bgGray'](
    c[red ? 'black' : 'white'](c.bold(
      padBoth(x.split('').join(' ').toUpperCase())
    ))
  )
}

function logInfo(x) {
  let stack = x.stackTrace
    ? logStack(x.stackTrace.callFrames, 'trace error'.includes(x.type) ? 100 : (x.max || 1))
    : []

  stack.length || (stack = [''])

  return stack.map((f, i) =>
    padBetween(
      i ? '' : Array.isArray(x.args) ? x.args.map(a => logArg(a, x.max)).join(' ').trim() : x.args,
      f.trim(),
      i ? 0 : 14
    )
  ).join('\n')
}

function exception(x) {
  if (x.exception.type === 'string')
    return { args: [x.exception], stackTrace: { callFrames: [x] } }

  const properties = x.exception?.preview?.properties?.filter(x => x.name !== 'stack' && x.name !== 'message') || []
  return {
    args: [
      {
        type: 'string',
        value: [
          x.exception?.className + ':',
          x.exception?.preview?.properties?.find(x => x.name === 'message')?.value
        ].filter(x => x).join(' ')
      },
      ...(properties.length ? [{
        type: 'object',
        preview: { properties }
      }] : [])
    ],
    stackTrace: {
      callFrames: x.stackTrace && x.stackTrace.callFrames || [x]
    }
  }
}

function padBoth(x, w = process.stdout.columns) {
  const padding = Math.max(0, w - x.length)
  return ' '.repeat(Math.floor(padding / 2)) + x + ' '.repeat(Math.ceil(padding / 2))
}

function rawLength(x) {
  return x.replace(/\x1b\[[0-9;]*m/g, '').length
}

function padBetween(a, b, prefix = 0) {
  a = a.trimEnd()
  b = b.trimStart()

  if (!b)
    return a

  const al = rawLength(a)
  const bl = rawLength(b)
  return a && prefix + al + bl + 2 > process.stdout.columns
    ? a + '\n ' + padBetween('', b)
    : a.padEnd(process.stdout.columns - 1 - bl + (a.length - al) - prefix, ' ') + b
}

function logArg(x, max) {
  return x.type === 'string' ? (x.value ? c.cyan(x.value) : c.dim('\'\''))
    : x.type === 'number' ? c.blue(x.value)
    : x.type === 'boolean' ? c.dim(x.value)
    : x.type === 'undefined' ? c.dim('undefined')
    : x.type === 'function' ? c.dim(x.className || 'Function')
    : x.type === 'object' ? (
        x.subtype === 'null' ? c.dim('null')
      : x.subtype === 'date' && !Number.isNaN(Date.parse(x.description)) ? c.magenta(new Date(x.description).toISOString())
      : x.preview ? (
          x.subtype === 'array' ? logArray(x.preview.properties, max)
        : x.subtype === 'error' ? logError(x)
        : logObject(x.preview.properties, x.preview.overflow, max)
      )
      : '{…}'
    )
    : x.value || x
}

function logError(e) {
  return [
    { type: 'string', value: e.description.split('\n')[0] },
    ...e.preview.properties.filter(x => x.name !== 'stack' && x.name !== 'message')
  ].map(x => logArg(x, e.max))
}

function logArray(xs, max = 32) {
  return '[ '
    + (xs.length > max ? xs.slice(0, max) : xs).map(x => logArg(x, max)).join(', ')
    + (xs.length > max ? ', …' : '')
    + ' ]'
}

function logObject(xs, overflow, max = 32) {
  const args = xs.map(x => x.name + ': ' + logArg(x, max))
  indent++
  overflow = overflow || args.length > max

  const single = !overflow && max === 32 && args.reduce((a, b) => a + rawLength(b), 0) < 50
  const x = '{ '
    + (single ? '' : '\n ' + '  '.repeat(indent))
    + args.slice(0, max).join(single ? ', ' : ',\n ' + '  '.repeat(indent))
    + (overflow ? ',\n' + '  '.repeat(indent) + ' …' + c.dim('  // Press `i` to show more') : '')
    + (single ? ' }' : '\n ' + '  '.repeat(indent - 1) + '}')
  indent--
  return x
}

function logStack(stack, max = 10) {
  return stack
    .filter(s =>
      s.url && api.blackbox.every(x => !s.url.match(new RegExp(x, 'i')))
            && !s.url.includes('cofound/bin/develop/log.js')
    )
    .slice(0, max)
    .map(x =>
      c.dim(
          (x.functionName || '') + ' @ '
        + [
          '.' + x.url.replace(config.origin, '').replace(Url.pathToFileURL(config.cwd), ''),
          'lineNumber' in x && x.lineNumber + 1,
          'columnNumber' in x && x.columnNumber + 1
        ].filter(x => x).join(':')
      )
    )
}

function time(d = Date.now()) {
  d = new Date(d)
  return ' ' + c.dim(
      ('' + d.getHours()).padStart(2, '0') + ':'
    + ('' + d.getMinutes()).padStart(2, '0') + ':'
    + ('' + d.getSeconds()).padStart(2, '0') + '.'
    + ('' + d.getMilliseconds()).padStart(3, '0')
  ) + ' '
}
