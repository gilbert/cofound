import inspector from 'node:inspector'
import { register } from 'node:module'

import './log.js'
import '../../ssr/index.js'

globalThis.console = inspector.console

register('../hooks.js', import.meta.url)
