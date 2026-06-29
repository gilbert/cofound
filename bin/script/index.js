import cp from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Set entry path for the script
process.env.COFOUND_ENTRY = process.env.COFOUND_ENTRY || process.argv[2]

// Execute the script directly without watching
const result = cp.spawnSync(
  process.execPath, [
    '--import', path.join(__dirname, 'import.js'),
    path.join(__dirname, 'script.js'),
    ...process.argv.slice(2)
  ], {
    stdio: 'inherit' // Ensure we see child's output
  }
)

if (result.error) {
  console.error('Failed to start subprocess.', result.error);
  process.exit(1);
}

if (result.signal) {
  console.error(`Subprocess terminated by signal: ${result.signal}`);
  // Common practice is 128 + signal number. For example, SIGINT (Ctrl+C) is usually signal 2, so exit 130.
  // However, simply exiting with 1 is also acceptable for many use cases.
  process.exit(1);
}

if (result.status !== null) {
  process.exit(result.status);
} else {
  // This case should ideally be covered by error or signal checks,
  // but as a fallback, if status is null and no error/signal, exit with 0.
  // This is unlikely with spawnSync unless something very unusual happened.
  process.exit(0);
}