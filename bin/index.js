#!/usr/bin/env node
import { parseArgs } from 'util'

const shorts = {
  'g': 'generate'
}

const parsed = parseArgs({
  allowPositionals: true,
})
let [cmd, subcmd, ...args] = parsed.positionals

cmd = shorts[cmd] || cmd

const cwd = process.cwd()

if (cmd === 'install') {
  const { generateNewInstall } = await import('./generate/generate-new-install.mjs')
  generateNewInstall({ target: subcmd || cwd })
}
else if (cmd === 'migrate') {
  const env = await import('./+/lib/env')
  const { db } = await import('./+/lib/db')
  const { migrateAppDatabase } = await import('./+/lib/migrations')
  const { schema, tableMeta } = await import('./+/schema')
  await migrateAppDatabase({
    db: db,
    env,
    schema,
    tableMeta,
    targetVersion:
      env.name === 'production'
        ? JSON.parse(fs.readFileSync('package.json', 'utf8')).dbVersion
        : undefined,
  })
  console.log('Done.')
}
else if (cmd === 'generate') {
  const shorts = {
    'm': 'models'
  }
  subcmd = shorts[subcmd] || subcmd

  if (subcmd === 'models') {
    const { generateModels } = await import('./generate/generate-models.mjs')
    console.log("GENERATE MODELS")
    generateModels({ cwd })
  }
  else {
    console.error(`Unknown command (1): ${cmd} ${subcmd}`)
    process.exit(1)
  }
}
else {
  console.error(`Unknown command (2): ${cmd}`)
  process.exit(1)
}
