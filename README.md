# Cofound

A full-stack JavaScript framework for building server-rendered apps with a single shared SQLite database. No TypeScript, no bundler in dev, no React.

Cofound provides a component runtime, server-side rendering, HTTP routing, a database layer (via `better-sqlite3`), and a dev server with hot reload — all in one package.

## Structure

- **`pkg/`** — the framework source (published as `cofound` on npm)
- **`examples/`** — example applications built with Cofound

## Getting started

```sh
cd examples/todo-app
npm install
npm run dev
```

## Running tests

```sh
# Framework tests
cd pkg && npm test

# Example app tests
cd examples/todo-app && npm test
```
