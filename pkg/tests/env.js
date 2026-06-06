import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import Env from 'cofound/env'

const ORIGINAL_ENV = { ...process.env }
const ENV_MODULE = new URL('../bin/env.js', import.meta.url).href

test.afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key]
  Object.assign(process.env, ORIGINAL_ENV)
})

test('Env validates NODE_ENV and exposes read', () => {
  process.env.NODE_ENV = 'test'
  const env = Env(['test', 'development', 'production'])

  assert.equal(env.name, 'test')
  assert.equal(typeof env.read, 'function')
})

test('env.read throws for missing required values', () => {
  process.env.NODE_ENV = 'test'
  const env = Env(['test'])

  assert.throws(
    () => env.read('COFOUND_TEST_REQUIRED_VALUE'),
    /Please set COFOUND_TEST_REQUIRED_VALUE/,
  )
})

test('env.read treats empty values as missing unless the default is empty', () => {
  process.env.NODE_ENV = 'test'
  process.env.COF_TEST_EMPTY = ''
  const env = Env(['test'])

  assert.equal(env.read('COF_TEST_EMPTY', 'fallback'), 'fallback')
  assert.equal(process.env.COF_TEST_EMPTY, 'fallback')

  process.env.COF_TEST_EMPTY_ALLOWED = ''
  assert.equal(env.read('COF_TEST_EMPTY_ALLOWED', ''), '')
})

test('env.read supports parsers and writes string defaults to process.env', () => {
  process.env.NODE_ENV = 'test'
  const env = Env(['test'])

  assert.equal(env.read('COF_TEST_PORT', '7357', Number), 7357)
  assert.equal(process.env.COF_TEST_PORT, '7357')

  process.env.COF_TEST_WIDTH = '320'
  assert.equal(env.read('COF_TEST_WIDTH', Number), 320)
})

test('env.read rejects non-string defaults', () => {
  process.env.NODE_ENV = 'test'
  const env = Env(['test'])

  assert.throws(
    () => env.read('COF_TEST_BAD_DEFAULT', 123),
    /Default value for key 'COF_TEST_BAD_DEFAULT' must be a string/,
  )
})

test('Env rejects invalid NODE_ENV', () => {
  process.env.NODE_ENV = 'staging'

  assert.throws(
    () => Env(['test', 'development', 'production']),
    /Invalid NODE_ENV 'staging'/,
  )
})

test('env.branch follows the current environment', () => {
  process.env.NODE_ENV = 'production'
  const env = Env(['test', 'development', 'production'])

  assert.equal(env.branch({ test: 't', development: 'd', production: 'p' }), 'p')
  assert.equal(env.branch('fallback', { test: 't' }), 'fallback')
  assert.equal(env.branch(name => `default:${name}`, { test: 't' }), 'default:production')
  assert.equal(env.branch({ production: name => `env:${name}` }), 'env:production')
})

test('importing cofound/env loads .env from cwd parents', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cofound-env-'))
  const nested = path.join(dir, 'a', 'b')
  mkdirSync(nested, { recursive: true })
  writeFileSync(path.join(dir, '.env'), 'COF_TEST_DOTENV=loaded\n')

  const code = `
    process.chdir(${JSON.stringify(nested)})
    await import(${JSON.stringify(ENV_MODULE)})
    console.log(process.env.COF_TEST_DOTENV)
  `

  const out = execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
  }).trim()

  assert.equal(out, 'loaded')
})
