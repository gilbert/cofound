import mimes from '../shared/server/mimes.js'
import window from './window.js'
import { voidTags } from './shared.js'

import s from '../src/index.js'

const noscript = process.env.COS_NOSCRIPT

s.is = { server: s.isServer = window.isServerCos = true }
s.title = process.env.COS_TITLE
s.mimes = mimes
s.trust = trust

export default s

function trust(strings, ...values) {
  const html = String.raw({ raw: Array.isArray(strings.raw) ? strings.raw : [strings] }, ...values)
      , count = rootNodeCount(html) + 1

  return new window.Node(
      (noscript ? '' : '<!--[' + count + '-->')
    + html.trim()
    + (noscript ? '' : '<!--trust-->')
  )
}

function rootNodeCount(x) {
  let char = -1
    , last = -1
    , start = -1
    , end = -1
    , count = 0
    , depth = 0

  for (let i = 0; i < x.length; i++) {
    char = x.charCodeAt(i)
    if (char === 60) { // <
      start = i + 1
    } else if (char === 62) { // >
      if (end >= 0) {
        --depth || count++
        end = -1
      } else if (start >= 0) {
        last === 47 || voidTags.has(x.slice(start, i).toLowerCase()) // /
          ? depth === 0 && count++
          : depth++
        start = -1
      }
    } else if (char === 47) { // /
      start === i && (start = -1, end = i + 1)
    }
    last = char
  }
  return count
}
