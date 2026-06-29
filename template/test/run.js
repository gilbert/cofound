process.env.DEBUG = process.env.TEST_DEBUG
process.env.NODE_ENV = 'test'

import fs from 'fs'
import path from 'path'

async function runTestfiles() {
  const testFolder = 'test'
  const stack = [testFolder]
  while (stack.length > 0) {
    const folder = stack.pop()
    for (const file of fs.readdirSync(folder)) {
      const filepath = `${folder}/${file}`
      if (fs.statSync(filepath).isDirectory()) {
        stack.push(filepath)
      } else if (file.endsWith('.test.js')) {
        await import(path.join(process.cwd(), filepath))
      }
    }
  }
}

runTestfiles()
