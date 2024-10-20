import { migrateAppDatabase } from 'cofound/backend'
import fs from 'fs'

import { db } from '../+/lib/db'
import { env } from '../+/lib/env'
import { schema } from '../+/schema'

migrateAppDatabase({
  db,
  env,
  schema,
  targetVersion:
    process.env.NODE_ENV === 'production'
      ? JSON.parse(fs.readFileSync('package.json', 'utf8')).dbVersion
      : undefined,
})
console.log('Done.')
