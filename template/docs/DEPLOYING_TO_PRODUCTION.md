# Deploying to Production

A Cofound app is a single codebase — a client app (`index.js`) and an optional server (`+server/`). How you *serve* it in production is a separate choice, and the pieces compose. There are two build/run commands:

- **`cofound generate`** — pre-render routes to static HTML + assets in `dist/`.
- **`cofound start`** — run the production Node server.

These are **not** mutually exclusive. The running server serves the `generate` output as its first layer and falls back to live rendering for everything else, so the interesting setup is usually a hybrid. This guide covers all three strategies. Both commands are wired into your project as npm scripts by `cofound create` (`npm run generate`, `npm run start`), and both require **Node.js 20.11+** on the build/host machine.

## How serving actually works

Before the strategies, the one mental model that explains them. A default `cofound start` registers route handlers in order (`pkg/bin/start/serve.js`):

1. **Static files from `dist/`** — the exact output of `cofound generate`.
2. **Static files from `+public/`** — your pass-through assets.
3. **Live SSR (`render`)** — a catch-all that server-renders any route not matched above and injects the client app (`<script src="/index.js">`).

So pre-rendering is an **optimization layer the server consumes**, not a separate kind of app. A route you pre-generated is served as a static file; anything else is rendered on demand. Either way, the same client `index.js` hydrates the page and takes over client-side routing after first load.

There is no per-route "static vs dynamic" flag. Every route is simultaneously server-renderable and client-navigable — "static" only means "rendered ahead of time into `dist/`."

---

## Strategy 1 — Pure static (no server)

```sh
npm run generate     # → writes a static site to ./dist
```

Best for sites where every page can be rendered ahead of time and there's no per-request backend: marketing sites, docs, blogs, landing pages. Deploy `dist/` to any static host or CDN — Netlify, Cloudflare Pages, GitHub Pages, S3 + CloudFront, nginx.

```sh
npm run generate
#   netlify deploy --prod --dir=dist
#   aws s3 sync dist s3://my-bucket --delete
```

### What `generate` produces

Output goes to `dist/` (the `outputDir`). Into it, `generate`:

1. **Bundles the client JS once** by running `cofound build` as a sub-step — a single `index.js` that every page references via one injected `<script>`. (Skipped with `--noscript`.)
2. **Copies `+public/`** wholesale — images, fonts, favicon, etc.
3. **Pre-renders one `index.html` per route**, with CSS inlined into each page's `<head>` so the page is self-contained. Routes are written to `<route>/index.html` for clean URLs.

### How "every page" is discovered

There is no route manifest. `generate` starts at `/` and **crawls your own link graph**: while rendering a page, every internal `<a href="…">` it emits is collected, then each of those routes is rendered in turn. A visited-set dedupes, so cyclic links terminate.

> ⚠️ **On a pure static host, this is the catch.** A route is only exported if some rendered page links to it with a real `<a href>`. Pages reachable *only* through JavaScript navigation — and any direct deep-link to a route you didn't crawl — will **404**, because there's no server to fall back to. If that's a problem, use Strategy 2 or 3, or configure an SPA fallback at your host.

For a content-only site with no client interactivity, drop the JS entirely:

```sh
npx cofound generate --noscript
```

---

## Strategy 2 — Server (SSR for everything)

```sh
npm run start        # cofound start — NODE_ENV=production, serves your app
```

Best when the app has a backend (`+server/` routes, sessions, jobs) or needs per-request data. With no `dist/` present, every navigation hits the **live SSR catch-all**, so there's no crawl step and no deep-link problem — any route, including ones reachable only by JS navigation, is server-rendered on demand and then hydrated by the client SPA.

`cofound start` forces `NODE_ENV=production` and boots either a custom HTTP server (a module whose default export is a function) or the default server at `+server/index.js`.

This is the simplest correct setup for a dynamic app: one running process, every route works.

---

## Strategy 3 — Hybrid (pre-render + server) — recommended for most apps

```sh
npm run generate     # pre-render the static-friendly pages into dist/
npm run start        # serve dist/ first, SSR everything else live
```

This is the setup the layered server is built for. In one deployment you get:

- **Pre-rendered pages** (`/`, `/pricing`, `/docs`, …) served straight from `dist/` as static files — fast, no render cost — because `start` checks `dist/` first.
- **Dynamic / authenticated / data-driven routes** server-rendered live by the catch-all.
- **Full SPA behavior** — the same `index.js` hydrates every page and client-routes after first load, with the SSR fallback guaranteeing deep links and JS-only routes still resolve.

You pre-render exactly the routes that benefit from it and let the server handle the rest; nothing forces an all-or-nothing choice. Re-run `generate` as part of each deploy so `dist/` stays in sync with your code.

---

## Configuring the server

The settings below apply to `cofound start` (Strategies 2 and 3).

### Port and address

| Setting | How to set it | Default |
| --- | --- | --- |
| Port | `PORT` env var, or `--port` / `-p` | `80` (or `443` when TLS is enabled) |
| Bind address | `ADDRESS` env var | `0.0.0.0` (all interfaces) |

```sh
PORT=3000 npm run start
# or
npx cofound start --port 3000
```

### Multiple workers

Cofound can fork worker threads to use more than one core (default: one worker):

```sh
npx cofound start --workers cpus   # one worker per CPU
npx cofound start --workers 4      # an explicit count
```

Workers share one SQLite file — see **Data persistence**.

### Required environment variables

A project can declare required env vars in `package.json` under an `"env"` key; in production, `cofound start` **throws on startup if any required variable is unset**. Set every required variable in your host's environment before deploying. See [Environment Variables](environment-variables.md) for the full contract and precedence rules.

---

## Environment variables and `.env`

Configuration comes from a `.env` file (loaded from the working directory and up through parent directories) and/or the host environment, with required variables optionally declared in `package.json`'s `"env"` key.

```sh
# .env
PORT=3000
ADDRESS=0.0.0.0
DB_FILE=/data/app.db
SESSION_SECRET=…
```

One precedence gotcha worth knowing before you deploy: a loaded `.env` value **overrides** a host environment variable of the same name (the opposite of most setups). Prefer setting production values through the host environment and keeping `.env` out of the deployed image.

See **[Environment Variables](environment-variables.md)** for the full reference: precedence rules, the `package.json` `"env"` contract, and every variable Cofound reads (`PORT`, `ADDRESS`, `DB_FILE`, the `SSL_*` and `ACME_*` families, and more).

---

## Data persistence

A fresh scaffold has no database — you wire one up with `makeDb()` when your app needs persistence (the example apps show the pattern). Once you do, Cofound's data, sessions, and background-job queue all live in **a single SQLite file** opened by that `makeDb()` call. In the example apps the file defaults to **`app.db`**, resolved relative to the working directory, and is overridable via the **`DB_FILE`** env var:

```js
const DB_FILE = process.env.DB_FILE || 'app.db'
const db = makeDb(DB_FILE)
```

Two things follow for any server deployment (Strategies 2 and 3):

1. **Put the database on persistent storage.** A CWD-relative `app.db` is easy to lose on ephemeral/containerized hosts that reset their filesystem on each deploy. Point `DB_FILE` at a mounted volume, e.g. `DB_FILE=/data/app.db`.
2. **Expect WAL sidecar files.** The database runs in WAL mode, so you'll also see `app.db-wal` and `app.db-shm` next to the main file. Back up and migrate all three together (or checkpoint before copying).

Because sessions and jobs share this one file, a single durable `DB_FILE` is all the state a server deployment needs to preserve.

> SQLite is single-writer. If you scale to multiple worker threads or multiple instances, they must share the **same** `DB_FILE` on shared storage — not separate copies. For most apps, a single instance with multiple workers on one volume is the simplest durable setup.

*(Pure static deployments have no server and no database — this section doesn't apply.)*

---

## TLS / HTTPS

`cofound start` can terminate TLS directly, or you can let a reverse proxy / load balancer handle it.

**Behind a proxy (common):** terminate TLS at nginx, Caddy, or your cloud load balancer and run `cofound start` on plain HTTP behind it. Nothing extra to configure in Cofound.

**Direct TLS — bring your own certificate:**

```sh
# .env
SSL_CERT=/etc/ssl/app/fullchain.pem
SSL_KEY=/etc/ssl/app/privkey.pem
SSL_MODE=redirect          # redirect (default) | only | optional
```

When a cert is configured, Cofound serves HTTPS on `443` and, by default, also listens on `80` to redirect to HTTPS (`SSL_MODE=only` disables the plain-HTTP listener; `optional` serves both without redirecting). It watches the cert file and hot-reloads on change.

**Direct TLS — automatic Let's Encrypt (ACME):**

```sh
# .env
ACME_DOMAINS=example.com,www.example.com
ACME_EMAIL=you@example.com
# ACME_CA=letsencrypt    # default
# ACME_TEST=1            # use the staging environment while testing
```

With `ACME_DOMAINS` set, Cofound provisions and renews certificates automatically (the default `http-01` challenge needs port `80` reachable from the internet; DNS challenges are also supported). Certificates are cached under `~/.cofound/acme`, which should be on persistent storage so renewals survive restarts.

---

## Quick reference

| Goal | Command |
| --- | --- |
| Pure static site → `dist/` | `npm run generate` |
| Static site, no client JS | `npx cofound generate --noscript` |
| Server, SSR everything | `npm run start` |
| Hybrid: pre-render + serve | `npm run generate && npm run start` |
| Server on a specific port | `PORT=3000 npm run start` |
| Server using all cores | `npx cofound start --workers cpus` |

## Pre-deploy checklist

- [ ] Node.js 20.11+ on the build/host machine.
- [ ] **Pure static:** every route is reachable via an `<a href>` link, or your host has an SPA fallback (otherwise deep links 404).
- [ ] **Server / hybrid:** all `package.json` `env` requirements are set in the host environment.
- [ ] **Server / hybrid:** `DB_FILE` points at persistent storage; back up `app.db` plus its `-wal`/`-shm` sidecars.
- [ ] **Hybrid:** `npm run generate` runs as part of each deploy so `dist/` stays in sync.
- [ ] TLS handled — by a reverse proxy, `SSL_CERT`/`SSL_KEY`, or `ACME_DOMAINS`.
- [ ] Production `.env` / secrets configured and kept out of version control.

See also: [Environment Variables](environment-variables.md), [CLI](cli.md), [Sessions](server/sessions.md), [Jobs](server/jobs.md).
