import s from 'cos'

s.mount(() => {
  const count = s.live(0)

  return () => s`
    max-width 480px
    m 40px auto
    font-family system-ui, sans-serif
    text-align center
  `(
    s`h1 mb 16px`('My Cos App'),
    s`p font-size 48px; mb 16px`(count()),
    s`button
      p 8px 16px
      bc #2563eb
      c white
      border none
      border-radius 4px
      cursor pointer
      font-size 16px
    `({ onclick: () => count(count() + 1) }, 'Count')
  )
})
