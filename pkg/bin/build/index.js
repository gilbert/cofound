import '../env.js'
import config from '../config.js'
import build from 'cofound/build'

await build({
  ...config,
  esbuild: {
    ...config.esbuild,
    ...esbuildParse(config.__)
  }
})

console.log('🔥 Built in', performance.now()) // eslint-disable-line

function esbuildParse(argv) {
  const x = {}
  let last
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      last && (x[last] = true)
      const eq = arg.indexOf('=')
      last = arg.slice(2, eq > -1 ? eq : arg.length).replace(/-./g, x => x.slice(1).toUpperCase())
      if (eq > -1) {
        x[last] = arg.slice(eq + 1)
        last = ''
      }
    } else {
      last && (x[last] = arg)
      last = ''
    }
  }
  last && (x[last] = true)
  return x
}
