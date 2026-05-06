import s from 'cos'
import Sheet from './sheet.js'
import SignupForm from './signup.js'

s.mount(({}, [], { route }) =>
  s`max-width 720px; m 40px auto; font-family system-ui, sans-serif`(
    s`nav d flex gap 16px mb 20px font-size 14px`(
      s`a`({ href: '/' }, 'Signup'),
      s`a`({ href: '/admin' }, 'Admin')
    ),
    route({
      '/': SignupForm,
      '/admin': () => Sheet('/api', 'subscribers'),
    })
  )
)
