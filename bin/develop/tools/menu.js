import s from 'cos?dev'

import api from './api.js'

let top = false
let hover = false

export default s(() => [
  s`
    position fixed
    b 8
    l calc(50% - 26px)
    bc rgba(0 0 0/.05)
    backdrop-filter blur(8)
    p 4
    br 30
    d flex
    ai center
    c white
    pointer-events ${ api.inspect.get(x => x && 'none') }
    animation 1.5s {
      from {
        bc transparent
      }
    }
  `(
    s`
      w 44
      h 44
      br 22
      p 6
      bc rgb(30 30 30/65%)
      bi linear-gradient(-185deg, rgb(211 234 255/.15), rgb(100 180 255/.15) 15%, rgb(255 0 15/.15) 80%, rgb(255 150 0/.15))
      bs 0 1 12 -4 rgb(0 0 0/.35), 0 0 4 -1 rgb(0 0 0/.35)
      animation 0.5s {
        from {
          transform scale(0) rotate(-180)
          o 0
        }
        80% {
          transform scale(1.1)
        }
      }
    `({
      // onmouseenter: () => hover = true,
      dom: x => api.redraw.observe(() => {
        x.animate([
          { transform: 'rotate(0)' },
          { transform: 'rotate(180deg) scale(1.1)' },
          { transform: 'rotate(360deg)' }
        ], { duration: 300, easing: 'ease-out' })
      })
    },
      s.trust`
        <svg viewBox="0 0 480 480" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M279.285 28.0767C317.536 66.3278 317.536 128.345 279.285 166.596L246.57 199.311L198.3 151.041L189.727 159.615C170.2 179.141 170.2 210.799 189.726 230.326L202.641 243.24L155.765 290.116L136.688 271.039C98.4372 232.788 98.4373 170.771 136.688 132.52L260.208 9L279.285 28.0767ZM236.474 277.073L200.712 312.835C162.46 351.086 162.46 413.103 200.711 451.354L219.788 470.431L343.308 346.911C381.559 308.66 381.559 246.643 343.308 208.392L324.231 189.315L280.403 233.143L288.674 241.414C308.2 260.94 308.2 292.599 288.674 312.125L280.1 320.699L236.474 277.073Z" fill="white"/>
        </svg>
      `,
      hover && s`
        position absolute
        t -94
        l -94
        w 240
        h 240
        br 120
        transition .3s transform, background-color 0.3s
        [animate] {
          transform scale(.65)
        }
      `({
        dom: s.animate,
        onmouseleave: () => hover = false,
        deferrable: true
      },
        [
          s.trust`
            <svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 19L10 10M10 10V16.75M10 10H16.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 1H11H13M17 1H17.3889V1C19.3832 1 21 2.61675 21 4.61111V4.61111V5M1 5V4.61111V4.61111C1 2.61675 2.61675 1 4.61111 1V1H5M1 9V11V13M1 17V17.3889V17.3889C1 19.3832 2.61675 21 4.61111 21V21H5M9 21H11H13M21 13V11V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `,
          2,
          s`
            d grid
            pi center
            w 100%
            h 100%
            transform rotate(${ top ? 0 : 180 })
          `(
            s.trust`
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M8.16103 1.63148C8.90972 1.25 9.88982 1.25 11.85 1.25H12.15C14.1102 1.25 15.0903 1.25 15.839 1.63148C16.4975 1.96703 17.033 2.50247 17.3685 3.16103C17.75 3.90972 17.75 4.88982 17.75 6.85V13.15C17.75 15.1102 17.75 16.0903 17.3685 16.839C17.033 17.4975 16.4975 18.033 15.839 18.3685C15.0903 18.75 14.1102 18.75 12.15 18.75H11.85C9.88982 18.75 8.90972 18.75 8.16103 18.3685C7.50247 18.033 6.96703 17.4975 6.63148 16.839C6.25 16.0903 6.25 15.1102 6.25 13.15V6.85C6.25 4.88982 6.25 3.90972 6.63148 3.16103C6.96703 2.50247 7.50247 1.96703 8.16103 1.63148ZM3 21.25C2.58579 21.25 2.25 21.5858 2.25 22C2.25 22.4142 2.58579 22.75 3 22.75H21C21.4142 22.75 21.75 22.4142 21.75 22C21.75 21.5858 21.4142 21.25 21 21.25H3Z" fill="currentColor"/>
              </svg>
            `
          ),
          s.trust`
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M9.56825 1.26915C9.77009 1.42514 9.94817 1.655 10.3043 2.11473L10.7271 2.66048C11.0286 3.0497 11.5078 3.24996 12.0001 3.24996C12.4926 3.24996 12.9718 3.04967 13.2733 2.66039L13.696 2.11479C14.0521 1.65517 14.2301 1.42536 14.4319 1.2694C14.9303 0.884143 15.5812 0.756251 16.1883 0.924246C16.4341 0.992255 16.6859 1.13761 17.1894 1.42831L18.5627 2.22117C19.0644 2.51088 19.3153 2.65573 19.4967 2.83382C19.947 3.2761 20.1621 3.90501 20.077 4.53043C20.0427 4.78226 19.9331 5.05042 19.7138 5.58674L19.7138 5.58677L19.4524 6.22632C19.2658 6.68269 19.3316 7.19671 19.5785 7.62345C19.8251 8.04961 20.2388 8.36648 20.7267 8.43301L21.4105 8.52626C21.9851 8.60461 22.2724 8.64378 22.5078 8.74014C23.0917 8.97914 23.5285 9.47964 23.6865 10.0905C23.7501 10.3367 23.7501 10.6267 23.7501 11.2065V12.7934C23.7501 13.3733 23.7501 13.6632 23.6865 13.9095C23.5285 14.5203 23.0917 15.0208 22.5078 15.2598C22.2724 15.3561 21.9851 15.3953 21.4105 15.4737L21.4105 15.4737L20.7266 15.5669C20.2388 15.6335 19.8251 15.9503 19.5785 16.3765C19.3316 16.8032 19.2658 17.3172 19.4524 17.7735L19.7138 18.4131L19.7139 18.4131C19.9331 18.9494 20.0427 19.2176 20.077 19.4694C20.1621 20.0948 19.947 20.7237 19.4967 21.166C19.3154 21.3441 19.0645 21.489 18.5627 21.7787L18.5627 21.7787L17.1894 22.5716C16.6859 22.8622 16.4342 23.0076 16.1884 23.0756C15.5812 23.2436 14.9303 23.1157 14.4319 22.7304C14.2301 22.5745 14.0521 22.3447 13.6961 21.8851L13.2734 21.3396C12.9718 20.9503 12.4926 20.75 12.0001 20.75C11.5077 20.75 11.0286 20.9502 10.727 21.3395L10.3043 21.8852C9.94815 22.3449 9.77009 22.5747 9.56827 22.7307C9.06986 23.1159 8.41909 23.2438 7.81197 23.0758C7.56614 23.0078 7.31435 22.8624 6.81078 22.5717L6.81076 22.5717L5.43761 21.7789C4.93578 21.4891 4.68486 21.3443 4.50353 21.1662C4.05324 20.7239 3.83814 20.095 3.92325 19.4696C3.95752 19.2178 4.06716 18.9496 4.28643 18.4132L4.54789 17.7736C4.73446 17.3173 4.66867 16.8032 4.42174 16.3765C4.17514 15.9503 3.76144 15.6334 3.27358 15.5669L2.58972 15.4737C2.01515 15.3953 1.72787 15.3561 1.49247 15.2598C0.908589 15.0208 0.471711 14.5203 0.31379 13.9095C0.250122 13.6632 0.250122 13.3733 0.250122 12.7934V11.2065C0.250122 10.6267 0.250122 10.3367 0.313789 10.0905C0.47171 9.47964 0.908589 8.97914 1.49247 8.74014C1.72787 8.64378 2.01515 8.60461 2.58972 8.52626L3.27354 8.43301C3.76142 8.36648 4.17514 8.0496 4.42175 7.62341C4.66869 7.19666 4.73448 6.68261 4.54791 6.22621L4.28645 5.58665C4.06718 5.05026 3.95754 4.78206 3.92326 4.5302C3.83816 3.90481 4.05326 3.27595 4.50354 2.83368C4.68488 2.65557 4.9358 2.5107 5.43764 2.22096L6.81073 1.42821C7.31436 1.13744 7.56618 0.99205 7.81203 0.924039C8.41912 0.756102 9.06985 0.883976 9.56825 1.26915ZM12 15C13.6569 15 15 13.6568 15 12C15 10.3431 13.6569 8.99999 12 8.99999C10.3432 8.99999 9.00004 10.3431 9.00004 12C9.00004 13.6568 10.3432 15 12 15Z" fill="currentColor"/>
            </svg>
          `,
          s`
            bc blue
            w 100%
            h 100%
          `(
            s.trust`
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12ZM10.75 10C10.75 9.30964 11.3096 8.75 12 8.75C12.6904 8.75 13.25 9.30964 13.25 10V10.1213C13.25 10.485 13.1055 10.8338 12.8483 11.091L11.4697 12.4697C11.1768 12.7626 11.1768 13.2374 11.4697 13.5303C11.7626 13.8232 12.2374 13.8232 12.5303 13.5303L13.909 12.1517C14.4475 11.6132 14.75 10.8828 14.75 10.1213V10C14.75 8.48122 13.5188 7.25 12 7.25C10.4812 7.25 9.25 8.48122 9.25 10V10.5C9.25 10.9142 9.58579 11.25 10 11.25C10.4142 11.25 10.75 10.9142 10.75 10.5V10ZM12 14.75C11.3096 14.75 10.75 15.3096 10.75 16C10.75 16.6904 11.3096 17.25 12 17.25C12.6904 17.25 13.25 16.6904 13.25 16C13.25 15.3096 12.6904 14.75 12 14.75Z" fill="currentColor"/>
            </svg>
          `
          )
        ].map((x, i, xs) =>
          s`
            position absolute
            t 102
            l 102
            w 36
            h 36
            br 18
            transform rotate(${
              -120 + (xs.length * 12) + i * (150 / xs.length)
            }) translateY(${
              -(70 + xs.length * 6)
            })
            will-change transform
            transition .3s transform
            [animate=entry] {
              transform rotate(-180) translateY(-80)
            }
            [animate=exit] {
              transform rotate(180) translateY(-80)
            }
          `({
            dom: s.animate
          },
            s`
              d grid
              pi center
              w 36
              h 36
              p 8
              br 18
              transition scale 0.3s
              cursor pointer
              bc rgb(30 30 30/65%)
              transform rotate(${ (xs.length * 12) - i * (150 / xs.length) })
              bi linear-gradient(-185deg, rgb(211 234 255/.15), rgb(100 180 255/.15) 15%, rgb(255 0 15/.15) 80%, rgb(255 150 0/.15))
              bs 0 1 12 -4 rgb(0 0 0/.35), 0 0 4 -1 rgb(0 0 0/.35)
              :hover {
                scale 1.2

                .title {
                  o 1
                }
              }
            `({

            },
              x,
              s`.title
                position absolute
                o 0
                c black
                fs 10
                tt uppercase
                ff system-ui
                fw bold
                ls 2
                transition all 0.3s
                transform rotate(${ -(xs.length * 12) + i * (150 / xs.length) }) translateY(-32)
              `('inspect')
            )
          )
        )
      )
    )
  )
])

/*

const future = s(() => [
  log,
  nav,
  error,
  logs
])

const old = s(() => {
  let top = false
    , logTimer

  const last = { log: s.live(), error: s.live() }
      , logs = []
      , showLog = s.live(0, () => {
        clearInterval(logTimer)
        logTimer = setTimeout(s.redraw, 3010)
      })

  api.log.observe((x) => {
    x.type === 'error'
      ? last.log(x)
      : last.error(x)
    logs.unshift(x)
    showLog(Date.now())
    s.redraw()
  })

  return () => s`
    all initial
    position fixed
    zi 666666
    c white
    b ${ top ? 'initial' : 0 }
    t ${ top ? 0 : 'initial' }
    h 64
    r 0
    l 0
    pointer-events none
    font-family ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace
    fs 12

    transition transform 0.3s
    [animate] {
      transform translateY(${ top ? -100 : 100 })
    }
  `({
    dom: s.animate,
    key: top
  },
    s`.logs
      position absolute
      height min(calc(100vh - 100px), 500px)
      w calc(100% - 40px)
      l 20
      t -500
      br 8
      p 4
      backdrop-filter blur(16)
      bc rgb(30 30 30/75%)
      bi linear-gradient(-180deg, rgb(211 234 255/.15), rgb(100 180 255/.10) 15%, rgb(155 100 215/.05) 80%, rgb(155 150 200/.05))
      bs 0 1 12 -4 rgb(0 0 0/.35), 0 0 4 -1 rgb(0 0 0/.35), inset 0 .5 1 rgb(255 255 255/0.5)
      transform-origin 50% calc(100% + 30px)
      animation .5s {
        from {
          transform scale(0) translateY(-300)
        }
      }
    `(
      s`
        w 100%
        h 100%
        p 8 0
        mask-image linear-gradient(transparent, black 8px, black calc(100% - 8px), transparent)
        mask-size 100%
        mask-position 0 0, 100% 0
        mask-repeat no-repeat
        d flex
        fd column-reverse
        overflow auto
        overscroll-behavior contain
      `(
        logs.map((x, i, xs) =>
          s`
            d flex
            ai center
            gap 6
            m 0 8
            p 4
            h 20
            br 4
            flex-wrap nowrap
            :hover {
              background rgb(255 255 255/.05)
            }
          `(
            s`
              o .5
              fs 10
              min-width 50
              ta right
            `({
              title: new Date(x.timestamp)
            },
              xs[i + 1]
                ? ((x.timestamp - xs[i + 1].timestamp) / 1000).toFixed(3) + 's'
                : 0
            ),
            s`
              fg 1
            `(
              // s`pre`(JSON.stringify(x)),
              x.args.map(x =>
                s`
                  white-space nowrap
                `({
                  title: x.type + (x.subtype ? ' (' + x.subtype + ')' : '')
                },
                  x.value
                    ? x.value
                    : x.description
                    ? x.description.split('\n')[0]
                    : ''
                )
              )
            ),
            s.with(x.stackTrace?.callFrames.find(x =>
              x.url.indexOf('node_modules/') === -1
            ), x =>
              s`
                fs 10
                ta right
                d flex
                overflow hidden
                white-space nowrap
                text-overflow ellipsis
              `(
                false && s``(x.functionName + ' at '),
                s`span
                  flex-shrink 0
                  fg 1
                  border-bottom 1px solid rgba(255,255,255,.3)
                  o 0.65
                  cursor pointer
                  :hover {
                    o 1
                  }
                `({
                  onclick: () => api.editor({
                    file: x.url.slice(location.origin.length),
                    line: (x.lineNumber + 1),
                    column: (x.columnNumber + 1)
                  })
                },
                  x.url.slice(location.origin.length) + ':' + (x.lineNumber + 1)
                )
              )
            )
          )
        )
      )
    ),
    logs.length > 0 &&
    s`.log
      position absolute
      b 18
      r calc(50% + 32px)
      bc rgba(0 0 0/.25)
      bi linear-gradient(rgba(0 0 0/.05), rgba(0 0 0/.1))
      backdrop-filter blur(8)
      h 32
      min-width 32
      br 18
      d grid
      pi center
      ai center
      c white
      p 0 4
      d flex
      fd row-reverse
      transition .3s min-width
      animation .3s {
        from {
          transform translateX(36) scaleX(0)
          o 0
        }
      }
    `(
      s`
        d grid
        pi center
        min-width 24
        flex-shrink 0
        p 0 8
        h 24
        br 12
        fw bold
        bc rgb(30 30 30/65%)
        bi linear-gradient(-185deg, rgb(211 234 255/.15), rgb(100 180 255/.15) 15%, rgb(255 0 15/.15) 80%, rgb(255 150 0/.15))
      `({
        onmouseenter: showLog.set(() => Date.now()),
        onclick: () => showLog(showLog() ? 0 : Date.now())
      }, logs.length),
      logs.length > 0 && s`
        transition .3s max-width
        overflow hidden
        c black
        max-width ${ x => x.scrollWidth + 8 }
        [animate], [closed] {
          max-width 0
          o 0
        }
      `({
        closed: showLog.get(x => Date.now() - x > 3000),
        dom: s.animate,
        key: logs.length
      },
        s`
          d flex
          gap 6
          m 0 8
          flex-wrap no-wrap
        `(
          logs[logs.length - 1].args?.map(x =>
            s`
              white-space nowrap
            `({
              title: x.type
            }, x.value)
          )
        )
      )
    ),
    s`.error
      position absolute
      b 16
      bc rgba(255 0 0/.25)
      bi linear-gradient(rgba(0 0 0/.05), rgba(0 0 0/.1))
      backdrop-filter blur(8)
      w 36
      h 36
      br 30
      d grid
      pi center
      c white
      max-width ${ x => x.scrollWidth }
      transform translateX(${ x => window.innerWidth / 2 + 36 })
      animation .5s {
        from, 70% {
          transform translateX(${ x => window.innerWidth / 2 - 18 })
          o 0
        }
      }
    `(
      '🚨'
    )
  )
})

*/
