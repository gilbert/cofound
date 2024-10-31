import { ok } from 'cofound/result'
import fs from 'fs/promises'

import { rpc, z } from '../lib/rpc-context'

export const public_rpc_getAppVersion = rpc(z.object({}), async function execute() {
  // Read from git and spit out current commit hash
  const version = await fs.readFile('.git/HEAD', 'utf-8')
  const ref = version.split(':')[1]!.trim()
  const commit = await fs.readFile(`.git/${ref}`, 'utf-8')
  return ok(commit.trim())
})
