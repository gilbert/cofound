# Frontend Components

Cofound is built on the framework [Sin](https://github.com/porsager/sin). It's a framework similar to React that has:

- Built-in routing
- Built-in Server-Side Rendering (SSR)
- Built-in hot reload
- Fast global rendering
- No virtual dom

## Component Definitions

For convenience and to avoid footguns, Cofound provides a helper for defining Sin components.

There are two rules for using `cc`:

1. ALWAYS use a non-arrow function at the top, e.g. `cc<Attrs>(function ...)`
2. NEVER destructure attrs at the top. It should always look like `cc<Attrs>(function(attrs) ...)

The reason for (1) is so you have access to `this.children`, `this.ctx`, etc.

The reason for (2) is so you always have access to the latest `attrs` in your component closures (more on that below).

```ts
import s from 'sin'
import { cc } from 'cofound/frontend'

type Attrs = {
  title: string
  onsubmit: (content: string) => void
}
export const FeedbackForm = cc<Attrs>(function(attrs) {
  //
  // This is your component closure.
  // It only runs once – when your component initializes.
  // You can define state as plain JS variables.
  // You can define helpers as plain JS functions.
  //
  let content = ''

  function submit(e: SubmitEvent) {
    e.preventDefault()
    attrs.onsubmit(content)
  }

  //
  // This is your view function.
  // It runs on every render.
  // It's ok to destructure attrs here.
  //
  return ({ title }) => {
    //
    // This is a view closure.
    // It gets run every time Sin renders.
    // You can assign local variables here for cleaner code.
    // Even if you don't have any local variables at first,
    // I recommend always writing it this way, as it's more annoying to
    // have to add it in later.
    //
    return <form onsubmit={submit}>
      <label>{title}</label>
      <input
        type="text"
        value={content}
        oninput={(e: any) => content = e.target.value}
        placeholder="Your feedback"
      />
      <button disabled={!content}>
        Submit
      </button>
    </form>
  }
})
```

## Children

Within a cc component, you can use `this.children` to access any children passed into your component.

## Routing

Within a cc component, you can use `this.ctx.route` to conditionally render based on the current window pathname.

This is scoped to the current **unhandled pathname substring**, allowing you to be more modular in how you handle routes.

```ts
const App = cc(function () {
  return () => this.ctx.route({
    '/': () => <HomePage title="My App" />,
    '/settings': () => <SettingsPages />,
  })
})

const SettingsPages = cc(function () {
  return () => this.ctx.route({
    '/': () => {
      // Redirect to default settings page
      routes.settings.general.visit()
      return null
    },
    '/general': () => <GeneralSettingsPage />,
    '/billing': () => <BillingSettingsPage />,
  })
})
```

## addEventListener

Within a cc component closure, you can call `this.addEventListener` to listen to a DOM event, which will automatically cleanup when the component dismounts.

```ts
type Attrs = { ... }
export const Modal = cc<Attrs>(function(attrs) {
  this.addEventListener(document, 'click', (e) => {
    // Omitted: Logic to close modal if user clicks outside modal
  })
  return () => <div>...</div>
})
```

## Timeouts

Within a cc component closure, you can call `this.setTimeout` and `this.setInterval` to do their respective global equivalents. This automatically cleans up timeout ids when the component unmounts.
