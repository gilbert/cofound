import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'

import config, { resolve } from '../config.js'

async function reservePort() {
  return new Promise(resolve => {
    const server = net.createServer().listen(0, () => {
      const x = server.address().port
      server.close(() => resolve(x))
    })
  })
}

const project = path.join(config.projectsDir, config.port + '-' + path.basename(config.cwd))
fs.mkdirSync(project, { recursive: true })

const env        = process.env
    , url        = env.COFOUND_URL = env.COFOUND_URL || getUrl()
    , origin     = new URL(url).origin
    , devPort    = env.COFOUND_DEV_PORT = env.COFOUND_DEV_PORT || await getDevPort()
    , nodePort   = env.COFOUND_NODE_PORT = env.COFOUND_NODE_PORT || await reservePort()

export { resolve }

export default Object.assign(config, {
  project,
  url,
  origin,
  devPort,
  nodePort
})

function getUrl() {
  const x = path.join(project, '.cofound-url')
  return !config.test && fs.existsSync(x)
    ? fs.readFileSync(x, 'utf8')
    : 'http://127.0.0.1:' + config.port
}

async function getDevPort() {
  const portPath = path.join(project, '.cofound-dev-port')
  try {
    fs.accessSync(path.join(project, 'SingletonSocket'))
    return parseInt(fs.readFileSync(portPath, 'utf8'))
  } catch (error) {
    const port = await reservePort()
    fs.writeFileSync(portPath, '' + port)
    return port
  }
}
