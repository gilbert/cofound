import fs from 'node:fs'
import path from 'node:path'

import config from '../develop/config.js'
import c from '../color.js'

const xs = config.all
  ? fs.readdirSync(config.projectsDir)
  : [path.basename(config.project)]

for (const x of xs) {
  process.stdout.write('Clear ' + x + ' ' + c.dim('(' + path.join(config.projectsDir, x) + ')') + ' ...\n')
  fs.rmSync(path.join(config.projectsDir, x), { recursive: true, force: true })
  process.stdout.write('Done\n')
}
