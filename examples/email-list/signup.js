import s from 'cos'

let name = ''
let email = ''
let submitted = false

export default function SignupForm({}, [], { route }) {
  async function onsubmit(e) {
    e.preventDefault()
    e.redraw = false
    await s.http.post('/api/subscribers', { body: { name, email } })
    name = ''
    email = ''
    submitted = true
    s.redraw()
  }

  if (submitted) {
    return s`text-align center; p 40px 0`(
      s`h2 c #16a34a`('You\'re signed up!'),
      s`p c #666 mt 8px`('Thanks for subscribing.'),
      s`button
        mt 16px
        p 8px 20px
        bc #f8f9fa
        border 1px solid #dee2e6
        border-radius 4px
        cursor pointer
        font-size 14px
        &:hover { bc #e9ecef }
      `({ onclick: () => { submitted = false; s.redraw() } }, 'Sign up another')
    )
  }

  return s`max-width 400px; m 0 auto`(
    s`h2 mb 4px`('Subscribe'),
    s`p c #666 mb 20px font-size 15px`('Join our email list.'),
    s`form`({ onsubmit },
      s`div mb 12px`(
        s`label d block mb 4px font-size 14px font-weight 500`('Name'),
        s`input
          d block
          w 100%
          p 8px 10px
          border 1px solid #ccc
          border-radius 4px
          font-size 14px
          box-sizing border-box
        `({
          type: 'text',
          value: name,
          oninput: e => { name = e.target.value; e.redraw = false }
        })
      ),
      s`div mb 12px`(
        s`label d block mb 4px font-size 14px font-weight 500`('Email'),
        s`input
          d block
          w 100%
          p 8px 10px
          border 1px solid #ccc
          border-radius 4px
          font-size 14px
          box-sizing border-box
        `({
          type: 'email',
          value: email,
          required: true,
          oninput: e => { email = e.target.value; e.redraw = false }
        })
      ),
      s`button
        w 100%
        p 10px
        bc #2563eb
        c white
        border none
        border-radius 4px
        font-size 15px
        cursor pointer
        &:hover { bc #1d4ed8 }
      `({ type: 'submit' }, 'Subscribe')
    )
  )
}
