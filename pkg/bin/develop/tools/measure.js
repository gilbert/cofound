import s from 'cofound?dev'
import api from './api.js'
import { OKLCHtoHEX, OKLCHtoCSS } from './eyedropper/color.js'

export default s(({ over, x, y }) => {
  let cursor
    , measuring = false

  const scrolling = s.live()
      , xy = s.live([0, 0])
      , rect = s.live({ t: 0, r: 0, b: 0, l: 0 })
      , h = rect.get(({ b, t }) => b - t)
      , w = rect.get(({ r, l }) => r - l)
      , lt = rect.get(({ t }) => y - t - 8)
      , ll = rect.get(({ l }) => x - l - 8)
      , lr = rect.get(({ r }) => r - x - 9)
      , lb = rect.get(({ b }) => b - y - 9)

  s.live.from(x, y, (x, y) => xy([x, y]))
  s.live.from(over, x, y, scrolling, (over, x, y) => {
    if (measuring)
      return

    measuring = true
    requestAnimationFrame(() => {
      measuring = false
      rect({
        t: walk(over, x, y, 0, -1).b + 1,
        r: walk(over, x, y, 1, 0).a,
        b: walk(over, x, y, 0, 1).b,
        l: walk(over, x, y, -1, 0).a + 1
      })
    })
  })

  clearCursor(over())
  function clearCursor(x, prev) {
    cursor = x.style.cursor
    prev && (prev.style.cursor = cursor)
    x.style.cursor = 'none'
  }

  function walk(over, a, b, x, y) {
    let next
    do {
      next = document.elementFromPoint(a = a + x, b = b + y)
    } while (over === next)
    return { a, b: b }
  }

  return () => s`
    position fixed
    zi 2146666666
    t 0
    l 0
    transform translate(${ x }, ${ y })
    pointer-events none
    transition opacity 0.3s
    [animate] {
      opacity 0
    }
  `({
    dom: [
      s.animate,
      () => () => over() && (over().style.cursor = cursor),
      () => over.observe(clearCursor),
      s.on(document, 'copy', e => {
        const x = api.color()
        e.preventDefault()
        e.clipboardData.setData('text/plain', OKLCHtoCSS(x) + ' / ' + OKLCHtoHEX(x))
        api.inspect(false)
      }),
      s.on(window, 'scroll', (e) => {
        scrolling(e)
        over(document.elementFromPoint(x(), y()))
      })
    ]
  },
    s`
      position absolute
      d grid
      pi center
      w 100
      t 0
      l 0
      h 32
      transition transform 0.2s
      transform translate(${
        x.get(x => x > 120 ? -108 : 8)
      }, ${
        xy.get(([x, y]) => y > window.innerHeight - 60 && (x < 120 || x > window.innerWidth - 200)
          ? -78
          : y > 60
          ? -40
          : 8
        )
      })
      fs 12
      p 4 10
      br 16
      bc rgb(0 0 0/.85)
      backdrop-filter blur(5)
      c white
    `(
      w, ' x ', h
    ),

    s`
      position absolute
      d flex
      ai center
      w 180
      gap 8
      h 32
      l 0
      t 0
      transition transform 0.2s
      transform translate(${
        x.get(x => x > window.innerWidth - 200 ? -188 : 8)
      }, ${
        xy.get(([x, y]) => y < 60
          ? (x <= 120 || x > window.innerWidth - 200 ? 48 : 8)
          : y > window.innerHeight - 60
          ? -40
          : (x <= 120 || x > window.innerWidth - 200 ? 8 : -40)
        )
      })
      fs 12
      p 6 8 6 6
      br 16
      bc rgb(0 0 0/.85)
      backdrop-filter blur(5)
      c white
      white-space pre
    `(
      s`
        flex-shrink 0
        w 20
        h 20
        br 13
        bs 0 0 0 1 rgb(255 255 255/.5)
        transition background-color .1s
        bc ${ api.color.get(OKLCHtoCSS) }
      `,
      s`pre`(
        api.color.get(([l, c, h]) =>
          (l * 100).toFixed(1) + '% ' + c.toFixed(3) + ' ' + h.toFixed(1)
        )
      )
    ),
    [lr, lb, ll, lt].map((x, i) => [
      s`
        position absolute
        w ${ x }
        h 1
        l 0
        t 0
        transform-origin .5px .5px
        transform rotate(${ i * 90 }) translate(8)
        backdrop-filter invert(1) grayscale(1) brightness(2)
        animation .3s .3s {
          from { scale 0 }
        }
      `,
      s`
        position absolute
        w 1
        h 7
        t -3
        l 0
        transform rotate(${ i * 90 }) translateX(calc(8px + ${ x }))
        backdrop-filter invert(1) grayscale(1) brightness(2)
        animation .3s .3s {
          from { scale 0 }
        }
      `
    ])
  )
})
