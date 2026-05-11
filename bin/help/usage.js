/* eslint no-console: 0 */

import c from '../color.js'

console.log(`
Usage: cofound ${ c.bold`command` }

${ c.dim`Any command can be shortened anywhere down to its first letter` }

cofound ${ c.bold`s` }${ c.dim`tart` }         Starts a full production setup
cofound ${ c.bold`c` }${ c.dim`reate` }        Create a new cofound project
cofound ${ c.bold`d` }${ c.dim`evelop` }       Starts the cofound development setup
cofound ${ c.bold`g` }${ c.dim`enerate` }      Generate static HTML
cofound ${ c.bold`b` }${ c.dim`uild` }         Build and bundle browser js

cofound ${ c.bold`v` }${ c.dim`ersion` }       Print the current versions
cofound ${ c.bold`h` }${ c.dim`elp` }          Print the full help
`)
