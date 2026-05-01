import s from 'cos?dev'
import api from './api.js'
import userland, { stackTrace } from './userland.js'
import measure from './measure.js'

const over = s.live(document.body)
const x = s.live(0)
const y = s.live(0)
const scrolling = s.live(false, () => setTimeout(() => scrolling(false), 100))
const rect = s.live.from(api.inspect, over, scrolling, (show, over) => {
  return show && (over === document.documentElement || over === document.body
    ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    : over.getBoundingClientRect()
  )
})

api.inspect.observe(x => {
  x
    ? window[stackTrace] = true
    : delete window[stackTrace]

  userland.redraw()
})

window.addEventListener('mouseover', mouseover, { capture: true, passive: true })
window.addEventListener('mousemove', mousemove, { capture: true, passive: true })
window.addEventListener('keydown', keydown, { capture: true, passive: false })
window.addEventListener('scroll', scrolling, { capture: true, passive: true })

export default rect.get(r => r &&
  s`
    position fixed
    z-index 2146666665
    pointer-events none
    l 0
    b 0
    r 0
    t 0
    transition opacity .3s
    [animate] {
      o 0
    }
  `({
    dom: [
      s.animate,
      s.on(window, 'click', click, { capture: true }),
      s.on(window, 'blur', api.inspect.set(() => false), { capture: true })
    ]
  },
    measure({ over, x, y }),
    s`span
      ff monospace
      fs 10
      zi 1
      p 2 4
      bc white
      position absolute
      white-space nowrap
      br 3
      bs 0 0 3px rgba(0,0,0,.5)
      t ${ r.bottom + 8 }
      l ${ r.left }
      animation 0.3s {
        from { o 0 }
      }
    `(
      Math.round(r.left) + ',' + Math.round(r.top) + ' <' +
      over().tagName.toLowerCase() + '> ' + Math.round(r.width) + 'x' + Math.round(r.height)
    ),
    s`svg
      position absolute
      top 0
      left 0
    `({
      width: '100%',
      height: '100%'
    },
      s`defs`(
        s`mask#hole`(
          s`rect`({
            width: '100%',
            height: '100%',
            fill: 'white'
          }),
          s`rect
            transition all ${ scrolling.get(x => x ? 0 : '.3s') }
          `({
            fill: 'black',
            rx: 4,
            ry: 4,
            width: r.width,
            height: r.height,
            x: r.left,
            y: r.top
          })
        )
      ),
      s`rect`({
        fill: 'rgba(0, 150, 255, 0.5)',
        width: '100%',
        height: '100%',
        mask: 'url(#hole)'
      })
    )
  )
)

function click(e) {
  e.preventDefault()
  e.stopPropagation()

  let dom = e.target
  while (dom) {
    if (dom.hasOwnProperty(stackTrace)) {
      const parsed = api.parseStackTrace(dom[stackTrace])
      const x = parsed[3] || parsed.pop()
      if (x)
        return api.editor(x)
    }

    dom = dom.parentNode
  }
}

function keydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
    e.preventDefault()
    e.stopPropagation()
    window.hasOwnProperty(stackTrace)
      ? api.inspect(false)
      : api.inspect(true)
  } else if (api.inspect() && e.key === 'Escape') {
    api.inspect(false)
  }
}

function mouseover(e) {
  window.costools && window.costools.contains(e.target) || over(e.target)
}

function mousemove(e) {
  window.costools && window.costools.contains(e.target) || (
    x(e.clientX),
    y(e.clientY)
  )
}
