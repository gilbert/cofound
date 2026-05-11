# Components

Cos revolves around components, which are the building blocks of your application. Components can be stateless, stateful, or asynchronous, and they support a variety of signatures. All components in cos are made to allow overriding styles anywhere they are used.

> The beauty of the cos component model is that you will never have to change your callsite usage, even if you need to advance the complexity of your component.

## Elements

Elements are composed as tagged template literals. Cos defaults to creating `div` elements if an HTML element type is not specified and allows `#` and class names `.` right after the element type or at the start of the tagged template literal to be passed.

```js
s``('Hello!')                  // -> <div>Hello!</div>
s`#id`('With id')              // -> <div id="id">With id</div>
s`h1.title`('With class')      // -> <h1 class="title">With class</h1>

// Inline styling
s`span
  font-size: 16px;
  text-decoration: underline;
  color: pink;
`('Styled text')               // -> <span class="s1cnspbk">Styled text</span>
```

## Attributes

Element attributes support HTML attribute properties. Cos resolves attributes via JavaScript and DOM APIs (`setAttribute`). Event handler binding supports all DOM events, including those without an `on` property, like `touchstart`. Event handlers are enhanced, with per-element references and additional properties for improved rendering control.

### dom `{ dom: () => {} }`

The `dom` key is a render callback — a creation lifecycle hook which fires in the post-rendering cycle. You attach third-party tools using this callback, as it fires once the virtual node has been mounted and is ready.

```js
s`div`({
  dom: (element, attributes, children, context) => {
    element      // -> <div> Element
    attributes   // -> element attributes
    children     // -> nested content
    context      // -> context reference
  }
})
```

The `dom` key also accepts an array of handler functions:

```js
s`div`({
  dom: [
    (dom, attributes, children, context) => p(dom, attributes, children, context),
    (dom, attributes, children, context) => p(dom, attributes, children, context),
    (dom, attributes, children, context) => p(dom, attributes, children, context)
  ]
})
```

### deferrable `{ deferrable: boolean }`

The `deferrable` key accepts a boolean — it will wait for any children that have set delayed removal through the dom callback.

```js
s`div`({ deferrable: false })
```

### key `{ key: any }`

The `key` property maps a DOM element to its respective item in an array of data. It is used as a unique child identifier for keyed lists. When you render arrays of children, cos compares the new view list to the old one. If items have a key, cos can track their identity across redraws.

```js
const Item = s(({ label }) => s`li`(label));
const List = s(({ items }) =>
  s`ul`(
    items.map(i =>
      Item({
        key: i.id,
        label: i.name
      })
    )
  )
);
```

Without `key`, cos compares children by order only. If items move around, the wrong DOM nodes can be reused or recreated unnecessarily. With `key`, cos builds a lookup map so it can re-use the existing DOM node for the same identity, even if the order changes.

> Cos also uses key as part of the component's identity. If a component's key changes, cos considers it a different instance and will tear down the old one and mount a fresh one.

### state `{ state: object }`

The `state` key is a special attribute that can be applied to anchor (`a`) elements to facilitate data passing during client-side routing. It leverages the browser's History API (`history.pushState`) to forward an object of data to the target route without altering the URL. This data is then automatically merged into the `attrs` argument of the receiving component on the target route.

```js
const page = s(({ title, describe, ...attrs }) =>
  s``(
    s`h1`(title),
    s`p`(describe)
  )
)

s`main`(
  s`a`({
    href: '/page',
    state: {
      title: 'Hello',
      describe: 'State passed via routing'
    }
  }, 'Go to page'),
  s.route({
    ':page': page
  })
)
```

## Arguments

Component function signatures are comprised of 3 arguments. Each argument represents render specifics.

```js
s((attrs, children, context) => [])
s(({}, [], {}) => [])
```

### attrs `{}`

The `attrs` argument is a hashmap object. Use `attrs` as a blueprint for how a component behaves and appears, allowing you to define everything from standard HTML attributes to event handlers and custom properties.

```js
const person = s(({ name = 'Eve', ...attrs }) => s`button`(attrs, name))

s.mount(() => [
  person({ name: 'Adam' }),
  person({ onclick: () => alert('Hello!') })
])
```

> When passing attributes, spread `...attrs` on the receiving component and extract non-standard values from the hashmap. Spreading attributes ensures custom properties are not applied directly as element attributes.

### children `[]`

The `children` argument represents the nested content within a component, forming the heart of its compositional power and UI hierarchies. It's a flexible, array-like structure that can include elements, primitive values (like strings or numbers), or arrays of other children.

```js
const people = s(({}, children) => s`ul`(children))

s.mount(() => people(
  s`li`(person({ name: 'Adam' })),
  s`li`('Eve'),
  s`li`(person({ onclick: () => alert('Hello!') }))
))
```

### context `{}`

The context argument holds globally accessible methods which can be used to interact with the broader application. It encapsulates utilities for document manipulation, client-side routing, lifecycle management, and redraw control. You can extend `context` on a per-component basis and use it as a shared data or method binding reference that sub-components can access.

```js
const people = s(({}, children, context) => [
  s`button`({ onclick: () => context.active = !context.active }, 'Toggle'),
  s`ul`(children),
  context.active && s`h1`('Active!')
])

s.mount(({}, [], { doc, state }) => {

  state.active = false

  // The doc key is readonly and represents the document
  doc.title('My App')
  doc.lang('en')
  doc.head([
    s`link`({ rel: 'icon', href: '/favicon.ico', sizes: 'any' }),
    s`meta`({ name: 'apple-mobile-web-app-capable', content: 'yes' })
  ])

  return () => people(
    s`li`(person({ name: 'Adam' })),
    s`li`(person({ onclick: () => alert('Hello!') }))
  )
})
```

> Treat `context` as a broader application reference. When possible, choose `attrs` for passing data between components or consider inline variables using a [DAFT](#daft) expression.

## Mounting `s.mount(...)`

The mount method renders elements and components. By default, cos mounts to `document.body`, but you can provide a specific element.

```js
// Mounting to document.body
s.mount(() => s`h1`('Hello'))

// Mounting to a specific element
s.mount(
  document.querySelector('#app'),
  () => s`h1`('Hello')
)
```

You can provide runtime `attrs` and `context` to `s.mount`:

```js
// Passing attrs
s.mount(
  (attrs) => s`h1`(`${attrs.greet}!`),
  { greet: 'Hello' }
)

// Passing context
s.mount(
  (attrs, [], context) => s`h1`(`Hello ${context.name}`),
  {},
  { name: 'World' }
)

// Passing both attrs and context
s.mount(({ greet }, [], { name }) =>
  s`h1`(`${greet} ${name}`),
  { greet: 'Hello' },
  { name: 'World' }
)
```

## Styled Component `s``(...)`

A **styled component** is the simplest type — it declares a tag and styles with no logic or state. Styled components serve as reusable visual building blocks, and their styles can be overridden wherever they are used.

```js
// Definition
const button = s`button
  p 10 15
  fs 15
  mr 10
  bc cyan
`

// Basic Usage
button({
  onclick: () => alert('Clicked!')
},
  'Click me'
)

// Style Override
button`
  br 4
  border 1 solid
  color white
  bc hotpink
`({
  onclick: () => alert('Clicked!')
},
  'Click me'
)
```

## Stateless Component `s(() => ...)`

A **stateless component** is a pure function of its inputs. It receives `attrs` and `children`, and returns a view. The output is entirely determined by the inputs, making it predictable and easy to reason about.

```js
const button = s`button
  p 10 15
  fs 15
  bc hotpink
  br 4
  border 1 solid
  color white
`

const myButton = s(({ onclick, ...attrs }, children) =>
  button({
    ...attrs,
    onclick: e => {
      alert('Clicked!')
      onclick(e)
    }
  },
    children
  )
)
```

## Stateful Component `s(() => () => ...)`

A **stateful component** maintains its own internal data across renders. It still accepts attributes and children, but can track state, respond to events, and trigger redraws. The return signature is a function that returns the view.

```js
const button = s`button
  p 10 15
  fs 15
  bc hotpink
  br 4
  border 1 solid
  color white
`

const counter = s(() => {
  let count = 0

  return () => button({
    onclick: () => count++
  },
    count === 0
    ? 'No clicks yet'
    : `Clicked ${count} time${count > 1 ? 's' : ''}`
  )
})
```

> You can access `attrs`, `children` and `state` arguments in the closure callback function. The arguments available to the callback can be used to avoid stale data references.

## Async Component `s({ loading, error }, async () => ...)`

An **asynchronous component** handles values that resolve over time. It returns a Promise that resolves to a view once data or resources are ready, allowing you to defer rendering until an API call completes or a module loads.

```js
const result = s(
  {
    loading: button('Loading...'),
    error: e => button(`Error: ${e}`)
  },
  async () => {
    await s.sleep(3000)
    return async () => button('Done!')
  }
)
```

## DAFT

DAFT (Default Argument Function Thunk) is a signature pattern unique to cos components that lets you declare scope-level variables as default arguments in your render functions. Instead of re-declaring values inside your component body, DAFT allows you to express them inline at the signature level.

```js
s((attrs, children, context) => () =>
  s`h1`(
    (
      d = 'Default',
      a = 'Argument',
      f = 'Function',
      t = 'Thunk'
    ) => [
      d, ' ', a, ' ', f, ' ', t
    ]
  )
)
```
