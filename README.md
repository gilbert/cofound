<div align="center">
  <img src=".github/assets/cofound-logo.jpg" alt="Cofound" width="320">
  <h1>Cofound</h1>
</div>

Cofound is a full-stack application framework designed for AI agents that build **Just-in-time software**.

## What is Just-In-Time (JIT) Software?

Most frameworks try to be the standard way of building everything. This makes sense for broad open source adoption, but it comes with a cost: friction. To cover every case, they pile on abstractions, conventions, and configuration. Each layer of indirection is another hop between intent and behavior, another place where what the code *says* and what it *does* can drift apart. The result is a codebase that obscures more than it reveals: harder to read, harder to reason about, and harder to unwind when a task inevitably needs a different shape.

JIT software takes the opposite stance. Instead of wrangling the general, you build the specific. Instead of satisfying the framework, you solve the problem at hand. Instead of reasoning through abstractions, you read &amp; write the code that runs - managing precisely the code that your task actually needs.

## Enter Cofound

To support JIT software, Cofound provides AI agents with solid, foundational features:

- **A concise, fully readable framework** - a full-stack foundation in `pkg/` small enough to fit in a model's working memory.
- **Vendorable infrastructure** - self-contained building blocks in `infra/` that can be copied, pasted, vendored, trimmed, or thrown away as needed.
- **No magic** - nothing hidden behind layers of indirection; the code you read is the code that runs.

Cofound gives your AI agent proven structure to build on, with no extra fluff to fight. Build the exact application for your needs - nothing more, nothing less.

## Features

The core Cofound framework gives an agent everything needed to stand up a full-stack application:

- **Server-rendered UI** - components render on the server, no client framework required.
- **HTTP routing** - a small, explicit router with no hidden conventions.
- **SQLite-backed data access** - durable storage with zero setup.
- **Sessions** - built-in session handling for auth and user state.
- **Background jobs** - run work outside the request/response cycle.
- **Dev server with hot reload** - edit, save, see the change.

Just as important is what Cofound leaves out:

- **Plain JavaScript** - no TypeScript requirement and no build step to satisfy.
- **No React** - React's core design choices breed accidental complexity. Cofound's frontend framework strips that away.
- **No bundler in the dev loop** - Easier debugging when your run into errors.

### In this repo

- **`pkg/`** - the framework source, published as `cofound` on npm.
- **`infra/`** - working infrastructure modules agents can vendor into generated apps, including SQL and other primitives.
- **`examples/`** - applications that show Cofound and the infrastructure pieces working together.
- **`docs/`** - documentation for building with Cofound.

## Getting started

Cofound requires Node.js 20.11 or newer.

Scaffold a new project with the `create` command (install `cofound` globally, or run it through `npx`):

```sh
npx cofound create my-app   # generate a new project (cofound init / cofound c also work)
cd my-app
npm run dev                 # start the dev server with hot reload
```

`cofound create` walks you through a few prompts and writes a ready-to-run project — a server entry, public assets, and a `package.json` with these scripts already wired up:

```sh
npm run dev        # dev server with hot reload
npm run start      # run the production server
npm run build      # bundle browser JS for production
npm run generate   # generate static HTML
```

Pass `-y` to `cofound create` to accept the defaults and skip the prompts.

Or explore a finished app instead:

```sh
cd examples/media-server
npm install
npm run dev
```

## Running tests

```sh
# Framework tests
cd pkg && npm test

# Example app
cd examples/media-server && npm install && npm run dev
```
