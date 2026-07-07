# Environment Variables

Cofound configures an app from two complementary sources: a **`.env` file** for values (especially secrets), and an optional **`"env"` key in `package.json`** that declares the contract — which variables the app needs, which are optional, and any committed defaults. This page covers both, their precedence, and the variables Cofound itself reads.

## `.env` files

On startup Cofound loads a `.env` file from the working directory **and walks up parent directories**, so a `.env` at a repo root applies to a project nested beneath it. When the same key appears in more than one `.env`, the **closest** file wins.

```sh
# .env
PORT=3000
ADDRESS=0.0.0.0
DB_FILE=/data/app.db
SESSION_SECRET=…
```

`.env` is for values, and is typically kept out of version control — the scaffold's `.gitignore` already excludes it. Do not commit secrets; set sensitive values through your host's secret manager where possible.

## Declaring required variables in `package.json`

A project can declare the variables it needs under an `"env"` key in `package.json`. A fresh scaffold has no `"env"` key — you add it when your app needs one.

```json
{
  "env": {
    "SESSION_SECRET": "",
    "PUBLIC_BASE_URL": "https://example.com",
    "STRIPE_KEY": null
  }
}
```

Each entry's value determines its behavior (`bin/config.js`):

- **Empty string (`""`)** — required, no default. If it's still unset at production startup, `cofound start` **throws** with `package.json requires env value: <name>`.
- **Non-empty string** — a committed default, applied only if nothing else already set the variable (good for non-secret config like a public base URL or a default port).
- **`null`** — optional. Declared and documented, but never required and never defaulted.

Why use this instead of relying on `.env` alone?

- **Fail-fast validation.** A missing required variable crashes immediately at startup with a clear message, instead of surfacing later as a mysterious `undefined`.
- **Committed, shareable defaults.** A string value lives in version control, so every checkout and deploy gets it without a `.env`.
- **A self-documenting surface.** Because `package.json` is committed (and `.env` usually isn't), the `"env"` block is the readable, shared list of what must be configured.
- **Dev leniency.** The required check is skipped under `cofound dev`, so you aren't forced to set production secrets just to run locally.

In short: **declare the contract in `package.json`, supply the values in `.env` or the host environment.**

## Precedence

When the same variable is set in more than one place, the order from **highest to lowest** is:

**`.env` file → host environment → `package.json` `"env"` default.**

Note that a loaded `.env` value **overrides** an existing host/process environment variable of the same name — this is the opposite of how most dotenv setups behave, where the host environment wins.

> Because `.env` overrides the host environment, don't ship a `.env` containing a value you intend the host to control. In production, prefer setting values through the host environment and keeping `.env` out of the deployed image (the scaffold's `.gitignore` already excludes it).

## Variables Cofound reads

These are interpreted by the framework and CLI:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime environment. Forced to `production` by `cofound start`. |
| `PORT` | HTTP(S) listen port. Defaults to `80` (or `443` when TLS is enabled). |
| `ADDRESS` | Bind address. Defaults to `0.0.0.0` (all interfaces). |
| `DB_FILE` | SQLite database path. Honored by the example apps (default `app.db`); your own app reads it if you wire `makeDb()` to it. |
| `SSL_CERT`, `SSL_KEY`, `SSL_PASSPHRASE` | Certificate, key, and passphrase for manual TLS. |
| `SSL_MODE` | TLS port behavior: `redirect` (default), `only`, or `optional`. |
| `ACME_DOMAINS`, `ACME_EMAIL` | Domains and contact for automatic Let's Encrypt certificates. |
| `ACME_CA`, `ACME_TEST`, `ACME_CHALLENGE` | ACME certificate authority (default `letsencrypt`), staging toggle, and challenge type (default `http-01`). |

See [Deploying to Production](DEPLOYING_TO_PRODUCTION.md) for how these apply in each deployment strategy, and [Sessions](server/sessions.md) for secret-backed session configuration.
