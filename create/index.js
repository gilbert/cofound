#!/usr/bin/env node
import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const [, , dir] = process.argv
const projectName = path.basename(path.resolve(dir))

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

async function main() {
  if (!dir) {
    const answer = await new Promise((resolve) => {
      rl.question(
        'Are you sure you want to create a project in the current directory? (y/N) ',
        resolve,
      )
    })
    if (answer.toLowerCase() !== 'y') {
      console.log('Aborting.')
      process.exit(0)
    }
    dir = '.'
  }

  const templateDir = path.join(__dirname, 'template')
  const projectDir = path.resolve(dir)

  console.log(`Cofounding new project into ${projectDir}`)

  // Copy template files
  await fs.copy(templateDir, projectDir)

  // Perform replacements
  async function processDirectory(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await processDirectory(fullPath)
      } else if (entry.isFile()) {
        let content = await fs.readFile(fullPath, 'utf-8')
        content = content.replace(/__name__/g, kebabCase(projectName))
        content = content.replace(/__Name__/g, pascalCase(projectName))
        await fs.writeFile(fullPath, content)
      }
    }
  }

  await processDirectory(projectDir)

  // Run post-creation commands
  const useNpm = !commandExists('pnpm')
  const packageManager = useNpm ? 'npm' : 'pnpm'

  console.log('Installing dependencies...')
  execSync(`${packageManager} install`, { cwd: projectDir, stdio: 'inherit' })

  console.log('Initializing git repository...')
  execSync('git init', { cwd: projectDir, stdio: 'inherit' })
  execSync('git add .', { cwd: projectDir, stdio: 'inherit' })
  execSync('git commit -m "Initial commit"', { cwd: projectDir, stdio: 'inherit' })

  console.log(`Project created successfully in ${projectDir}`)

  console.log('\nTo get started:\n')
  console.log(`  cd ${projectName}`)
  console.log(`  cp .env.example .env`)
  console.log(`  ${packageManager} run migrate`)
  console.log(`  ${packageManager} run dev`)
  console.log()
}

function kebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

function pascalCase(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) =>
      index === 0 ? letter.toUpperCase() : letter.toUpperCase(),
    )
    .replace(/[\s-]+/g, '')
}

function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

main().then(() => rl.close())
