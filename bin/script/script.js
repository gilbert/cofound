import '../../ssr/index.js'
import config from '../config.js'

// Just run the script directly without watching
await import(process.env.COS_ENTRY || config.entry)