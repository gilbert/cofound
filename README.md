# Cofound – The AI-friendly Fullstack Framework

Cofound is a modern, opinionated TypeScript web framework for Sin. Its main goal is to keep your code as maintainable as possible, while being trivially scalable for medium-scale apps, which cover nearly all applications on the web.

Cofound provides built-in support for:

- Pre (static sites) and server-side rendering
- Session & Passkey auth
- SQLite query models and schema management
- Simple RPCs for frontend-backend interactions

## Quick Start

You can cofound a new project using the `cofound-create` command:

```bash
npx cofound-create myapp
```

## Project Structure

![Architecture Diagram](https://github.com/user-attachments/assets/6e132367-0e7d-43b2-93be-7149e2145490)

Example walkthrough:

1. Browser makes a remote call using our rpc client
   - Example: [public_rpc_loginWithPasskey call](https://github.com/snowball-tools/web/blob/85c604971c1af11d66192cceec4b21053e0c4cc3/src/pages/auth/Login.tsx#L33)
   - Side note: All RPCs require auth unless prefixed with `public_`
2. RPC layer [validates inputs](https://github.com/snowball-tools/web/blob/85c604971c1af11d66192cceec4b21053e0c4cc3/%2B/rpcs/user-auth.ts#L89-L102) and [calls an action method](https://github.com/snowball-tools/web/blob/main/%2B/rpcs/user-auth.ts#L104-L107)
   - Note this must be exported by [the rpc index file](https://github.com/snowball-tools/web/blob/85c604971c1af11d66192cceec4b21053e0c4cc3/%2B/rpcs/index.ts#L2) or it won't be available to call
3. The [action method](https://github.com/snowball-tools/web/blob/main/%2B/actions/auth/LoginUser.ts#L24) calls as many model methods as it needs to accomplish its task, always returning a result – whether an [error result](https://github.com/snowball-tools/web/blob/85c604971c1af11d66192cceec4b21053e0c4cc3/%2B/actions/auth/LoginUser.ts#L33) or an [ok result](https://github.com/snowball-tools/web/blob/85c604971c1af11d66192cceec4b21053e0c4cc3/%2B/actions/auth/LoginUser.ts#L58).
   - The action in this example [creates a user session](https://github.com/snowball-tools/web/blob/85c604971c1af11d66192cceec4b21053e0c4cc3/%2B/actions/auth/LoginUser.ts#L57), so it doesn't return any data in its ok result.

Actions and models are easily testable (see [tests/actions](./test/actions) and [tests/actions](./test/models)).

Read more about each layer in their respective READMEs:

- [RPC Layer](./create/template/docs/backend/rpcs.md)
- [Action Layer](./create/template/docs/backend/actions.md)
- [Model Layer](./create/template/docs/backend/models.md)
