# Frontend Data Loaders

Cofound provides helpers for loading data from your backend. `DataLoader` and `ResultLoader` are higher order functions that use a predefined rpc to load data from your backend, automatically handling loading states and errors, as well as giving you the ability to reload that endpoint.

## DataLoader Example

```tsx
export const PasskeySettingsPage = cc<Attrs>(function () {
  const passkeys = ResultLoader(() => client.rpc_getPasskeys({}))

  return () => (
    <div>
      <h1>Connected Passkeys</h1>

      {passkeys.loading && passkeys.firstLoad &&
        <p class="animate-spin">⏳</p>
      }

      {passkeys.error &&
        <div>Error loading passkeys</div>
      }

      {passkeys.data && passkeys.data.length === 0 &&
        <div>No passkeys found</div>
      }

      {passkeys.data?.length && passkeys.data.map((passkey) => (
        <div>...</div>
      ))}
    </div>
  )
})
```
