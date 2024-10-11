import fs from 'fs'
import o from 'ospec'
import path from 'path'
import 'sin/env'
import 'sin/server/window'

async function runTestfiles() {
  // Next, import all test files
  const testFolder = 'test'
  // Recursively iterate through all files in the test folder
  const stack: string[] = [testFolder]
  while (stack.length > 0) {
    const folder = stack.pop()!
    for (let file of fs.readdirSync(folder)) {
      const filepath = `${folder}/${file}`
      if (fs.statSync(filepath).isDirectory()) {
        stack.push(filepath)
      } else if (file.endsWith('.test.ts')) {
        // Although we're in typescript, we're still running the tests in commonjs, so we can use require
        await import(path.join(process.cwd(), filepath))
      }
    }
  }
  o.run()
}

runTestfiles()
