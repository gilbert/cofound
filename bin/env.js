import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

Object.assign(process.env, load(path.join(process.cwd(), '.env'), true))

export default function Env(validEnvs, defaultEnv) {
  const name = read('NODE_ENV', defaultEnv || 'development')
  const env = validEnvs.find(x => x === name)
  if (!env) {
    throw new Error(`[readtheroom] Invalid NODE_ENV '${name}'. Valid values are: ${validEnvs.join(', ')}`)
  }

  function branch(defaultValue, choices) {
    if (choices === undefined) {
      choices = defaultValue
    } else if (!(env in choices)) {
      return typeof defaultValue === 'function' ? defaultValue(env) : defaultValue
    }

    const value = choices[env]
    return typeof value === 'function' ? value(env) : value
  }

  return { name: env, branch, read }
}

function read(key, _defaultValue, _parse) {
  const [defaultValue, parse] = (() => {
    if (typeof _defaultValue === 'function') return [undefined, _defaultValue]
    if (typeof _parse === 'function') return [_defaultValue, _parse]
    if (_defaultValue !== undefined) return [_defaultValue, undefined]
    return [undefined, undefined]
  })()

  if (defaultValue !== undefined && typeof defaultValue !== 'string') {
    throw new Error(`[readtheroom] Default value for key '${key}' must be a string (found ${typeof defaultValue} instead)`)
  }

  const value = process.env[key]
  if (value === undefined || value === '' && defaultValue !== '') {
    if (defaultValue !== undefined) {
      process.env[key] = defaultValue
      return parse ? parse(defaultValue) : defaultValue
    }
    throw new Error(`[readtheroom] Please set ${key}`)
  }

  return parse ? parse(value) : value
}

function load(x = path.join(process.cwd(), '.env'), parents = false) {
  const xs = {}
  const filename = path.basename(x)
  let dir = path.dirname(x)
  let prev
  while (dir !== prev) {
    try {
      fs.readFileSync(path.join(dir, filename), 'utf8').split('\n').forEach((x, i) => {
        x = x.trim()
        if (x[0] === '#')
          return

        i = x.indexOf('=')
        if (i < 1)
          return

        const env = x.slice(0, i)
            , value = x.slice(i + 1)

        env in xs || (xs[env] = value)
      })
    } catch (err) {
      if (err.code !== 'ENOENT')
        throw err
    }
    prev = dir
    parents && (dir = path.dirname(dir))
  }
  return xs
}
