/* eslint no-console: 0 */

import c from '../color.js'

console.log(`
Usage: cos ${ c.bold`command` }

${ c.dim`Any command can be shortened anywhere down to its first letter` }

cos ${ c.bold`s` }${ c.dim`tart` }         Starts a full production setup
cos ${ c.bold`c` }${ c.dim`reate` }        Create a new cos project
cos ${ c.bold`d` }${ c.dim`evelop` }       Starts the cos development setup
cos ${ c.bold`g` }${ c.dim`enerate` }      Generate static HTML
cos ${ c.bold`b` }${ c.dim`uild` }         Build and bundle browser js

cos ${ c.bold`v` }${ c.dim`ersion` }       Print the current versions
cos ${ c.bold`h` }${ c.dim`elp` }          Print the full help
`)
