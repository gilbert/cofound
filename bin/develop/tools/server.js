import Server from 'cofound/server'
import exit from 'cofound/exit'

import api from '../api.js'
import editor from './editor.js'
import config from '../config.js'
import eyeDropper from './eyedropper/index.js'

let eyeDropperStop

const events = {
  editor,
  inspect,
  tested
}

const wss = new Set()
const app = Server()

app.ws({
  upgrade: r => ({ name: r.ip }),
  open: ws => wss.add(ws),
  close: ws => wss.delete(ws),
  message: (ws, { json }) => json.event && events[json.event](json.data, ws)
})

const listener = await app.listen(config.devPort)
exit.wait('http dev', listener.close)

api.browser.reload.observe(x => publish('reload', x))
api.browser.redraw.observe(x => publish('redraw', x))
api.browser.hotload.observe(x => publish('hotload', x))
api.log.observe(x => publish('log', x))

function publish(event, data) {
  wss.forEach(ws => send(ws, event, data))
}

function send(ws, event, data) {
  ws.send(JSON.stringify({ event, data }))
}

function inspect(x, ws) {
  x
    ? eyeDropperStop = eyeDropper(x => send(ws, 'color', x))
    : eyeDropperStop && eyeDropperStop()
}

function tested(code) {
  code && console.error('Testing failed with error code:', code)
  config.ci && exit(code)
}
