import api from './api.js'

import s from 'cofound'

import { stackTrace } from '/node_modules/cofound/src/shared.js'

export default s

export { stackTrace }

api.redraw.observe(() => window.cofounddevhmr ? s.redraw() : location.reload())

const unquoteFilename = window.cofounddev.platform === 'win32'
  ? /"([^<>:"/\\|?*]+)":/ig
  : /"([^\0/]+)":/ig

s.error = s((error) => {
  setTimeout(() => { throw error }) // eslint-disable-line
  const stack = api.parseStackTrace(error.stack || '')
      , attrs = typeof error === 'object' && JSON.stringify(error, null, 2).replace(unquoteFilename, '$1:')

  return () => {
    return s`pre
      all initial
      d block
      ws pre-wrap
      m 0
      c white
      bc #ff0033
      p 8 12
      br 6;
      overflow auto
    `(
      s`code`(
        '' + error,
        stack.map(({ name, file, line, column }) =>
          s`div
            c #ccc
          `(
            '    at ',
            name && (name + ' '),
            s`span
              :hover { c white }
              td underline
              cursor pointer
            `({
              onclick: (e) => {
                e.redraw = false
                api.editor({ file, line, column })
              }
            },
              file + ':' + line + ':' + column
            )
          )
        ),
        attrs !== '{}' && attrs
      )
    )
  }
})
