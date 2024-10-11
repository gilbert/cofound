import fs from 'fs/promises'
import path from 'path'
import { build } from 'tsup'

// Find all entry points defined in the "exports" field in package.json
// and build them with sourcemaps and declaration files
const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'))

let entries = []
for (const [name, { import: target }] of Object.entries(pkg.exports)) {
  // name may have a * in its path
  // If so, it is a glob pattern
  if (name.includes('*')) {
    const srcDir = target.replace('*.js', '').replace('dist', 'src')
    const files = await fs.readdir(srcDir)
    entries.push(...files.map((file) => path.resolve( path.join(srcDir, file))))
  } else {
    // Otherwise, resolve relative path based on target
    // e.g. './dist/backend/index.js' to 'src/backend/index.ts'
    entries.push(path.resolve(target.replace('dist', 'src').replace('.js', '.ts')))
  }
}

await build({
  entry: entries,
  format: 'esm',
  sourcemap: true,
  dts: true,
  watch: process.argv.includes('--watch'),
})

// For each file in vendor-types, add a reference to each entry file
// e.g.
/// <reference path="../../vendor-types/sin.d.ts" />
// We do this so that app devs can use the types without having to import them
const vendorFiles = await fs.readdir(path.resolve('vendor-types'))
for (const entry of entries) {
  if (entry.includes('backend')) {
    const target = entry.replace('src', 'dist').replace('.ts', '.d.ts')
    console.log(`Adding reference to ${target}`)

    const rel = path.relative(path.dirname(target), path.resolve('vendor-types'))
    const referenceHeader = vendorFiles.map((file) => `/// <reference path="${rel}/${file}" />`).join('\n')
    const content = await fs.readFile(target, 'utf-8')
    await fs.writeFile(target, `${referenceHeader}\n${content}`)
  }
}
console.log('Done')