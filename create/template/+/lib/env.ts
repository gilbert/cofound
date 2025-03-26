import { Env, read } from 'cofound/backend/env'
import path from 'path'

const __dirname = new URL('.', import.meta.url).pathname

export const env = Env(['development', 'test', 'production'])

/** Used for non-user-facing code */
export const APP_NAME = 'myapp'

export const isScript = read('SIN_SCRIPT', '', (v) => v === 'true')
export const isBuild = read('SIN_BUILD', '', (v) => v === 'true')

export const APP_DB_FILE = isBuild
  ? ':memory:'
  : env.branch({
      test: ':memory:',
      development: read('DATABASE_URL', path.join(__dirname, '../../db', 'app.sqlite')),
      production: () => new URL(read('DATABASE_URL')).pathname,
    })

export const passkeysConfig = {
  rpName: read('APP_RP_NAME'),
  rpId: env.branch({
    test: 'localhost',
    development: 'localhost',
    production: () => read('APP_HOST'),
  }),
  origin: env.branch({
    test: '',
    development: () => (isScript || isBuild ? '' : 'http://localhost:1333'),
    production: () => `https://${read('APP_HOST')}`,
  }),
}

export const SESSION_SECRET = env.branch('dev-secret-that-is-at-least-32-chars', {
  production: () => read('SESSION_SECRET'),
})

/**
 * Cofound Config
 */
export const cofoundEnv = {
  name: env.name,
  jobDirectory: new URL('../jobs', import.meta.url).pathname,
}
