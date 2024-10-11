# Cos

Cos is a modern, opinionated TypeScript web framework for Sin. Its main goal is to keep your code as maintainable as possible, while still being scalable for most medium scale apps.

Cos provides support for:

- Session & Passkey auth
- SQLite models and schema management
- RPC setup for frontend-backend interactions

## Code Generators

Once you've defined a table `examples` in your `+/schema.ts`, you can generate a model file for that table like so:

```bash
cos g model examples
```
