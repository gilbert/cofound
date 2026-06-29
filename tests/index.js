// @ts-nocheck
import s from 'cofound'
import t from 'cofound/test'

const $ = window.document.querySelector.bind(window.document)
const w = window
const d = w.document
const b = d.body

function xStyle() {
  return w.getComputedStyle(w.x)
}

t`CSS`(

  t`Variables`(

    t`Defining`(() => {
      s.mount(() => s`#x
        --a 1
        $b 2
        --1 3
        $2 4
      `)
      return ['1234',
        xStyle().getPropertyValue('--a') +
        xStyle().getPropertyValue('--b') +
        xStyle().getPropertyValue('--1') +
        xStyle().getPropertyValue('--2')
      ]
    }),

    t`Using`(() => {
      s.mount(() => s`#x
        --a 1
        $b 2
        --1 3
        $2 4
        --a1 5
        $a2 6
        --1a 7
        $2a 8
        w calc((var(--a) + $a + var(--b) + $b + var(--1) + $1 + var(--2) + $2 + var(--a1) + $a1 + var(--a2) + $a2 + var(--1a) + $1a + var(--2a) + $2a) * 1px)
      `({}))
      return ['72px', xStyle().width]
    }),

    t`$ characters`(() => {
      s.mount(() => s`#x
        $with-dash 200px
        width $with-dash
      `)
      return ['200px', xStyle().width]
    }),

    t`Color /opacity`(() => {
      s.mount(() => s`#x $blue oklab(.5 .5 .5);c $blue/.3`)
      return ['oklab(0.5 0.5 0.5 / 0.3)', xStyle().color]
    }),

    t`Color /opacity %`(() => {
      s.mount(() => s`#x $blue oklab(.5 .5 .5);c $blue/30%`)
      return ['oklab(0.5 0.5 0.5 / 0.3)', xStyle().color]
    }),

    t`Dynamic Color /opacity`(() => {
      s.mount(() => s`#x $blue oklab(.5 .5 .5);c $blue/${ .3 }`)
      return ['oklab(0.5 0.5 0.5 / 0.3)', xStyle().color]
    }),

    t`Dynamic Color /opacity %`(() => {
      s.mount(() => s`#x $blue oklab(.5 .5 .5);c $blue/${ '30%' }`)
      return ['oklab(0.5 0.5 0.5 / 0.3)', xStyle().color]
    }),

    t`Multiple Dynamic Color /opacity`(() => {
      s.css`:root{$blue blue}`
      s.mount(() => [
        s`h1`('Quick color demo'),
        [1, 2, 3, 4].map(x =>
          s`
            bc $blue/${ 1 / x }`('yolo')
        )
      ])
      return [1, 1]
    })

  ),

  t`Shorthands`(

    t`$() for calc()`(() => {
      s.mount(() => s`#x
        bc blue
        w $(3 * 4px)
      `())
      return ['12px', xStyle().width]
    }),

    t`$() for calc() with parameter`(() => {
      s.mount(() => s`#x
        bc blue
        w $(${ 3 } * 4px)
      `())
      return ['12px', xStyle().width]
    }),

    t`/ in calc()`(() => {
      s.mount(() => s`#x
        bc blue
        w $(200px / 2)
      `())
      return ['100px', xStyle().width]
    }),

    t`dynamic custom units with / in calc()`(() => {
      s.css.unit('n', x => x * 10 + 'px')
      s.mount(() => s`#x
        bc blue
        w $(${ '20n' } / 2)
      `())
      return ['100px', xStyle().width]
    }),

    t`Nested @keyframes`(() => {
      s.mount(() =>
        s`
          p {
            animation 1s infinite {
              from { transform rotate(360) }
            }
          }
        `(
          s`p#x`('animating')
        )
      )
      return [1, w.x.getAnimations().length]
    })

  ),

  t`implicit units`({
    run(test) {
      const [a, el, prop] = test()
      s.mount(() => el)
      return [a, w.getComputedStyle(b.firstElementChild)[prop]]
    }
  },
    t`px`(() => ['1px', s` w 1`, 'width']),
    t`transform deg`(() => ['matrix(1, 0, 0, 1, 0, 0)', s` transform rotate(360)`, 'transform']),
    t`rotate deg`(() => ['360deg', s` rotate 360`, 'rotate']),
    t`translate px`(() => ['1px', s` translate 1`, 'translate']),
    t`translate two px`(() => ['1px 1px', s` translate 1 1`, 'translate'])
  ),

  t`Scoping with &`(() => {
    s.mount(() =>
      s`#x.bar
        &.first, &.bar { c rgb(1 1 1) }
      `('red')
    )
    return ['rgb(1, 1, 1)', xStyle().color]
  }),

  t`Custom units`(
    t`Simple`(() => {
      s.css.unit('n', x => x * 4 + 'px')
      s.mount(() => s`#x w 4n`)
      return ['16px', xStyle().width]
    }),

    t`Dynamic`(() => {
      s.css.unit('n', x => x * 10 + 'px')
      s.mount(() => s`#x w ${ '4n' }`)
      return ['40px', xStyle().width]
    }),

    t`Dynamic Multiple`(() => {
      s.css.unit('n', x => x * 10 + 'px')
      s.mount(() => s`#x $b blue;c $b/0.5;h ${ '4n' }`)
      return ['40px', xStyle().height]
    }),

    t`In calc()`(() => {
      s.css.unit('n', x => x * 10 + 'px')
      s.mount(() => s`#x w $(4 * 4n)`)
      return ['160px', xStyle().width]
    })
  )

)

t`Rendering`(

  t`Force redraw works`(() => {
    let redraws = 0
    s.mount(() => redraws++)
    s.redraw.force()
    return [2, redraws]
  }),

  t`Redraw does not leak`(async() => {
    let redraws = 0
    s.mount(() => redraws++)
    s.redraw()
    s.redraw.force()
    await new Promise(requestAnimationFrame)
    return [2, redraws]
  }),

  t`Mounts and makes correct element tag`(() => {
    s.mount(() => s`h1`)
    return [
      'H1',
      document.body.firstChild.tagName
    ]
  }),

  t`No unnecesarry attrs`(() => {
    s.mount(() => s``('Hello'))
    return [
      '',
      $('body>*').getAttributeNames().join(',')
    ]
  }),

  t`Has correct child content`(() => {
    s.mount(() => s``('Hello'))
    return [
      'Hello',
      document.body.firstChild.textContent
    ]
  }),

  t`Sets attributes`(() => {
    s.mount(() => s`h1`({ title: 'Hello' }))
    return [
      'Hello',
      document.body.firstChild.title
    ]
  }),

  t`Keyed diffing changes correctly`(() => {
    const xs = [
      'bcd',
      'bcd',
      'abcd',
      'dcba',
      'abcd',
      'abcdef',
      'abcghidef',
      'abcghide',
      'cghide',
      'cgde',
      '',
      'abcdef',
      'abgidef',
      'abcdef',
      'jgabcdefhi',
      'abcdef',
      'agcdhi',
      'igadhc',
      'chdagi',
      'dfg',
      'abcdfg',
      'abcdefg',
      'gfedcba',
      'fdbaeg',
      'abcdef',
      'abcdefhij',
      'abcdehfij',
      'abidehfcj',
      'abcdefhij',
      'abcdefghijk',
      'ghi',
      'abcd',
      'bcad',
      'abcde',
      'dabcf',
      'ade',
      'df',
      'bdck',
      'ckbd',
      '',
      'abcd',
      'abdec',
      'abc',
      'cab',
      'bcd'
    ]

    let i = 0
    s.mount(() => s`#x`(
      xs[i].split('').map(key => s`div`({ key, id: key }, key))
    ))

    for (; i < xs.length; i++) {
      s.redraw.force()
      if (xs[i] !== w.x.textContent)
        return [xs[i], w.x.textContent] // sinning
    }

    return [1, 1]
  }),

  t`s.trust`({
    run(test) {
      const [a, b] = test()
      s.mount(() =>
        s``({
          dom: x => {
            const h = x.innerHTML
            t.is(a, h.slice(h.indexOf('>') + 1, h.lastIndexOf('<')))
          }
        },
          b
        )
      )
    }
  },
    t`tagged`(
      t`single`(() => ['<h1>yo</h1>', s.trust`<h1>yo</h1>`]),
      t`multiple`(() => ['<h1>yo</h1><h2>no</h2>', s.trust`<h1>yo</h1><h2>no</h2>`])
    ),
    t`string`(
      t`single`(() => ['<h1>yo</h1>', s.trust('<h1>yo</h1>')]),
      t`multiple`(() => ['<h1>yo</h1><h2>no</h2>', s.trust('<h1>yo</h1><h2>no</h2>')])
    ),
    t`array`(() => [
      '<h1>yo</h1><h2>no</h2>',
      s.trust(['<h1>yo</h1>', '<h2>no</h2>'])
    ])
  )
)

t`Components`(

  t`onremove`(

    t`simple`(() => {
      let called = 0
        , show = true

      s.mount(() =>
        show && s(({}, [], { onremove }) => {
          onremove(() => called++)
          return () => s``('Hej')
        })
      )

      show = false
      s.redraw.force()

      return [
        1,
        called
      ]
    }),

    t`simple in array`(() => {
      let called = 0
        , show = true

      s.mount(() => [
        show && s(({}, [], { onremove }) => {
          onremove(() => called++)
          return () => s``('Hej')
        })
      ])

      show = false
      s.redraw.force()

      return [
        1,
        called
      ]
    }),

    t`nested`(() => {
      let called = 0
        , show = true

      s.mount(() => [
        show && s``(
          s(({}, [], { onremove }) => {
            onremove(() => called++)
            return () => s``('Hej')
          })
        )
      ])

      show = false
      s.redraw.force()

      return [
        1,
        called
      ]
    }),

    t`with no children`(() => {
      let called = 0
        , show = true

      s.mount(() => [
        show && s(({}, [], { onremove }) => {
          onremove(() => called++)
          return () => false
        })
      ])

      show = false
      s.redraw.force()

      return [
        1,
        called
      ]
    }),

    t`nested with no children`(() => {
      let called = 0
        , show = true

      s.mount(() => [
        show && s``(
          s(({}, [], { onremove }) => {
            onremove(() => called++)
            return () => []
          })
        )
      ])

      show = false
      s.redraw.force()

      return [
        1,
        called
      ]
    }),

    t`in nested component`(() => {
      let called = 0
      let open = true
      s.mount(() =>
        s(() => {
          return () => open && s(({}, [], { onremove }) => {
            onremove(() => called++)
            return () => 'hej'
          })
        })
      )

      open = false
      s.redraw.force()

      return [1, called]
    })
  )
)

t`Routing`(
  t`Basics`(() => {
    s.mount(({ }, [], { route }) =>
      () => route({
        '/': () => s`#x`('/'),
        '/named': () => s`#x`('/named'),
        '/named/:id': ({ id }) => s`#x`('/named/' + id),
        '?': () => s`#x`('notfound')
      })
    )

    for (const x of ['/', '/named', '/named/hello', 'notfound']) {
      s.route(x)
      s.redraw.force()
      t.is(x, w.x?.textContent)
    }
  }),

  t`Nested`(() => {
    s.mount(({ }, [], { route }) => {
      return () => route({
        '/': () => s`#x`('/'),
        '/*': ({ }, [], { route }) => route({
          '/?': () => s`#x`('notfound'),
          '/rootsub': () => s`#x`('/rootsub')
        }),
        '/sub': ({ }, [], { route }) => route({
          '/': () => s`#x`('/sub'),
          '/subsub': () => s`#x`('/sub/subsub')
        })
      })
    })

    for (const x of ['/', 'notfound', '/sub', '/sub/subsub']) {
      s.route(x)
      s.redraw.force()
      t.is(x, w.x?.textContent)
    }
  }),

  t`Nested wildcard`(() => {
    s.mount(({ }, [], { route }) => [
      route({
        '/': () => s`#x`('/'),
        '/d': s(({ }, [], { route }) => {
          return () => route({
            '/': () => s`#x`('/d'),
            '/*': window.haha = function yo({}, [], { route }) {
              return route({
                '/wat': () => s`#x`('/d/wat')
              })
            }
          })
        })
      })
    ])

    for (const x of ['/', '/d', '/d/wat']) {
      s.route(x)
      s.redraw.force()
      t.is(x, w.x?.textContent)
    }
  }),

  t`Prevent redraw when clicking anchor`(async() => {
    let redraws = 0
    s.mount(() => {
      return () => {
        redraws++
        return s`a`({ href: '/wat', redraw: false }, 'Wat')
      }
    })
    const anchor = document.querySelector('a[href="/wat"]')
    t.is(1, redraws)
    await s.sleep(1)
    let redrawsSnapshot = redraws
    anchor.click()
    await s.sleep(1)
    t.is(redrawsSnapshot, redraws)
  }),

  t`Prevent redraw when calling s.route`(async() => {
    let redraws = 0
    s.mount(() => redraws++)
    const anchor = document.querySelector('button')
    t.is(1, redraws)
    await new Promise(requestAnimationFrame)
    let redrawsSnapshot = redraws
    s.route('/route' + Date.now(), { redraw: false })
    await new Promise(requestAnimationFrame)
    t.is(redrawsSnapshot, redraws)
  })

)
