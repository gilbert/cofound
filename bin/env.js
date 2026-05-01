import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

Object.assign(process.env, load(path.join(process.cwd(), '.env'), true))

export default function load(x = path.join(process.cwd(), '.env'), parents = false) {
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
