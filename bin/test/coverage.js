import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { rewrite } from '../develop/shared.js'
import config from '../config.js'

const p = console.log // eslint-disable-line

function resolve(x) {
  return x.startsWith('file:///')
    ? fileURLToPath(x)
    : x.startsWith(config.origin)
    ? path.join(config.cwd, x.replace(config.origin, ''))
    : null
}

function ignore(x) {
  return x.includes('node_modules/')
}

export default async function(scripts) {
  let totalSeen = 0
  let totalCovered = 0

  await Promise.all(scripts.flatMap(async script => {
    const filePath = resolve(script.url)
    if (!filePath || ignore(filePath))
      return []

    const file = path.resolve(filePath)
    const code = rewrite(fs.readFileSync(file, 'utf8'), file)
    let seen = 0
    let covered = 0
    for (const fn of script.functions) {
      for (const range of fn.ranges) {
        if (code.slice(range.endOffset, code.indexOf('\n', range.endOffset)).match(/\/{2}[\t ]*sinning/))
          continue

        seen += totalSeen += range.endOffset - range.startOffset
        if (range.count > 0) {
          covered += totalCovered += range.endOffset - range.startOffset
          continue
        }

        const lines = (code.slice(0, range.startOffset).match(/\n/g) || []).length + 1
        const last = code.slice(0, range.startOffset).lastIndexOf('\n')
        // p(fn.functionName + ' @ ' + './tests/index.js:' + lines +  ':' + (range.startOffset - last))
        // p(code.slice(range.startOffset, range.endOffset))
      }
    }

    p(file, config.origin, seen, covered, covered / seen * 100)

  }))

  return totalCovered
    ? (totalCovered / totalSeen * 100).toFixed(2) + '%'
    : '0%'
}
