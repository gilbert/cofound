# Sessions

Cofound includes a small SQLite-backed session helper for server apps.

```js
import { migrate } from 'cofound/db'
import { HttpSession, SessionModel, sessionSchema } from 'cofound/sessions'

migrate(db, {
  ...sessionSchema,
  users: { cols: { /* app schema */ } },
})

app.post('/login', r => {
  const session = new HttpSession(new SessionModel(db), r, {
    sessionSecret: env.read('SESSION_SECRET'),
  })

  session.create(user.id)
  r.json({ ok: true })
})
```

## Exports

- `sessionSchema` - schema mixin for the `sessions` table.
- `SessionModel` - model for durable user sessions.
- `HttpSession` - request-scoped helper for user and anonymous sessions.
- `normalizeCookieOptions` - converts ergonomic cookie option names into `Set-Cookie` attributes.

## User Sessions

`HttpSession.create(userId)` creates a durable session row and writes a signed-in cookie. `get()` returns the session data plus `user_id`, or `null` when the cookie is missing or the DB session has expired.

```js
const httpSession = new HttpSession(new SessionModel(db), r, {
  userCookieName: 'sid',
  anonCookieName: 'anon',
  sessionSecret: env.read('SESSION_SECRET'),
  secure: env.name === 'production',
})

httpSession.create(user.id)
const session = httpSession.get()
httpSession.patch({ lastSeenAt: Date.now() })
httpSession.clear('user')
```

## Anonymous Sessions

Anonymous session data is stored in a signed cookie. Use this for short pre-login state such as OTP/passkey challenge data.

```js
await httpSession.setAnon({ loginChallenge })
const anon = await httpSession.getAnon()
httpSession.clear('anon')
```

## Cookie Options

`HttpSession` accepts browser-shaped option names such as `httpOnly`, `sameSite`, `maxAge`, `secure`, `domain`, `path`, and `expires`, then normalizes them before calling `r.cookie()`.

`secure: false`, empty `domain`, `null`, and `undefined` are omitted. This avoids malformed `Set-Cookie` headers such as `Secure=false`, which some browsers treat as if `Secure` is enabled.
