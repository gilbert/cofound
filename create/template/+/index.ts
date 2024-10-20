import { SinRouter } from 'cofound/backend'

import { checkMigrationStatus } from './lib/app-runtime'
import { env } from './lib/env'
import { makeRpcRouter } from './lib/rpc-router'

export default async function (app: SinRouter) {
  if (env.name === 'development') {
    checkMigrationStatus()
  }
  app.all('/rpc/*', makeRpcRouter())
}
