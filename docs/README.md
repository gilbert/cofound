# Cofound

Cofound (cofound) is a lightweight, reactive JavaScript framework for building dynamic, performant web applications. It uses a declarative, component-based approach — if you understand HTML, CSS, and JavaScript, you'll understand cofound.

## Project Structure

```
├── +server/      # Server-side code
│   └── index.js  # Server routes
├── +public/      # Static pass-through files
├── index.js      # Client-side entry point
├── package.json  # Package manifest
└── docs/         # Framework documentation
```

## Getting Started

Create a new project with npm:

```bash
npx cofound create my-cofound-app
cd my-cofound-app
npm install
```

Start development (launches dev server with hot reload):

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run the production server:

```bash
npm run start
```

## How It Works

### Client

The client entry point (`index.js`) imports `s` from `cofound` and uses `s.mount()` to render the application:

```js
import s from 'cofound'

s.mount(() =>
  s`h1`('Welcome to cofound')
)
```

Components are the building blocks — they can be [styled](frontend/components.md#styled-component), [stateless](frontend/components.md#stateless-component), [stateful](frontend/components.md#stateful-component), or [async](frontend/components.md#async-component). See the [components guide](frontend/components.md).

### Server

The server entry point (`+server/index.js`) exports a default function that receives the `app` object for defining routes:

```js
export default async function(app) {
  app.get('/api/hello', r => {
    r.json({ hello: 'world' })
  })
}
```

See the [server routes guide](server/routes.md).

## Documentation

- **Frontend**
  - [Components](frontend/components.md) — Elements, styled/stateless/stateful/async components, DAFT, mounting
  - [CSS](frontend/css.md) — Styling, resets, units, variables, interpolation, aliases, shorthands
  - [Context](frontend/context.md) — Document helpers, routing context, lifecycle hooks, redraw controls
  - [Routing](frontend/routing.md) — Matching, nested routing, query params, navigation options
  - [Live](frontend/live.md) — Live stream setters, observers, derived streams, redraw behavior
  - [Window History State](frontend/window-history-state.md) — Route state, replace, scroll restoration
  - [HTTP](frontend/http.md) — `s.http` request methods and options
  - [DOM Helpers](frontend/dom-helpers.md) — `s.is`, `s.on`, `s.event`, `s.animate`, `p`, `s.trust`
- **Server**
  - [Routes](server/routes.md) — `app.get/post/patch/delete`, request/response API
  - [Request Object](server/request-object.md) — `r.body`, `r.readable`, `r.writable`, `r.file`, headers, cookies, lifecycle
  - [Schema & Migrations](server/schema.md) — the `col` builder, auto-migration, indexes, JSON columns, backfills
  - [Jobs](server/jobs.md) — SQLite-backed background jobs, retries, recovery
  - [Sessions](server/sessions.md) — SQLite-backed user sessions and signed anonymous cookies
- [CLI](cli.md) — Project scripts, underlying commands, testing framework
- [Environment Variables](environment-variables.md) — `.env`, the `package.json` `"env"` contract, precedence
- [Deploying to Production](DEPLOYING_TO_PRODUCTION.md) — Static, server, and hybrid deployment strategies
- [Tips & Gotchas](tips.md) — Common pitfalls and best practices
