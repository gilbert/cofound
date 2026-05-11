import path from 'path'
import ESBuild from 'esbuild'
import 'cofound/env'
import { extensionless, getLocal } from '../../bin/shared.js'

export default async function(x = {}) {
  process.env.COFOUND_BUILD = true
  const config = (await import('../../bin/config.js')).default
  const {
    entry = config.entry,
    plugins,
    cwd = process.cwd(),
    esbuild = {},
    tsconfigRaw,
    ...options
  } = x

  return await ESBuild.build({
    entryPoints: [entry],
    bundle: true,
    splitting: true,
    sourcemap: 'external',
    minify: true,
    outdir: options.outputDir || config.outputDir || 'dist',
    format: 'esm',
    tsconfigRaw,
    ...esbuild,
    define: {
      ...esbuild.define,
      ...Object.entries(config.unsafeEnv || {}).reduce(
        (acc, [key, value]) => (acc['import.meta.env.' + key] = JSON.stringify(value), acc),
        {}
      )
    },
    plugins: [
      {
        name: 'cofound',
        setup: x => x.onResolve(
          { filter: /^cofound$/ },
          () => ({ path: path.join(getLocal(), 'src', 'index.js') })
        )
      },
      {
        name: 'cofoundssr',
        setup: x => x.onResolve(
          { filter: /server\// },
          () => ({ external: true })
        )
      },
      {
        name: 'cofoundport',
        setup: x => x.onResolve(
          { filter: /^\// },
          x => ({ path: abs(extensionless(x.path, cwd) || x.path, cwd) })
        )
      },
      ...[].concat(plugins || []).concat(esbuild.plugins || [])
    ]
  })
}

function abs(x, root) {
  return x.indexOf(root) === 0 ? x : path.join(root, x)
}
