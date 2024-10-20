#!/usr/bin/env node
import fs from 'fs'

const source = fs.readFileSync('package.json', 'utf8')
const lineEnding = source.match(/(\r\n|\n)/)?.[1] || ''
const pkg = JSON.parse(source)
pkg.dbVersion = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + lineEnding, 'utf8')
