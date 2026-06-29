import process from 'node:process'

export default async function(x, options) {
  if (!options) {
    options = x
    x = process.argv.slice(2)
  }

  const extras = process.argv.indexOf('--')
  let argv = extras > -1 ? x.slice(0, extras - 2) : x

  let { commands, parameters, flags, alias, envPrefix } = options

  const toKebab = x => '--' + x.replace(/([A-Z])/g, '-$1').toLowerCase()
      , toEnv = x => envPrefix ? (typeof envPrefix === 'string' ? envPrefix + '_' : '') + x.replace(/-/g, '_').replace(/([A-Z])/g, '_$1').toUpperCase() : undefined
      , saila = Object.entries(alias).reduce((acc, [k, v]) => (acc[v] = k, acc), {})
      , result = { $: [], _: [], __: x.slice(argv.length) }

  argv = argv.flatMap(x => x.indexOf('=') !== -1 ? x.split('=') : x).flatMap(x => x in alias ? alias[x] : x)

  while (commands && Object.keys(commands).length) {
    const commandEnv = toEnv('command') + (result.$.length ? result.$.length + 1 : '')
    let command
    for (const x in commands) {
      if (x.startsWith(argv[0])) {
        command = x
        result.$.push(x)
        result[x] = true
        commands = commands[x] === 1 ? null : commands[x]
        argv = argv.slice(1)
        break
      }
    }

    if (!command && process.env[commandEnv]) {
      command = process.env[commandEnv]
      commands = commands[command] === 1 ? null : commands[command]
      result.$.push(command)
    }

    if (command) {
      process.env[commandEnv] = command
    } else {
      if ('$' in commands) {
        result.$.push(process.env[commandEnv] = commands.$)
        break
      }
      throw new Error('Unknown command \'' + argv[0] + '\' - check help')
    }
  }

  while (argv[0] && !argv[0].startsWith('--'))
    result._.push(argv.shift())

  while (argv[argv.length - 1] && !(argv[argv.length - 2] || '').startsWith('--') && argv[argv.length - 2] in parameters)
    result._.push(argv.pop())

  for (const x in flags) {
    const idx = argv.indexOf(toKebab(x))
    if (idx === -1) {
      result[x] = typeof flags[x] === 'function'
        ? await flags[x](process.env[toEnv(x)], result, x => read(x, result, result))
        : process.env[toEnv(x)] || flags[x]
      setEnv(x, result[x])
    } else if (idx >= argv.length - 1 || (argv[idx + 1] || '').startsWith('--')) {
        result[x] = true
        setEnv(x, result[x])
        argv.splice(idx, 1)
    } else if (x in parameters === false) {
      throw new Error(x + ' is a flag (does not take a value)')
    }
  }

  await read(parameters, result, result)
  commands === 0 || argv.forEach(x => {
    if (x.startsWith('--'))
      throw new Error(x + ' is not a valid parameter')
  })

  return result

  async function read(xs, result, root, pre = '') {
    for (let x in xs) {
      if (xs[x] && typeof xs[x] === 'object') {
        await read(xs[x], result[x] = {}, root, x + '-')
      } else {
        const idx = argv.indexOf(toKebab(pre + x))
        if (idx === -1) {
          result[x] = typeof xs[x] === 'function'
            ? xs[x](process.env[toEnv(pre + x)], root, x => read(x, root, root))
            : process.env[toEnv(pre + x)] || xs[x]
          result[x] && typeof result[x].then === 'function' && (result[x] = await result[x])
          setEnv(pre + x, result[x])
        } else {
          const value = argv[idx + 1]
          if (!value || value.startsWith('--'))
            throw new Error('--' + pre + x + ('--' + pre + x in saila ? '/' + saila['--' + pre + x] + '' : '') + ' needs a value')

         argv.splice(idx, 2)
         result[x] = typeof xs[x] === 'function'
            ? await xs[x](value, root, x => read(x, root, root))
            : value
         setEnv(pre + x, result[x])
        }
      }
    }
  }

  function setEnv(x, v) {
    try {
      v = (v || v === 0) && '' + v
      v && (process.env[toEnv(x)] = v)
    } catch {
      process.env[toEnv(x)] = !!v
    }
  }
}
