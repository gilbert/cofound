# Cofound – The Fullstack Framework that's Just Code

Cofound is a modern, opinionated TypeScript web framework for Sin. Its main goal is to keep your code as maintainable as possible, while still being scalable for most medium scale apps.

Cofound provides built-in support for:

- Session & Passkey auth
- SQLite query models and schema management
- Simple RPCs for frontend-backend interactions

## Code Generators

Once you've defined a table `examples` in your `+/schema.ts`, you can generate a model file for that table like so:

```bash
cof g model examples
```
