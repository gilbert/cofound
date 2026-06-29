#! /usr/bin/env node

import { pathToFileURL } from 'node:url'
import process from 'node:process'
import cp from 'node:child_process'

import exit from 'cofound/exit'
import config, { error } from './config.js'

const [major, minor] = process.versions.node.split('.').map(Number)

if (major < 20 || major === 20 && minor <= 10)
  throw error('cofound requires minimum Node.js support 20.11, please upgrade from v' + process.versions.node)

try {
  if (config.develop && major < 22 && typeof WebSocket === 'undefined') {
    const x = cp.spawnSync(process.argv[0], ['--experimental-websocket', '--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit' })
    process.exitCode = x.status
  } else {
    config.config && console.log(config) // eslint-disable-line
    config.config = false
    await import(pathToFileURL(config.local + '/bin/' + config.$[0] + '/index.js'))
  }
  await exit()
} catch (e) {
  config.config && console.log(config) // eslint-disable-line
  config.debug
    ? console.error(e) // eslint-disable-line
    : error(e)
  process.exitCode = process.exitCode || 1
  await exit()
  process.exitCode = process.exitCode || 1
}
