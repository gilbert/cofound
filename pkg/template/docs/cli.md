# CLI

Cofound ships with an all-in-one command-line interface. The CLI handles development, bundling, and project generation.

### What's Included

- Project Generation
- Development Server
- Hot Module Reloading
- Testing Framework

## Commands

```bash
cofound build       # Build for production
cofound create      # Create a new project
cofound develop     # Development mode with hot reload
cofound generate    # Generate static HTML
cofound start       # Start production server
cofound test        # Run tests
cofound purge       # Clear cached projects
cofound help        # Help screen
cofound version     # Print current version
```

Commands can be abbreviated to their first letter (e.g., `cofound d` for `cofound develop`).

Dependencies are managed with npm:

```bash
npm install <package>
```

## Testing

Cofound provides a testing framework through its `cofound/test` module. The testing system uses tagged template literals for expressive test cases.

### Writing Tests

```js
import s from 'cofound'
import t from 'cofound/test'

t`Example`(() => {
  const actual = '<h1>actual</h1>'
  const expect = s.trust`<h1>expect</h1>`
  return [actual, expect]
})
```

### Running Tests

```bash
cofound test <path>             # Execute all tests in the specified file
cofound test <path> --headless  # Execute tests in a headless browser
```
