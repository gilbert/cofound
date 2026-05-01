import { register } from 'node:module'

import '../../ssr/index.js'

register('../hooks.js', import.meta.url)
