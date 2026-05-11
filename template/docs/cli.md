# CLI

Cos ships with an all-in-one command-line interface. The CLI handles development, bundling, and project generation.

### What's Included

- Project Generation
- Development Server
- Hot Module Reloading
- Testing Framework

## Commands

```bash
cos build       # Build for production
cos create      # Create a new project
cos develop     # Development mode with hot reload
cos generate    # Generate static HTML
cos start       # Start production server
cos test        # Run tests
cos purge       # Clear cached projects
cos help        # Help screen
cos version     # Print current version
```

Commands can be abbreviated to their first letter (e.g., `cos d` for `cos develop`).

Dependencies are managed with npm:

```bash
npm install <package>
```

## Testing

Cos provides a testing framework through its `cos/test` module. The testing system uses tagged template literals for expressive test cases.

### Writing Tests

```js
import s from 'cos'
import t from 'cos/test'

t`Example`(() => {
  const actual = '<h1>actual</h1>'
  const expect = s.trust`<h1>expect</h1>`
  return [actual, expect]
})
```

### Running Tests

```bash
cos test <path>             # Execute all tests in the specified file
cos test <path> --headless  # Execute tests in a headless browser
```
