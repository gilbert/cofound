<p  align="center">
<a href ="https://sinjs.com">
<img src="https://sinjs.com/sin.svg" width="400px">
</a>
</p>

# Sin

Sin is a lightweight, reactive JavaScript framework designed to craft dynamic, performant, and accessible web applications. It embraces a declarative, component-based approach. If you understand HTML, CSS and JavaScript you will understand sin.

<pre><code><i><strong><a href="https://flems.io/sin">https://flems.io/sin</a></strong></i></code></pre>

### Features

- 🔥 Full Stack Web Framework
- 💍 HTML, CSS & JS in a sinful threesome
- 💦 DOM Hydration and SSR
- 🧐 SPA, MPA, SSR, SSG, CLI, ACME and WAT
- 📦 Package Management
- 👩‍💻 Best DX in town (sub eye blink hot reload)
- 🏎️ Lean and Fast (Only 2 dependencies) 12kb~ish

### Samples

- [Carousel](https://flems.io/https://gist.github.com/panoply/bb1b15cdae4e98bca253016e2c4ed9c4)
- [Toast](https://flems.io/https://gist.github.com/porsager/d799d962c435e5e647cc0f6a6b560909)

# Installation

Sin is (currently) private, accessible only with explicit authorization. The Sin CLI handles development, bundling, package management, and project generation (see [CLI](#cli)), this means you don't need to use alternative managers such as npm or pnpm, because sin comes with package management support built-in. After installation, use the `sin` binary for all development tasks.

```bash
source <(curl -fsSL install.sinjs.com)
```

### CDN

```js
import sin from 'https://sinjs.com'
```

### IEX

```powershell
iex (irm install.sinjs.com)
```

### Latest Versions

Sin is not yet available for consumption via the NPM Registry. Given that there are frequent changes and improvements, once the `sin` binary is exposed you can keep aligned with your local copy of via the Github Repository.

```bash
GITHUB_TOKEN=xxx sin i porsager/sin
```

> Obtain the GITHUB_TOKEN from Rasmus or one of us in the [discord](https://discord.gg/PQAsXkRGkp).

### Linking Forks

Forks of sin from `porsager/sin` can be used as global links. Refer to the [Package Manager](#package-manager) section for more information on dependency management with sin.

```bash
sin link sin
```

### Project Structure

Sin projects use a default structure and when leveraging the [Sin CLI](#cli), projects should adhere to the following directory layout.

```bash
├── +             # Server Side Scripting
├── +build        # Build Scripts
├── +public       # Pass-through files
├── index.js      # Client side entry
├── package.json  # Package
└── sin.lock      # Sin lock for package management
```

### VSCode Extension

Sintax provides some basic on-going IDE support for sin, including Syntax highlighting for literal styles (CSS) and file icons. You can install the vscode extension via the marketplace.

- [Sintax](https://marketplace.visualstudio.com/items?itemName=sissel.sintax)

---

# Table Of Contents

- [Elements](#elements)
- [Attributes](#attributes)
  - [dom](#dom--dom----)
  - [deferrable](#deferrable--deferrable-boolean-)
  - [key](#key--key-any-)
  - [state](#state)
- [Arguments](#arguments)
  - [attrs](#attrs-)
  - [children](#children-)
  - [context](#context-)
- [Mounting](#mounting-smount)
- [Components](#components)
  - [Styled](#styled-component-s)
  - [Stateless](#stateless-component-s--)
  - [Stateful](#Stateful-component-s----)
  - [Async](#async-component-sasync---)
- [CSS](#css-scss)
  - [reset](#resets-scssreset)
  - [units](#units)
  - [variables](#variables)
  - [alias](#alias-scssalias)
  - [ahothands](#shorthands)
- [Routing](#routing)
- [Live](#live)
- [HTTP](#http-shttp)
  - [Methods](#request-methods)
  - [Options](#request-options)
- [DOM Helpers](#dom-helpers)
  - [is](#is-sisalias)
  - [isAttrs](#isattrs-sisattrsvalue)
  - [on](#on-sontarget-event-handler-options)
  - [event](#event-seventdom-event-handler-options)
  - [animate](#animate-sanimate)
  - [p](#p)
- [Trust](#trust-strust)
- [TypeScript Support](#typescript-support)
  - [Omitted Function Methods](#omitted-function-methods)
  - [Leveraging Generics](#leveraging-generics)
  - [DOM Global](#dom-global)
  - [Declaration Merging](#declaration-merging)
  - [Type Utilities](#type-utilities)
  - [Annotation Typing](#annotation-typing)
- [CLI](#cli)
  - [Commands](#commands)
  - [Package Manager](#package-manager)
  - [Dependency Management](#dependency-management)
- [Testing](#testing-framework)
    - [Writing Tests](#writing-tests)
    - [Running Tests](#running-tests)
---

# ```s`` ```

Sin revolves around components, which are the building blocks of your application. Components can be stateless, stateful, or asynchronous, and they support a variety of signatures. All components in sin are made to allow overriding styles anywhere they are used.

> The beauty of the Sin component model is that you will never have to change your callsite usage, even if you need to advance the complexity of your component.

## Elements

Elements are composed as tagged template literals. Sin defaults to creating `div` elements if an HTML element type is not specified and allows `#` and class names `.` right after the element type or at the start of the tagged template literal to be passed.

```js
// Basic Element Structures
//
s``('Hello Sinner!')           // -> <div>Hello Sinner!</div>
s`#id`('Sinner with id')       // -> <div id="penance">Hello Sinner</div>
s`h1.loki`('Sinner class')     // -> <h1 class="loki">Sinner class</h1>

// Sinfull Element Styling
//
s`span
  font-size: 16px;
  text-decoration: underline;
  color: pink;
`('Sinfull Styling')          // -> <span class="s1cnspbk">Sinfull Styling</span>
```

<details>
<summary>
<strong>HyperScript Syntactical</strong>
</summary>
<p>

If you're coming from mithril.js and prefer the old HyperScript syntax, You can compose elements as normal:

```js
s('', 'Hello Sinner!')
s('#penance', 'Hello Sinner!')
s('h1.loki', [ s('h1', 'Hello Sinner!') ])
```

</p>
</details>

## Attributes

Element attributes support HTML attribute properties. Sin resolves attributes via JavaScript and DOM API's (`setAttribute`). Event handler binding supports all DOM events, including those without an `on` property, like `touchstart`. Event handlers are enhanced, with per-element references and additional properties for improved rendering control.

### dom `{ dom: () => {} }`

The `dom` key is a render callback. It's a creation lifecycle hook which will fire in the post-rendering cycle of a sin view. You will attach third-party tools using this callback method, as it fires once the virtual node has been mounted, rendered and is ready.

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

The `dom` key also accepts an array of handler functions which can be used to chain operations

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

The `deferrable` key accepts a boolean, it will wait for any children that have set delayed removal through the dom callback.

```js
s`div`({ deferrable: false })
```

### key `{ key: any }`

The `key` property is a value used to map a DOM element to its respective item in an array of data. It is used as a unique child identifier for identity and keyed lists. When you render arrays of children, Sin compares the new View list to the old one. If items have a key, Sin can track their identity across redraws.

```js
const Item = s(({ label }) => s`li`(label));
const List = s(({ items }) =>
  s`ul`(
    items.map(i =>
      Item({
        key: i.id,    // <- Unique key
        label: i.name
      })
    )
  )
);

```

Without `key`, Sin compares children by order only. If items move around, the wrong DOM nodes can be reused or recreated unnecessarily. With `key`, Sin builds a lookup map so it can re-use the existing DOM node for the same identity, even if the order changes.

> Sin also uses key as part of the component's identity, That means if a component’s key changes, Sin considers it a different instance and will tear down the old one and mount a fresh one.

### state `{ state: object }`

[![Flems](https://img.shields.io/badge/flems-sandbox-playground?labelColor=34454d&color=cdcdcd&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNSAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIzLjY2NCA5LjE2TDE4LjIxNiAzLjczNkMxOC4xMiAzLjYxNiAxNy45NTIgMy41NDQgMTcuODA4IDMuNTQ0SDE3LjEzNkMxNi4zMiAzLjU0NCAxNS41NzYgNC4wNzIgMTUuMzEyIDQuODY0TDE0LjI4IDcuOTZDMTQuMjA4IDguMiAxNC4zNzYgOC40NjQgMTQuNjQgOC40NjRIMTYuNDY0QzE2LjcyOCA4LjQ2NCAxNi44OTYgOC43MDQgMTYuODI0IDguOTQ0TDE2LjEwNCAxMS4xMjhDMTYuMDA4IDExLjM2OCAxNS43OTIgMTEuNTM2IDE1LjUyOCAxMS41MzZIMTMuNTM2QzEzLjI3MiAxMS41MzYgMTMuMDU2IDExLjcwNCAxMi45NiAxMS45NDRMMTEuNDk2IDE2LjM4NEMxMS4wNCAxNy43MjggMTAuMDMyIDE4Ljc2IDguNzU5OTkgMTkuMjRDOS4wMjM5OSAxOS41MjggOS4yNjM5OSAxOS41MjggOS40MzE5OSAxOS41MjhIMTQuNzEyQzE0Ljg4IDE5LjUyOCAxNS4wMjQgMTkuNDggMTUuMTQ0IDE5LjM2TDIzLjY2NCAxMC44NEMyNC4xMiAxMC4zODQgMjQuMTIgOS42MTYgMjMuNjY0IDkuMTZaTTkuNjk1OTkgMTIuMDRDOS43Njc5OSAxMS44IDkuNTc1OTkgMTEuNTM2IDkuMzM1OTkgMTEuNTM2SDcuNTM1OTlDNy4yOTU5OSAxMS41MzYgNy4xMjc5OSAxMS4yOTYgNy4xOTk5OSAxMS4wOEw3Ljk0Mzk5IDguODcyQzguMDE1OTkgOC42MDggOC4yMzE5OSA4LjQ2NCA4LjQ5NTk5IDguNDY0SDEwLjQ0QzEwLjcwNCA4LjQ2NCAxMC45MiA4LjI5NiAxMS4wMTYgOC4wNTZMMTIuNDggMy42MTZDMTIuOTEyIDIuMjcyIDEzLjk0NCAxLjI0IDE1LjIxNiAwLjc2QzE1LjEzMjkgMC42NjQ0NTcgMTUuMDI5MyAwLjU4ODkyNiAxNC45MTMgMC41MzkwNTRDMTQuNzk2NiAwLjQ4OTE4MyAxNC42NzA1IDAuNDY2MjYgMTQuNTQ0IDAuNDcySDkuMjg3OTlDOS4xNDM5OSAwLjQ3MiA4Ljk3NTk5IDAuNTIgOC44Nzk5OSAwLjY0TDAuMzU5OTkgOS4xNkMwLjI0ODIzNyA5LjI2OTUgMC4xNTk0NTYgOS40MDAxOSAwLjA5ODg0NzEgOS41NDQ0M0MwLjAzODIzNzkgOS42ODg2NiAwLjAwNzAxOTA0IDkuODQzNTUgMC4wMDcwMTkwNCAxMEMwLjAwNzAxOTA0IDEwLjE1NjUgMC4wMzgyMzc5IDEwLjMxMTMgMC4wOTg4NDcxIDEwLjQ1NTZDMC4xNTk0NTYgMTAuNTk5OCAwLjI0ODIzNyAxMC43MzA1IDAuMzU5OTkgMTAuODRMNS43ODM5OSAxNi4yNjRDNS45MDM5OSAxNi4zODQgNi4wNDc5OSAxNi40NTYgNi4xOTE5OSAxNi40NTZINi44Mzk5OUM3LjY1NTk5IDE2LjQ1NiA4LjM5OTk5IDE1LjkwNCA4LjY2Mzk5IDE1LjEzNkw5LjY5NTk5IDEyLjA0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==)](https://flems.io/https://gist.github.com/panoply/3690a0b080af6e58078624b003e63f98)

The `state` key is a special attribute in Sin that can be applied to anchor (`a`) elements to facilitate data passing during client-side routing. It leverages the browser's History API (specifically `history.pushState`) to forward an object of data to the target route without altering the URL (e.g., no query parameters or fragments are added). This data is then automatically merged into the `attrs` argument of the receiving component on the target route.

```js
const wat = s(({ title, describe, ...attrs }) =>
  s``(
    s`h1`(title),
    s`p`(describe)
  )
)

s`main`(
  s`a`({
    href: '/wat',
    state: {
      title: 'Baphomet',
      describe: 'The sinful state and sabbatic baphomet'
    }
  }, '𓃵'),
  s.route({
    ':wat': wat
  })
)
```

## Arguments

In Sin, the `attrs`, `children`, and `context` arguments are fundamental to component creation and management, as they define the properties, content, and environment of components. Function signatures of sin components are comprised of 3 arguments. Each argument represents render specifics.

```js
s((attrs, children, context) => [])
s(({}, [], {}) => [])
```

### attrs `{}`

The `attrs` argument is a hashmap object. We use `attrs` as a blueprint for how a component behaves and appears, allowing you to define everything from standard HTML attributes to event handlers (e.g., `onclick`) and custom properties.

```js
const person = s(({ name = 'Eve', ...attrs }) => s`button`(attrs, name))

s.mount(() => [
  person({ name: 'Adam' }),
  person({ onclick: () => alert('Apples?') })
])
```

> [!NOTE]
> When passing attributes, we usually spread `...attrs` on the receiving component and extract non-standard values from the hashmap.
> Spreading attributes ensures properties are not applied directly as element attributes.
>
> **See this » [Flems Demonstration](https://flems.io/https://gist.github.com/panoply/ae2e0ae00b8695867c0f123d29f17e10)**

### children `[]`

The `children` argument represents the nested content within a sin component, forming the heart of its compositional power and UI hierarchies. It's a flexible, array-like structure that can include elements, primitive values (like strings or numbers), or arrays of other children.

```js
const people = s(({}, children) => s`ui`(children))

s.mount(() => people(
  s`li`(person({ name: 'Adam' })),
  s`li`('Eve'),
  s`li`(person({ onclick: () => alert('Apples?') }))
))
```

### context `{}`

The context argument holds global accessible methods which can be used to interact with the broader application. It encapsulates utilities for document manipulation, client-side routing, lifecycle management, and redraw control. We can extend `context` on a per-component basis and use it as a shared as data or method binding reference that sub-components can access.

```js
const people = s(({}, children, context) => [
  s`button`({ onclick: () => context.eat = !context.eat }, 'Eat the apple?')
  s`ui`(children),
  context.eat && s`h1`('Hell hath no fury!')
])

s.mount(({}, [], { doc, state }) => {

  state.eat = false
  state.name = 'xxx'
  state.food = () => {}

  // The doc key is readonly and represents the document
  doc.title('Garden of Eden')
  doc.lang('da')
  doc.head([
    s`link`({ rel: 'icon', href: '/favicon.ico', sizes: 'any' }),
    s`meta`({ name: 'apple-mobile-web-app-capable', content: 'yes' })
  ])

  return () => people(
    s`li`(person({ name: 'Adam' })),
    s`li`(person({ onclick: () => alert('Apples?') }))
  )
})
```

> [!NOTE]
> Treat the `context` as broader application reference and when possible, choose `attrs` for passing data
> between components or consider inline variables using a [DAFT](#daft) (default argument function thunk) expressions.

## Mounting `s.mount(...)`

The mount method is used to render elements and components. By default, sin will mount to `document.body`, but you can provide a specific element. Mount can be used to construct the DOM for your application.

```js
// Mounting to document.body
s.mount(() => s`h1`('Hello Sinner'))

// Mounting to a specific element
s.mount(
  document.querySelector('#sinner'),
  () => s`h1`('Hello Sinner')
)
```

You can provide runtime `attrs` and `context` to `s.mount` by passing reference data after component rendering behaviour directly on the mount method itself:

```js
// Passing pre-define attrs
s.mount(
  (attrs) => s`h1`(`${attrs.greet} Sinner`),
  { greet: 'Sinner' }
)

// Passing pre-define context
s.mount(
  (attrs, [], context) => s`h1`(`Hello ${context.name}`),
  {},
  { name: 'Sinner' }
)

// Passing both attrs and context
s.mount(({ greet }, [], { name }) =>
  s`h1`(`${greet} ${name}`),
  { greet: 'Hello' },
  { name: 'Sinner' }
)
```

# Components

Sin revolves around components and are core building blocks of a Sin application. They encapsulate structure, behavior, and styling in a single unit, and can be written as [stateless](#stateless-component-s--) functions, [stateful](#stateful-component-s----) components with internal data, or even [asynchronous](#async-component-s-loading-error--async---) components that resolve over time.

No matter which form they take, all components share a consistent signature and are designed to accept style overrides at the point of use. This means you can compose, extend, and restyle components freely without breaking their interface.


> The beauty of a Sin component model is that your usage stays the same even as the component evolves, a simple element today can grow into a stateful or async component tomorrow, without requiring changes at the callsite.

## Styled Component `s``(...)`

[![Flems](https://img.shields.io/badge/flems-sandbox-playground?labelColor=34454d&color=cdcdcd&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNSAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIzLjY2NCA5LjE2TDE4LjIxNiAzLjczNkMxOC4xMiAzLjYxNiAxNy45NTIgMy41NDQgMTcuODA4IDMuNTQ0SDE3LjEzNkMxNi4zMiAzLjU0NCAxNS41NzYgNC4wNzIgMTUuMzEyIDQuODY0TDE0LjI4IDcuOTZDMTQuMjA4IDguMiAxNC4zNzYgOC40NjQgMTQuNjQgOC40NjRIMTYuNDY0QzE2LjcyOCA4LjQ2NCAxNi44OTYgOC43MDQgMTYuODI0IDguOTQ0TDE2LjEwNCAxMS4xMjhDMTYuMDA4IDExLjM2OCAxNS43OTIgMTEuNTM2IDE1LjUyOCAxMS41MzZIMTMuNTM2QzEzLjI3MiAxMS41MzYgMTMuMDU2IDExLjcwNCAxMi45NiAxMS45NDRMMTEuNDk2IDE2LjM4NEMxMS4wNCAxNy43MjggMTAuMDMyIDE4Ljc2IDguNzU5OTkgMTkuMjRDOS4wMjM5OSAxOS41MjggOS4yNjM5OSAxOS41MjggOS40MzE5OSAxOS41MjhIMTQuNzEyQzE0Ljg4IDE5LjUyOCAxNS4wMjQgMTkuNDggMTUuMTQ0IDE5LjM2TDIzLjY2NCAxMC44NEMyNC4xMiAxMC4zODQgMjQuMTIgOS42MTYgMjMuNjY0IDkuMTZaTTkuNjk1OTkgMTIuMDRDOS43Njc5OSAxMS44IDkuNTc1OTkgMTEuNTM2IDkuMzM1OTkgMTEuNTM2SDcuNTM1OTlDNy4yOTU5OSAxMS41MzYgNy4xMjc5OSAxMS4yOTYgNy4xOTk5OSAxMS4wOEw3Ljk0Mzk5IDguODcyQzguMDE1OTkgOC42MDggOC4yMzE5OSA4LjQ2NCA4LjQ5NTk5IDguNDY0SDEwLjQ0QzEwLjcwNCA4LjQ2NCAxMC45MiA4LjI5NiAxMS4wMTYgOC4wNTZMMTIuNDggMy42MTZDMTIuOTEyIDIuMjcyIDEzLjk0NCAxLjI0IDE1LjIxNiAwLjc2QzE1LjEzMjkgMC42NjQ0NTcgMTUuMDI5MyAwLjU4ODkyNiAxNC45MTMgMC41MzkwNTRDMTQuNzk2NiAwLjQ4OTE4MyAxNC42NzA1IDAuNDY2MjYgMTQuNTQ0IDAuNDcySDkuMjg3OTlDOS4xNDM5OSAwLjQ3MiA4Ljk3NTk5IDAuNTIgOC44Nzk5OSAwLjY0TDAuMzU5OTkgOS4xNkMwLjI0ODIzNyA5LjI2OTUgMC4xNTk0NTYgOS40MDAxOSAwLjA5ODg0NzEgOS41NDQ0M0MwLjAzODIzNzkgOS42ODg2NiAwLjAwNzAxOTA0IDkuODQzNTUgMC4wMDcwMTkwNCAxMEMwLjAwNzAxOTA0IDEwLjE1NjUgMC4wMzgyMzc5IDEwLjMxMTMgMC4wOTg4NDcxIDEwLjQ1NTZDMC4xNTk0NTYgMTAuNTk5OCAwLjI0ODIzNyAxMC43MzA1IDAuMzU5OTkgMTAuODRMNS43ODM5OSAxNi4yNjRDNS45MDM5OSAxNi4zODQgNi4wNDc5OSAxNi40NTYgNi4xOTE5OSAxNi40NTZINi44Mzk5OUM3LjY1NTk5IDE2LjQ1NiA4LjM5OTk5IDE1LjkwNCA4LjY2Mzk5IDE1LjEzNkw5LjY5NTk5IDEyLjA0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==)](https://flems.io/https://gist.github.com/panoply/7b60cf8898c8d1f22dbdf6006b7b252a)

A **styled component** is the simplest type of component in Sin. It doesn’t contain logic or state, it only declares a tag and style/s that should apply to it. Styled components serve as the visual building blocks of your UI, providing reusable elements with consistent appearance. Because they carry no behavior, they are lightweight and easy to compose, and their styles can still be overridden wherever they are used.

```js
// Definition
const sinner = s`button
  p 10 15
  fs 15
  mr 10
  bc cyan
`

// Basic Usage
sinner({
  onclick: () => alert('Blasphemy!')
},
  'Hello Sinner!'
)

// Style Override
sinner`
  br 4
  border 1 solid
  color white
  bc hotpink
`({
  onclick: () => alert('Blasphemy!')
},
  'Hello Sinner!'
)
```

## Stateless Component `s(() => ...)`

[![Flems](https://img.shields.io/badge/flems-sandbox-playground?labelColor=34454d&color=cdcdcd&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNSAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIzLjY2NCA5LjE2TDE4LjIxNiAzLjczNkMxOC4xMiAzLjYxNiAxNy45NTIgMy41NDQgMTcuODA4IDMuNTQ0SDE3LjEzNkMxNi4zMiAzLjU0NCAxNS41NzYgNC4wNzIgMTUuMzEyIDQuODY0TDE0LjI4IDcuOTZDMTQuMjA4IDguMiAxNC4zNzYgOC40NjQgMTQuNjQgOC40NjRIMTYuNDY0QzE2LjcyOCA4LjQ2NCAxNi44OTYgOC43MDQgMTYuODI0IDguOTQ0TDE2LjEwNCAxMS4xMjhDMTYuMDA4IDExLjM2OCAxNS43OTIgMTEuNTM2IDE1LjUyOCAxMS41MzZIMTMuNTM2QzEzLjI3MiAxMS41MzYgMTMuMDU2IDExLjcwNCAxMi45NiAxMS45NDRMMTEuNDk2IDE2LjM4NEMxMS4wNCAxNy43MjggMTAuMDMyIDE4Ljc2IDguNzU5OTkgMTkuMjRDOS4wMjM5OSAxOS41MjggOS4yNjM5OSAxOS41MjggOS40MzE5OSAxOS41MjhIMTQuNzEyQzE0Ljg4IDE5LjUyOCAxNS4wMjQgMTkuNDggMTUuMTQ0IDE5LjM2TDIzLjY2NCAxMC44NEMyNC4xMiAxMC4zODQgMjQuMTIgOS42MTYgMjMuNjY0IDkuMTZaTTkuNjk1OTkgMTIuMDRDOS43Njc5OSAxMS44IDkuNTc1OTkgMTEuNTM2IDkuMzM1OTkgMTEuNTM2SDcuNTM1OTlDNy4yOTU5OSAxMS41MzYgNy4xMjc5OSAxMS4yOTYgNy4xOTk5OSAxMS4wOEw3Ljk0Mzk5IDguODcyQzguMDE1OTkgOC42MDggOC4yMzE5OSA4LjQ2NCA4LjQ5NTk5IDguNDY0SDEwLjQ0QzEwLjcwNCA4LjQ2NCAxMC45MiA4LjI5NiAxMS4wMTYgOC4wNTZMMTIuNDggMy42MTZDMTIuOTEyIDIuMjcyIDEzLjk0NCAxLjI0IDE1LjIxNiAwLjc2QzE1LjEzMjkgMC42NjQ0NTcgMTUuMDI5MyAwLjU4ODkyNiAxNC45MTMgMC41MzkwNTRDMTQuNzk2NiAwLjQ4OTE4MyAxNC42NzA1IDAuNDY2MjYgMTQuNTQ0IDAuNDcySDkuMjg3OTlDOS4xNDM5OSAwLjQ3MiA4Ljk3NTk5IDAuNTIgOC44Nzk5OSAwLjY0TDAuMzU5OTkgOS4xNkMwLjI0ODIzNyA5LjI2OTUgMC4xNTk0NTYgOS40MDAxOSAwLjA5ODg0NzEgOS41NDQ0M0MwLjAzODIzNzkgOS42ODg2NiAwLjAwNzAxOTA0IDkuODQzNTUgMC4wMDcwMTkwNCAxMEMwLjAwNzAxOTA0IDEwLjE1NjUgMC4wMzgyMzc5IDEwLjMxMTMgMC4wOTg4NDcxIDEwLjQ1NTZDMC4xNTk0NTYgMTAuNTk5OCAwLjI0ODIzNyAxMC43MzA1IDAuMzU5OTkgMTAuODRMNS43ODM5OSAxNi4yNjRDNS45MDM5OSAxNi4zODQgNi4wNDc5OSAxNi40NTYgNi4xOTE5OSAxNi40NTZINi44Mzk5OUM3LjY1NTk5IDE2LjQ1NiA4LjM5OTk5IDE1LjkwNCA4LjY2Mzk5IDE1LjEzNkw5LjY5NTk5IDEyLjA0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==)](https://flems.io/https://gist.github.com/panoply/32e1ada26743cc3d42b988a56f87b34e)

A **stateless component** is a pure function of its inputs. It receives an `attrs` object (props) and an array of children, and returns a view to render. Because it has no internal state, the output is entirely determined by the inputs, making it predictable and easy to reason about. Stateless components are ideal for encapsulating layout, presentation, or simple transformations of data, and they can be freely composed into larger structures. Like all Sin components, their styles remain overridable at the point of use.

```js
// Definition
const sinner = s`button
  p 10 15
  fs 15
  bc hotpink
  br 4
  border 1 solid
  color white
`

// Usage
const apostate = s(({ onclick, ...attrs }, children) =>
  sinner({
    ...attrs,
    onclick: e => {
      alert('Alert is blasphemy!')
      onclick(e)
    }
  },
    children
  )
)
```

## Stateful Component `s(() => () => ...)`

[![Flems](https://img.shields.io/badge/flems-sandbox-playground?labelColor=34454d&color=cdcdcd&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNSAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIzLjY2NCA5LjE2TDE4LjIxNiAzLjczNkMxOC4xMiAzLjYxNiAxNy45NTIgMy41NDQgMTcuODA4IDMuNTQ0SDE3LjEzNkMxNi4zMiAzLjU0NCAxNS41NzYgNC4wNzIgMTUuMzEyIDQuODY0TDE0LjI4IDcuOTZDMTQuMjA4IDguMiAxNC4zNzYgOC40NjQgMTQuNjQgOC40NjRIMTYuNDY0QzE2LjcyOCA4LjQ2NCAxNi44OTYgOC43MDQgMTYuODI0IDguOTQ0TDE2LjEwNCAxMS4xMjhDMTYuMDA4IDExLjM2OCAxNS43OTIgMTEuNTM2IDE1LjUyOCAxMS41MzZIMTMuNTM2QzEzLjI3MiAxMS41MzYgMTMuMDU2IDExLjcwNCAxMi45NiAxMS45NDRMMTEuNDk2IDE2LjM4NEMxMS4wNCAxNy43MjggMTAuMDMyIDE4Ljc2IDguNzU5OTkgMTkuMjRDOS4wMjM5OSAxOS41MjggOS4yNjM5OSAxOS41MjggOS40MzE5OSAxOS41MjhIMTQuNzEyQzE0Ljg4IDE5LjUyOCAxNS4wMjQgMTkuNDggMTUuMTQ0IDE5LjM2TDIzLjY2NCAxMC44NEMyNC4xMiAxMC4zODQgMjQuMTIgOS42MTYgMjMuNjY0IDkuMTZaTTkuNjk1OTkgMTIuMDRDOS43Njc5OSAxMS44IDkuNTc1OTkgMTEuNTM2IDkuMzM1OTkgMTEuNTM2SDcuNTM1OTlDNy4yOTU5OSAxMS41MzYgNy4xMjc5OSAxMS4yOTYgNy4xOTk5OSAxMS4wOEw3Ljk0Mzk5IDguODcyQzguMDE1OTkgOC42MDggOC4yMzE5OSA4LjQ2NCA4LjQ5NTk5IDguNDY0SDEwLjQ0QzEwLjcwNCA4LjQ2NCAxMC45MiA4LjI5NiAxMS4wMTYgOC4wNTZMMTIuNDggMy42MTZDMTIuOTEyIDIuMjcyIDEzLjk0NCAxLjI0IDE1LjIxNiAwLjc2QzE1LjEzMjkgMC42NjQ0NTcgMTUuMDI5MyAwLjU4ODkyNiAxNC45MTMgMC41MzkwNTRDMTQuNzk2NiAwLjQ4OTE4MyAxNC42NzA1IDAuNDY2MjYgMTQuNTQ0IDAuNDcySDkuMjg3OTlDOS4xNDM5OSAwLjQ3MiA4Ljk3NTk5IDAuNTIgOC44Nzk5OSAwLjY0TDAuMzU5OTkgOS4xNkMwLjI0ODIzNyA5LjI2OTUgMC4xNTk0NTYgOS40MDAxOSAwLjA5ODg0NzEgOS41NDQ0M0MwLjAzODIzNzkgOS42ODg2NiAwLjAwNzAxOTA0IDkuODQzNTUgMC4wMDcwMTkwNCAxMEMwLjAwNzAxOTA0IDEwLjE1NjUgMC4wMzgyMzc5IDEwLjMxMTMgMC4wOTg4NDcxIDEwLjQ1NTZDMC4xNTk0NTYgMTAuNTk5OCAwLjI0ODIzNyAxMC43MzA1IDAuMzU5OTkgMTAuODRMNS43ODM5OSAxNi4yNjRDNS45MDM5OSAxNi4zODQgNi4wNDc5OSAxNi40NTYgNi4xOTE5OSAxNi40NTZINi44Mzk5OUM3LjY1NTk5IDE2LjQ1NiA4LjM5OTk5IDE1LjkwNCA4LjY2Mzk5IDE1LjEzNkw5LjY5NTk5IDEyLjA0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==)](https://flems.io/https://gist.github.com/panoply/2bbf9b783cbacdb2feefb956ccd09109)

A **stateful component** extends the stateless model by maintaining its own internal data across renders but will retain its state across redraws and expects a function callback return signature. It still accepts an attributes object and an array of children, but it can also track state, respond to events, and trigger redraws. This makes stateful components well-suited for interactive UI elements such as inputs, menus, or toggles. Even with added complexity, they preserve the same callsite signature and allow styles to be overridden wherever they are used.

```js
// Definition
const sinner = s`button
  p 10 15
  fs 15
  bc hotpink
  br 4
  border 1 solid
  color white
`

const example = s(() => {

  let count = 0

  return () => sinner({
    onclick: () => count++
  },
    count === 0
    ? 'You are sinless!'
    : `You've committed ${count} sin${count > 1 ? "s" : ""}!`
  )
})
```

> [!NOTE]
> You can access `attrs`, `children` and `state` arguments in the closure callback function. The arguments available to the callback can be used to avoid stale data references.


## Async Component `s({ loading, error }, async () => ...)`

[![Flems](https://img.shields.io/badge/flems-sandbox-playground?labelColor=34454d&color=cdcdcd&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNSAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIzLjY2NCA5LjE2TDE4LjIxNiAzLjczNkMxOC4xMiAzLjYxNiAxNy45NTIgMy41NDQgMTcuODA4IDMuNTQ0SDE3LjEzNkMxNi4zMiAzLjU0NCAxNS41NzYgNC4wNzIgMTUuMzEyIDQuODY0TDE0LjI4IDcuOTZDMTQuMjA4IDguMiAxNC4zNzYgOC40NjQgMTQuNjQgOC40NjRIMTYuNDY0QzE2LjcyOCA4LjQ2NCAxNi44OTYgOC43MDQgMTYuODI0IDguOTQ0TDE2LjEwNCAxMS4xMjhDMTYuMDA4IDExLjM2OCAxNS43OTIgMTEuNTM2IDE1LjUyOCAxMS41MzZIMTMuNTM2QzEzLjI3MiAxMS41MzYgMTMuMDU2IDExLjcwNCAxMi45NiAxMS45NDRMMTEuNDk2IDE2LjM4NEMxMS4wNCAxNy43MjggMTAuMDMyIDE4Ljc2IDguNzU5OTkgMTkuMjRDOS4wMjM5OSAxOS41MjggOS4yNjM5OSAxOS41MjggOS40MzE5OSAxOS41MjhIMTQuNzEyQzE0Ljg4IDE5LjUyOCAxNS4wMjQgMTkuNDggMTUuMTQ0IDE5LjM2TDIzLjY2NCAxMC44NEMyNC4xMiAxMC4zODQgMjQuMTIgOS42MTYgMjMuNjY0IDkuMTZaTTkuNjk1OTkgMTIuMDRDOS43Njc5OSAxMS44IDkuNTc1OTkgMTEuNTM2IDkuMzM1OTkgMTEuNTM2SDcuNTM1OTlDNy4yOTU5OSAxMS41MzYgNy4xMjc5OSAxMS4yOTYgNy4xOTk5OSAxMS4wOEw3Ljk0Mzk5IDguODcyQzguMDE1OTkgOC42MDggOC4yMzE5OSA4LjQ2NCA4LjQ5NTk5IDguNDY0SDEwLjQ0QzEwLjcwNCA4LjQ2NCAxMC45MiA4LjI5NiAxMS4wMTYgOC4wNTZMMTIuNDggMy42MTZDMTIuOTEyIDIuMjcyIDEzLjk0NCAxLjI0IDE1LjIxNiAwLjc2QzE1LjEzMjkgMC42NjQ0NTcgMTUuMDI5MyAwLjU4ODkyNiAxNC45MTMgMC41MzkwNTRDMTQuNzk2NiAwLjQ4OTE4MyAxNC42NzA1IDAuNDY2MjYgMTQuNTQ0IDAuNDcySDkuMjg3OTlDOS4xNDM5OSAwLjQ3MiA4Ljk3NTk5IDAuNTIgOC44Nzk5OSAwLjY0TDAuMzU5OTkgOS4xNkMwLjI0ODIzNyA5LjI2OTUgMC4xNTk0NTYgOS40MDAxOSAwLjA5ODg0NzEgOS41NDQ0M0MwLjAzODIzNzkgOS42ODg2NiAwLjAwNzAxOTA0IDkuODQzNTUgMC4wMDcwMTkwNCAxMEMwLjAwNzAxOTA0IDEwLjE1NjUgMC4wMzgyMzc5IDEwLjMxMTMgMC4wOTg4NDcxIDEwLjQ1NTZDMC4xNTk0NTYgMTAuNTk5OCAwLjI0ODIzNyAxMC43MzA1IDAuMzU5OTkgMTAuODRMNS43ODM5OSAxNi4yNjRDNS45MDM5OSAxNi4zODQgNi4wNDc5OSAxNi40NTYgNi4xOTE5OSAxNi40NTZINi44Mzk5OUM3LjY1NTk5IDE2LjQ1NiA4LjM5OTk5IDE1LjkwNCA4LjY2Mzk5IDE1LjEzNkw5LjY5NTk5IDEyLjA0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==)](https://flems.io/https://gist.github.com/panoply/4e3e517c8384a384de9b72a74665a7ea)

An **asynchronous component** is designed to handle values that resolve over time. Instead of rendering immediately, it can return a Promise that resolves to a view once data or resources are ready. This allows you to defer rendering until an API call completes, a module loads, or some other async operation finishes. As with other component types, async components share the same usage pattern and can be styled or extended without changing how they are called.

```js
// Definition
const judgement = s(
  {
    loading: sinner('Seeking Atonement...'),
    error: e => sinner(`There was an error: ${e}`)
  },
  async () => {
    await s.sleep(3000)
    return async () => sinner('Sins Forgiven!')
  }
)
```

## DAFT

DAFT (Default Argument Function Thunk) is a signature pattern unique to Sin components that lets you declare scope-level variables as default arguments in your render functions. Instead of re-declaring the same values inside your component body, DAFT allows you to express them inline at the signature level, keeping the code more concise and easier to read.

```js
s((attrs, children, context) => () =>
  s`h1`(
    (
      d = 'Default',
      a = 'Argument',
      f = 'Function',
      t = 'Thunk'
    ) => [
      'Sin Has ',d,a,f,t
    ]
  )
)
```

# CSS

Element styling can be expressed inline and allows for expressive cascades to be applied. The `:` and `;` are optional for single line definitions. No more bloated syntax.

```js
s`span
  font-size 16px
  text-decoration underline
  color pink
`
```

> [!NOTE]
> It's not possible to mix shorthand and standard styling conventions `:` and `;` you will lose the lean sintax (shorthand, implict unit)
>
> ```diff
> +  font-size 16
> +  fs 16
> +  font-size: 16;
> -  fs: 16;
> -  font-size: 16
> -  font-size 16;
> ```


## Styles  ```s.css`` ```

The `s.css` method can be used to define stylesheet/s and global styling that can be used anywhere in your application.

```css
s.css`
  /* your global stylesheet here */
`
```

## Resets ```s.css.reset`` ```

To reduce browser inconsistencies you can use the opinionated css reset style rules when writing your global CSS.

```js
s.css.reset`
  /* your global reset here */
`
```

<details>
<summary>
<strong>Sin Defaults</strong>
</summary>
<p>
Sin applies a very minimal default CSS reset, that includes:
</p>


```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

input,
button,
textarea,
select {
  font: inherit;
  text-transform: none;
}

* {
  margin: 0;
  padding: 0;
  overflow-wrap: break-word;
  hyphens: auto;
}

body {
  font-family: system-ui, sans-serif;
  min-height: 100svh;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

p {
  line-height: 1.5;
}

img, svg, video, canvas, audio, iframe, embed, object {
  display: block;
  vertical-align: middle;
}

img, video {
  max-width: 100%;
  height: auto;
}

ol, ul, li {
  list-style: none;
}
```

</details>

## Units

Sin supports all standard CSS units (px, em, rem, %, vw, vh, etc.) when explicitly defined, but also provides implicit unit handling for convenience. Pixel units are favored for implicit usage and Sin will automatically append `px` to numeric values where appropriate, unless the relevant css property takes a unitless value.

```js
s`span
  font-size 16
  width 200
  height 600
`
```

> [!NOTE]
> Implicit units will not be applied to properties that accept unitless values, such as `line-height`, `opacity`, `z-index`, etc and variable definitions require explicit units to be applied.

## Variables `$variable`

Sin provides support for CSS variables with the `$` prefix syntax. Variables can be defined globally using `s.css` or locally within components. They can be referenced throughout your styles, allowing for consistent theming and easy updates.

```css
s.css`
  :root {
    $red tomato
    $white #fff
  }
`
```

We can reference, overwrite and even create variables on the component (element) level, like so:

```js
const styling = s`
  $pink hotpink
  $size 200
`(
  s`p
    bc $white
    c $pink
    w $size
  `(
    'Paragraph has 200px width, font color hotpink and background white!'
  )
)

// Overriding variables at callsite
styling`
  $pink deeppink
  $size 300
`
```

## Interpolation `${...}`

You can interpolate JavaScript values directly into your CSS using `${...}` syntax. This allows you to dynamically set styles based on variables, functions, or any other JavaScript expression. You can access the current component dom within the interpolation via function callback.

```js
// Interpolating Values
s`
  w ${ window.innerWidth / 2}
  h ${ window.innerHeight / 2}
`

// Acessing Component DOM
s`
  max-height ${ dom => dom.scrollHeight }
`
```

## Alias `s.css.alias({...})`

The `s.css.alias` method allows you to define aliases for media queries that you can later use in your CSS. Aliases will also be made available to `s.is.*` and will reflect breakpoint changes via MatchMedia API.

```js
// Definition
s.css.alias({
  mobile: '@media (max-width: 767.98px)',
  tablet: '@media (max-width: 1200px)',
  desktop: '@media (min-width: 1500px)',
  ios: '@supports (-webkit-touch-callout: none)'
})

// Usage
s`
  @mobile {
   display none
  }
`('Not visible on mobile devices...')

```

### Shorthands

The most popular CSS properties can be references by its initials. A few popular properties have overlapping initials, Sin choose to support the most commonly used.

<details>
<summary>See list of abbreviations</summary>


| abbreviation | keyword               |
| ------------ | --------------------  |
| ai           | align-items           |
| b            | bottom                |
| bc           | background-color      |
| bg           | background            |
| bf           | backdrop-filter       |
| br           | border-radius         |
| bs           | box-shadow            |
| bi           | background-image      |
| c            | color                 |
| d            | display               |
| fg           | flex-grow             |
| fb           | flex-basis            |
| f            | float                 |
| fd           | flex-direction        |
| ff           | font-family           |
| fs           | font-size             |
| fw           | font-weight           |
| g            | gap                   |
| ga           | grid-area             |
| gg           | grid-gap              |
| gta          | grid-template-areas   |
| gtc          | grid-template-columns |
| gtr          | grid-template-rows    |
| h            | height                |
| jc           | justify-content       |
| l            | left                  |
| lh           | line-height           |
| ls           | letter-spacing        |
| m            | margin                |
| mb           | margin-bottom         |
| ml           | margin-left           |
| mr           | margin-right          |
| mt           | margin-top            |
| o            | opacity               |
| p            | padding               |
| pb           | padding-bottom        |
| pl           | padding-left          |
| pr           | padding-right         |
| pt           | padding-top           |
| pi           | place-items           |
| pe           | pointer-events        |
| r            | right                 |
| t            | top                   |
| ta           | text-align            |
| td           | text-decoration       |
| tt           | text-transform        |
| ts           | text-shadow           |
| us           | user-select           |
| ws           | white-space           |
| w            | width                 |
| zi           | z-index               |
| z            | zoom                  |


</details>

## Routing `s.route(...)`

Sin includes the most `get out of your way` router possible. There is always a scoped router available in context which let's you implement routing (as nested as you like) — not being concerned about the mount point. Using `href` is highly encouraged and the default way of telling Sin to route away. Every sin `route` instance even has a sweet .toString method, so you can simply do `href: route + 'sub-page'`. You can also use `route.has()` if you want to highlight which route is active, and if that's too boring Sin sets an `[active]` attribute for you to use for styling.

```js
s.mount(({ route }) => [
  s`nav`(
    ['/', '/murray', '/lysander', '/profile'].map(x =>
      s`a
        background ${ route.has(path) && 'lightblue' }
      `({
        href: '/' + x
      },
        x.slice(1) || 'Home'
      )
    )
  ),
  s`main`(
    route({
      '/': () => 'Welcome to the world',
      '/:user': ({ user }) => 'You are checking out ' + user,
      '/profile': () => 'The glory of you'
    })
  )
])
```

### Target

For any ``s`a`({ href: "/my/route" }, ...)`` tag, Sin will automatically hook it into `history.pushState` routing. However, if you don't want this behavior (e.g to hit your `/oauth/github` backend route), just add a `target: '_self'` attribute to your anchor tag.

## Live `s.live`

The `s.live` method creates reactive streams that automatically update the UI when their values change. These streams are versatile, supporting numbers, strings, objects, and more. They can be observed, transformed, and used to drive dynamic behavior.

```js
const live = s.live()
live.value                                   // Current value of the stream
live.valueOf()                               // Coerce value for operations (e.g., arithmetic for numbers)
live.toJSON()                                // JSON serialization
live.toString()                              // String representation
live.get('')                                 // Derive a new a stream from a property
live.get(((value) => {})                     // or function
live.set()                                   // Set the value directly or via a function
live.observe((new, old, detach) => {})       // Observe value changes, returns unsubscribe function
live.detach()                                // Detach all observers
live.reduce((acc, value, i) => {}, initial)  // Reduce values into a new stream
live.if(equals, isTrue, isFalse)             // Conditional value based on equality
```

> [!WARNING]
> Use `s.live` with consideration and avoid composing streams with large or complex datasets to prevent performance bottlenecks and putting strain on the auto-redraw system.


## HTTP `s.http`

The `s.http` method perform HTTP requests with minimal boilerplate. Built on top of XMLHttpRequest, it offers a promise-based interface for asynchronous operations, supporting common HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD) and customizable request configurations.

```js
const status = { loaded: 0, total: 0 }
const x = (await s.http.put('/url', {
  body: file,
  responseType: 'text',
  config: xhr => xhr.upload.addEventListener('progress', e => {
    status.loaded = e.loaded
    status.total = e.total
    s.redraw()
  })
}).xhr).getResponseHeader('ETag').slice(1, -1)
```

### Request Methods

```js
s.http({})
s.http('/url', {})
s.http.get({})
s.http.put({})
s.http.post({})
s.http.patch({})
s.http.delete({})
s.http.head({})
```

### Request Options

All the standard configuration options for HTTP requests are avaiable, with additional sin specifics.

```js
s.http({
  url: '',                  // Request URL, can also be defined as first argument
  method: 'GET',            // HTTP method 'HEAD' | 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH'
  redraw: true,             // Trigger redraw after resolution
  responseType: 'json',     // '' | 'arraybuffer' | 'blob' | 'document' | 'json' | 'text'
  query: {},                // Query parameters (default: {})
  body: undefined,          // Request body data (default: undefined)
  user: undefined,          // Username for HTTP authorization (default: undefined)
  pass: undefined,          // Password for HTTP authorization (default: undefined, avoid due to plaintext)
  headers: {},              // Request headers (default: {})
  timeout: 0,               // Request timeout in milliseconds (default: 0, no timeout)
  config: (xhr) => {},      // Custom XMLHttpRequest configuration
})
```

# DOM Helpers

Sin provides dom helper methods that can be used to improve interfacing on the element and component level.

## is `s.is.<alias>`

The `s.is.*` object contains read-only getter/setter references assigned at runtime. Entries on `s.is` will return a `boolean` of either `true` or `false` and maintained internally by Sin.

```js
// Whether or not code is executing on server.
s.is.server

// All CSS Aliases are exposed on s.is
s.is.mobile
s.is.tablet
s.is.desktop
```


## isAttrs `s.isAttrs(value)`

The `s.isAttrs` function is a type guard that distinguishes whether a given value should be interpreted as a component's `attrs` object. Since the `s(...)` component signature is highly flexible, the first argument can be either attributes or children. This  helper function ensures that Sin knows how to interpret what you've passed in.

```js
s.isAttrs({ id: 'foo', class: 'bar' })   // -> true
s.isAttrs(s`div`())                      // -> false
s.isAttrs(document.createElement('p'))   // -> false
s.isAttrs([1,2,3])                       // -> false
```

> This check is performed internally when rendering, but it iss also useful in custom utility code or when building higher-order components.

## on `s.on(target, event, handler, options?)`

[![Flems](https://img.shields.io/badge/flems-sandbox-playground?labelColor=34454d&color=cdcdcd&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNSAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIzLjY2NCA5LjE2TDE4LjIxNiAzLjczNkMxOC4xMiAzLjYxNiAxNy45NTIgMy41NDQgMTcuODA4IDMuNTQ0SDE3LjEzNkMxNi4zMiAzLjU0NCAxNS41NzYgNC4wNzIgMTUuMzEyIDQuODY0TDE0LjI4IDcuOTZDMTQuMjA4IDguMiAxNC4zNzYgOC40NjQgMTQuNjQgOC40NjRIMTYuNDY0QzE2LjcyOCA4LjQ2NCAxNi44OTYgOC43MDQgMTYuODI0IDguOTQ0TDE2LjEwNCAxMS4xMjhDMTYuMDA4IDExLjM2OCAxNS43OTIgMTEuNTM2IDE1LjUyOCAxMS41MzZIMTMuNTM2QzEzLjI3MiAxMS41MzYgMTMuMDU2IDExLjcwNCAxMi45NiAxMS45NDRMMTEuNDk2IDE2LjM4NEMxMS4wNCAxNy43MjggMTAuMDMyIDE4Ljc2IDguNzU5OTkgMTkuMjRDOS4wMjM5OSAxOS41MjggOS4yNjM5OSAxOS41MjggOS40MzE5OSAxOS41MjhIMTQuNzEyQzE0Ljg4IDE5LjUyOCAxNS4wMjQgMTkuNDggMTUuMTQ0IDE5LjM2TDIzLjY2NCAxMC44NEMyNC4xMiAxMC4zODQgMjQuMTIgOS42MTYgMjMuNjY0IDkuMTZaTTkuNjk1OTkgMTIuMDRDOS43Njc5OSAxMS44IDkuNTc1OTkgMTEuNTM2IDkuMzM1OTkgMTEuNTM2SDcuNTM1OTlDNy4yOTU5OSAxMS41MzYgNy4xMjc5OSAxMS4yOTYgNy4xOTk5OSAxMS4wOEw3Ljk0Mzk5IDguODcyQzguMDE1OTkgOC42MDggOC4yMzE5OSA4LjQ2NCA4LjQ5NTk5IDguNDY0SDEwLjQ0QzEwLjcwNCA4LjQ2NCAxMC45MiA4LjI5NiAxMS4wMTYgOC4wNTZMMTIuNDggMy42MTZDMTIuOTEyIDIuMjcyIDEzLjk0NCAxLjI0IDE1LjIxNiAwLjc2QzE1LjEzMjkgMC42NjQ0NTcgMTUuMDI5MyAwLjU4ODkyNiAxNC45MTMgMC41MzkwNTRDMTQuNzk2NiAwLjQ4OTE4MyAxNC42NzA1IDAuNDY2MjYgMTQuNTQ0IDAuNDcySDkuMjg3OTlDOS4xNDM5OSAwLjQ3MiA4Ljk3NTk5IDAuNTIgOC44Nzk5OSAwLjY0TDAuMzU5OTkgOS4xNkMwLjI0ODIzNyA5LjI2OTUgMC4xNTk0NTYgOS40MDAxOSAwLjA5ODg0NzEgOS41NDQ0M0MwLjAzODIzNzkgOS42ODg2NiAwLjAwNzAxOTA0IDkuODQzNTUgMC4wMDcwMTkwNCAxMEMwLjAwNzAxOTA0IDEwLjE1NjUgMC4wMzgyMzc5IDEwLjMxMTMgMC4wOTg4NDcxIDEwLjQ1NTZDMC4xNTk0NTYgMTAuNTk5OCAwLjI0ODIzNyAxMC43MzA1IDAuMzU5OTkgMTAuODRMNS43ODM5OSAxNi4yNjRDNS45MDM5OSAxNi4zODQgNi4wNDc5OSAxNi40NTYgNi4xOTE5OSAxNi40NTZINi44Mzk5OUM3LjY1NTk5IDE2LjQ1NiA4LjM5OTk5IDE1LjkwNCA4LjY2Mzk5IDE1LjEzNkw5LjY5NTk5IDEyLjA0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==)](https://flems.io/https://gist.github.com/panoply/c662596e14c94ca238ea063754cfad9b)


The `s.on` function simplifies attaching and cleaning up DOM Event listeners. It wraps `addEventListener` and `removeEventListener` with a functional API that fits naturally into Sin's component lifecycle. The helper returns a function that can be used as a dom hook inside components, or called manually

```js
// Attach via dom hook
s`pre`({
  dom: s.on(window, 'keydown', (event, dom) => {
    dom.append(`Pressed: ${event.key}`)
  })
})

// Manual usage
const detach = s.on(button, 'click', () => alert('hi'))()
detach() // -> Remove the listener
```

> Invoking the returned function attaches the event listener, and it returns a cleanup function that will detach the listener.

## event `s.event(dom, event, handler, options)`

The `s.event` helpers creates a lightweight, reactive event bus. Instead of wiring up custom Pub/Sub systems or external libraries, you can use `s.event` to manage internal signals that any number of consumers can listen to. An `s.event` instance returns a function you can invoke like a normal callback, that when called, synchronously dispatches to all observers that have been registered.

```js
const listen = s.event()

listen.observe(() => console.log("Called"))
listen.observe(() => console.log("Called Once"), true)

listen()  // -> Both observers will trigger
listen()  // -> First observer will trigger
listen()  // -> First observer will trigger
```

Each event instance also exposes a `.signal` getter which can be used to produce an AbortSignal that will abort once the event fires, making it easy to integrate with DOM APIs like `fetch` or `addEventListener` that support cancellation. You can also pass data via triggers

```js
const reload = s.event(x => console.log(x)) // -> Logs s, i and n

reload.observe(x => console.log(x ? "Trigger" : "Reloaded!"))

reload('s') // -> Trigger
reload('i') // -> Trigger
reload('n') // -> Trigger

fetch('/api', { signal: reload.signal }) // -> Integration with AbortController APIs
```

## animate `s.animate(dom)`

The `s.animate` helper gives you a minimal way to trigger entry/exit transitions on DOM nodes. It works by setting an animate attribute on the element, letting you define transitions in CSS, and then automatically cleaning up after the animation frame has advanced.

```js
s`
  opacity 1
  transform translateY(0)
  transition opacity 200ms, transform 200ms

  [animate=entry] {
    opacity 0
    transform translateY(10)
    transition opacity 200ms, transform 200ms
  }
  [animate=exit] {
    opacity 0
    transform translateY(-10)
  }
`({
  dom: s.animate  // -> Passing to dom
})
```

> The helper works by setting an `[animate="entry"]` attribute to trigger CSS entry styles, removes it on the next frame, and returns a function that (with deferrable) sets `[animate="exit"]` and waits for exit transitions before removal.

## `p(...)`

Sin has `p()` available in **globalThis** context which is a great log helper. Unlike native `console.*` methods, `p` is designed as a pass-through interceptor and returns the last known value.

```js
// The numbers called within p() will be returned and also logged to console

const x = 333 + p('x', 333) // logs "x 333" and returns 333
const v = p(x) / 2          // v will equal 333
```

# Trust ```s.trust`` ```

Forgiving HTML or SVG strings into unescaped HTML or SVG.

```js
s.trust`<small>In the den of Sin</small>`   // Literal Expression
s.trust(`<h1>Woe to the wicked!</h1>`)      // Function Expression
```


# TypeScript Support

Sin includes robust TypeScript definitions that fully support its flexible, dynamic architecture. These types help capture the framework's unique features, such as component signatures and reactive elements. You can apply types using generics (e.g., `s<{}, [], {}>`) directly on the `s` function or via the `s.Component<{}, [], {}>` utility for defining components. The [`sin.d.ts`](/sin.d.ts) file provides the complete type system for Sin, which your editor's TypeScript Language Server will detect automatically for IntelliSense and type safety.

> [!NOTE]
> Sin's type definitions build on a customized variation of `lib.dom.d.ts`, tailored specifically for Sin's patterns. They offer precise type narrowing for attributes and elements, complete with JSDoc annotations that include descriptive explanations and direct links to MDN documentation for deeper reference.

## Omitted Function Methods

Sin applies function augmentation, which causes IntelliSense completions to include native function methods such as `apply`, `call`, `caller`, `arguments`, `name`, `length`, and `prototype` properties which introduce unwanted clutter and noise in auto-complete suggestions. To address this, wherever function augmentation applies in Sin, native methods are assigned a `never` type and annotated with a `@deprecated` JSDoc tag, indicating they should not be used in Sin's context and tricking IntelliSense to deprioritize them in suggestions.

There is no direct way to exclude these methods as its a limitation of TypeScript itself. Although this is a cheap-hack tactic, it ensures that these non-applicable methods will appear last in IntelliSense suggestions and prevents them from polluting auto-completion results.

> [!NOTE]
> If you are using VSCode, you can set the `editor.suggest.showDeprecated` option to `false`, to fully hide these native methods. If you are using **Zed**, no equivalent setting exists to suppress deprecated suggestions.

## Leveraging Generics

For TypeScript users, Sin offers generic typing to specify attributes (`attrs`), child elements (`children`), and component-level context (`context`) when invoking the `s` function. All generics are optional, allowing you to add type hints progressively without disrupting your workflow.

```ts
import s from 'sin'

s('div', {}, ...[])                                // HyperScript auto-types element
s<HTMLElement>``({}, ...[])                        // Generics for Styled Components
s<attrs, children>(({}, []) => [])                 // Generics for Stateless Component
s<attrs, children, context>(({},[],{}) => [])      // Generics for Stateful Component
s<attrs, children, context>({}, ({},[],{}) => [])  // Generics for Async Component
```

> This approach ensures type safety across component definitions, making it easier to catch errors early while preserving Sin's concise syntax.

## Declaration Merging

Sin supports global interface merging for `s.is.*` properties and component `context`. This lets you extend the framework with project-specific types, providing seamless access to custom references throughout your codebase. Simply extend the relevant interfaces in a `.d.ts` file (or directly in `.ts` files for TypeScript projects):

```ts
declare global {
  interface is {
    foo: boolean;
    bar: boolean;
  }
  interface context {
    baz: string;
    qux: { a: boolean; }
  }
}
```

Once declared, these extensions become available globally, enhancing type consistency and developer experience in larger applications. You can now access `s.is.foo`, `s.is.bar`, `context.baz`, and `context.qux` with full type safety in your Sin components.

```ts
// IS Completions
s.is.foo;  // -> boolean
s.is.bar;  // -> boolean

// Context Completions
s({}, [], { baz, qux }) => {
  p(s.is.foo);  // -> boolean
  p(s.is.bar);  // -> boolean
  p(baz);       // -> string
  p(qux.a);     // -> boolean
}
```

## DOM Global

The global `DOM` type serves as an alternative to `HTMLElement` and represents virtual DOM elements. It provides an interface that inherits all attributes of a DOM element, enabling its use whenever you need to access, reference or interface with all attibute element properties.

## Annotation Typing

For developers who prefer explicit type annotations, Sin provides the `s.Component<>` utility for component typing. This utility automatically detects component signatures and infers the appropriate types for attributes, children, and context, providing type safety without sacrificing Sin's concise syntax. Whether you're working with styled, stateless, or stateful components, `s.Component<>` simplifies the process of defining types directly on your component instances.

```ts
// Example for stateless or stateful component
const a: s.Component<{ name: string[] }, [], {}> = s((attrs, children, context) => {
  // Component logic here
  return s`div`(attrs, children);
});

// Example for styled component
const b: s.Component<HTMLButtonElement> = s`button`({
  onclick: () => alert('Sinner!')
}, 'Sinner!');
```

> This approach allows you to explicitly declare component types, making your code more self-documenting and easier to maintain, especially in larger TypeScript projects where type clarity is critical.


### Type Utilities

If you prefer annotation-style typing or need reusable helpers, Sin exposes a suite of type utilities under the `s.*` namespace. These can be applied in various scenarios to enforce stricter typing for components, events, and more:

```ts
s.DOM                                                 // Extended HTMLElement
s.Component<HTMLElement>                              // Styled Component Utility
s.Component<HTMLElement, Attrs, Children, Context>    // Merges Element attributes with Attrs Utility
s.Component<Attrs, Children, Context>                 // Stateless and Stateful Utility
s.Context<Attrs>                                      // Merges Component Context
s.View<Attrs>                                         // Merges attrs in Component View
s.Event<HTMLElement, Event, Attrs>                    // Sin Event Listener
s.Nodes                                               // Sin Component Nodes
s.Node                                                // Sin Component Node
s.Child                                               // Sin Component Child
s.Children                                            // Sin Component Children
s.Daft                                                // Sin Component DAFT
s.Primitive                                           // Sin Component Primitives
```

The `s.Component` utility is an intelligent type constructor that adapts based on the provided generics. When only the `HTMLElement` type is specified, it infers a styled component. When `Attrs`, `Children`, and `Context` are provided, it infers a stateless or stateful component accordingly. Majority of use-cases can be covered using this single utility, as it will perform narrowing and merging based on the generics you provide, understanding primitive types, DAFT signatures, and more.

> These utilities streamline complex type scenarios, such as event handling or context merging, while integrating smoothly with Sin's core APIs.

### Attrs Sorting in IntelliSense

When using the `s.Component<>` type utility, HTMLElement merging with custom `Attrs` will not sort custom attrs before HTMLElement attributes. This is due to TypeScript's handling of intersection types, which does not guarantee order preservation. As a result, native HTMLElement attributes may appear before or after custom attributes in auto-complete lists. You can mitigate this by defining custom `Attrs` as non-optional properties:

```ts
s.Component<HTMLElement, { foo?: string }>   // -> 'foo' will not appear first
s.Component<HTMLElement, { foo: string }>    // -> 'foo' will appear first
```

This approach helps ensure that your custom attributes are prioritized in IntelliSense suggestions, however it will result in the loss of optional typing for those attributes and the TypeScript compiler will complain if they are not provided. You can also exlude HTMLElement merging entirely to retain sorting:

```ts
s.Component<{ foo?: string }>                 // -> 'foo' will appear first
```

This would result in losing HTMLElement attribute typings, but guarantees that your custom attributes are prioritized in IntelliSense suggestions. Whichever approach you choose, be aware of this limitation when working with `s.Component<>` in TypeScript.


# CLI

Each installation of sin ships with an all-in-one command-line interface. The Sin CLI is designed to accelerate web development using a unified, dependency-free high-performance toolkit. Its built-in features reduce reliance on third-party solutions and provide you with all the necessary tooling to create powerfull web applications using sin.

### Whats Included

- Project Generation
- Development Sever
- HOT Module Reloading
- Package Management
- Testing Framework

> Development leverages the devtools protocol and sin ships with chromium extension enhancements.

## Commands

```bash
sin acme        # Acme certification control
sin build       # Build sin
sin create      # Create a new sin project
sin develop     # Develop mode, launches chrome instance
sin generate    # Generator
sin test        # Sin testing framework
sin help        # Sin help screen
sin purge       # Purges dependencies
sin remove      # Uninstall a dependency
sin start       # Start localhst server
sin version     # Prints the current sin version
sin install     # Install a dependency
sin unlink      # unlink a dependency
sin link        # link a dependency
sin run         # Run a package.json script
```

## Package Manager

Sin ships with a high-performance, low-level package management solution integrated directly into the `sin` binary for dependency and project management. You can use sin to install, link, and remove dependencies from the NPM registry or within your local project mono-repository.

### Dependency Management

Dependencies can be managed via the command-line. You can install modules globally, as development dependencies using the standard `-g, --save-dev` flags as you do with NPM.

```bash
sin install <package> --flags   # Install a package from the NPM registry
sin remove  <package> --flags   # Remove an installed package from your project
sin link    <package> --flags   # Symlinks a local package in your project
sin unlink  <package> --flags   # Removes a linked package within your project
```

> Sin generates a `sin.lock` file in the root of your project which contains lock references for dependency management.


# Testing

Sin provides testing framework through its `sin/test` module. The testing system leverages tagged template literals, allowing you to write expressive and readable JavaScript test cases that are evaluated by the sin `test` binary.

### Writing Tests

The test module exports a default function that uses syntax you're familar with to define test cases. This approach allows you to write JavaScript code that can be dynamically evaluated by the sin test binary. Each test case returns an array containing the **actual** and **expected** outputs for comparison.

```js
import s from 'sin';
import t from 'sin/test';

t`Example`(() => {
  const actual = '<h1>actual</h1>';
  const expect = s.trust`<h1>expect</h1>`;
  return [actual, expect];
});
```

### Running Tests

Sin provides a simple command-line interface to execute your tests using the test binary. You can run tests in a specific file or execute them in a headless browser for testing browser-specific functionality.

```bash
sin test <path>             # Executes all tests within the specified file
sin test <path> --headless  # Executes tests in a headless browser environment.
```
