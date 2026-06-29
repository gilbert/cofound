# My Cofound App

A starter app built with [Cofound](https://github.com/nicedoctor/cosine).

## Setup

```sh
npm install
npm run dev
```

The dev server starts at `http://127.0.0.1:1337`.

## Project structure

```
index.js        — client entry point (UI, reactive state)
+server/
  index.js      — server API routes
+public/        — static assets (images, fonts, etc.)
package.json
```

## Scripts

| Command         | Description                        |
|-----------------|------------------------------------|
| `npm run dev`   | Start the dev server (hot reload)  |
| `npm run build` | Production build to `dist/`        |
| `npm run start` | Run the production build           |

## How it works

**Client (`index.js`)** uses `s.mount()` to render a reactive UI. State is managed with `s.live()` — call it with no arguments to read, or pass a value to update. API calls use `s.http` (get, post, patch, delete). Styles are written inline with tagged template literals using cofound's CSS shorthand (`d` = display, `p` = padding, `m` = margin, `c` = color, `bc` = background-color, `ai` = align-items).

**Server (`+server/index.js`)** exports a function that receives the `app` object. Register routes with `app.get()`, `app.post()`, `app.patch()`, `app.delete()`. Use `r.body('json')` to parse JSON request bodies and `r.json()` to send JSON responses.

## Expanding further

### Adding input validation with Zod

For public-facing apps, validate request bodies with [Zod](https://zod.dev):

```sh
npm install zod
```

```javascript
import { z } from 'zod'

const CreateItem = z.object({
  name: z.string().trim().min(1).max(500)
})

app.post('/api/items', async r => {
  const result = CreateItem.safeParse(await r.body('json'))
  if (!result.success)
    return r.json({ error: result.error.flatten() }, 400)

  // result.data is now typed and validated
  r.json({ name: result.data.name }, 201)
})
```

Zod's `safeParse` returns a discriminated result instead of throwing, so you can return a structured 400 response with field-level error details.
