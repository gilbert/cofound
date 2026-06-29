import process from 'node:process'
import { createRequire } from 'node:module'
import { P3toOKLCH, sRGBtoOKLCH } from './color.js'

const eyeDropper = process.platform === 'darwin'
  && process.arch === 'arm64'
  && createRequire(import.meta.url)('./eyedropper.node')

export default function(fn) {
  let color

  const timer = setInterval(fetch, 50)
  fetch()

  return () => clearInterval(timer)

  function fetch() {
    const x = eyeDropper ? eyeDropper() : [0, 0, 0]

    if (color && color[0] === x[0] && color[1] === x[1] && color[2] === x[2])
      return

    color = x
    const xs = x.map(x => x / 255)
    fn(x[3] ? P3toOKLCH(xs) : sRGBtoOKLCH(xs))
  }
}
