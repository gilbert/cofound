# CLI

Cofound ships with a command-line interface that handles project generation, development, bundling, static generation, production serving, and tests. In generated apps you normally run Cofound through npm scripts from `package.json`.

### What's Included

- Project Generation
- Development Server
- Hot Module Reloading
- Testing Framework

## Project Scripts

Generated projects use npm scripts:

```bash
npm run dev       # Start the dev server with hot reload
npm run build     # Build browser assets for production
npm run generate  # Generate static HTML into dist/
npm run start     # Start the production server
npm test          # Run the project's test script
```

The scripts call the local `cofound` dependency installed in `node_modules`.

Dependencies are managed with npm:

```bash
npm install <package>
```

## Underlying Commands

These are the commands used by the npm scripts and by project setup:

```bash
npx cofound create  # Create a new project
cofound dev         # Development server with hot reload
cofound build       # Build browser assets
cofound generate    # Generate static HTML
cofound start       # Start production server
cofound test        # Run Cofound test files
cofound purge       # Clear cached projects
cofound help        # Help screen
cofound version     # Print current version
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
npm test                         # Run the project test script
cofound test <path>              # Execute all tests in a specific file
cofound test <path> --headless   # Execute tests in a headless browser
```
