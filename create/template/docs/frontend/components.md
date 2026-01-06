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

### Changing Routes

To change the route to /foo/bar:

```ts
s.route('/foo/bar')
```

Additional options (optional second parameter):

```ts
s.route('/foo/bar', {
  state: { /* custom state object */ },
  replace: false,  // true to use replaceState instead of pushState
  redraw: true,    // false to skip redrawing
  scroll: true     // false to prevent scroll restoration
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

## Reactivity and Common Pitfalls

### Component Closure vs View Function

One of the most important concepts to understand in Sin/Mithril-style components is the distinction between the **component closure** and the **view function**:

- **Component closure**: Runs **once** when the component initializes
- **View function**: Runs on **every render**

This has critical implications for reactive values:

```ts
// ❌ WRONG: Computed value in component closure
export const MyComponent = cc<{ items: Item[] }>(function(attrs) {
  const hasItems = attrs.items.length > 0  // This only runs ONCE!

  return () => {
    // Even if attrs.items changes, hasItems will never update
    return <div>{hasItems ? 'Has items' : 'No items'}</div>
  }
})

// ✅ CORRECT: Computed value in view function
export const MyComponent = cc<{ items: Item[] }>(function(attrs) {
  return () => {
    const hasItems = attrs.items.length > 0  // This runs on EVERY render

    return <div>{hasItems ? 'Has items' : 'No items'}</div>
  }
})
```

### Real-World Example: Conditional Rendering

This issue commonly appears when conditionally rendering UI based on reactive state:

```ts
// ❌ WRONG: isActive computed in closure
export const ScannerComponent = cc(function() {
  let currentScan: Scan | null = null

  // This only evaluates once when component initializes!
  const isActive = currentScan && currentScan.status === 'running'

  return () => {
    // isActive will always be false, even after currentScan changes
    return (
      <div>
        {!isActive && <button onclick={startScan}>Start Scan</button>}
        {isActive && <div>Scan in progress...</div>}
      </div>
    )
  }
})

// ✅ CORRECT: isActive computed in view function
export const ScannerComponent = cc(function() {
  let currentScan: Scan | null = null

  return () => {
    // Evaluated on every render, so it reacts to currentScan changes
    const isActive = currentScan && currentScan.status === 'running'

    return (
      <div>
        {!isActive && <button onclick={startScan}>Start Scan</button>}
        {isActive && <div>Scan in progress...</div>}
      </div>
    )
  }
})
```

### Rule of Thumb

If a value depends on reactive state (component state, attrs, or any value that changes over time), it must be computed inside the view function, not in the component closure.

## DOM Lifecycle Management with `dom=`

The `dom=` attribute is Sin's approach to DOM lifecycle management, replacing:
- React's `ref` prop
- Mithril's `oncreate`, `onupdate`, `onremove` hooks

### Basic Usage

The `dom=` attribute accepts a callback that receives the DOM element when it's mounted:

```ts
export const MyComponent = cc(function() {
  return () => {
    return (
      <div
        dom={(element) => {
          if (element) {
            // Element is mounted - do initialization here
            console.log('Element mounted:', element)

            // Optionally return a cleanup function
            return () => {
              console.log('Element unmounted:', element)
              // Do cleanup here
            }
          }
        }}
      >
        Content
      </div>
    )
  }
})
```

### Key Features

1. **Mount callback**: The callback runs when the element is added to the DOM
2. **Cleanup function**: Return a function from the callback to run cleanup when the element is removed
3. **Element access**: You get direct access to the actual DOM node

### Real-World Example

Here's a practical example from `FancyHomeBg.tsx` that renders a Three.js scene:

```ts
export const FancyHomeBg = cc(function() {
  return () => {
    return (
      <div
        class="Scene fixed inset-0 flex justify-center items-center z-[-1]"
        dom={(div) => {
          if (div) {
            // Initialize Three.js scene in the mounted element
            const controller = renderModelInContainer(div as HTMLDivElement)

            // Set initial state
            controller.move(0, 0, 1)

            // Store reference for external access
            globalModelController = controller

            // Return cleanup function
            return () => {
              controller.cleanup()
            }
          }
        }}
      ></div>
    )
  }
})
```

### Common Use Cases

- Integrating third-party libraries (Three.js, D3.js, etc.)
- Accessing DOM measurements (offsetWidth, scrollHeight, etc.)
- Setting up event listeners directly on the element
- Imperatively manipulating the DOM when declarative JSX isn't sufficient
- Initializing web components or custom elements

### Important Notes

- Always check if `element` is truthy before using it
- The cleanup function is optional but recommended when you need to tear down resources
- The callback only runs on mount, not on every update (unlike Mithril's `onupdate`)
- For event listeners, prefer using `this.addEventListener` in the component closure when possible

## Architecture Guidelines

- A frontend component file name should be TitleCase (e.g. `frontend/pages/SignupPage.tsx` for `SignupPage`)
