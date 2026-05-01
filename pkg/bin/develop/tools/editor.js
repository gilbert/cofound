import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import cp from 'node:child_process'

import api from '../api.js'

let editor = null
const stackLine = ({ path, line, column }) => [path, line, column].join(':')

export default function(x) {
  x.path = path.join(process.cwd(), x.file)
  try {
    goto(x)
  } catch (e) {
    api.log({ type: 'error', content: e })
  }
}

const editors = ({
  darwin: {
    zed: {
      name: 'Zed',
      path: '/Applications/Zed.app/Contents/MacOS/cli',
      args: stackLine
    },
    zedp: {
      name: 'Zed Preview',
      path: '/Applications/Zed Preview.app/Contents/MacOS/cli',
      args: stackLine
    },
    subl: {
      name: 'Sublime Text',
      path: '/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl',
      args: stackLine
    },
    mvim: {
      name: 'Mac VIM',
      path: '/Applications/MacVim.app/Contents/bin/mvim',
      spawn: '/usr/bin/open',
      args: ({ path, line }) => ['mvim://open?url=file://' + encodeURI(encodeURI(path)) + '&line=' + line]
    },
    code: {
      name: 'VSCode',
      path: '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
      args: x => ['--goto', stackLine(x)]
    },
    webstorm: {
      name: 'WebStorm',
      path: '/Applications/WebStorm.app/Contents/MacOS/webstorm',
      args: ({ path, line, column }) => ['--line', line, '--column', column - 1, path]
    }
  },
  win32: {
    sublime: {
      name: 'Sublime Text',
      path: process.env.ProgramFiles + '\\Sublime Text\\sublime_text.exe',
      args: stackLine
    },
    sublime4: {
      name: 'Sublime Text 4',
      path: process.env.ProgramFiles + '\\Sublime Text 4\\sublime_text.exe',
      args: stackLine
    },
    sublime3: {
      name: 'Sublime Text 3',
      path: process.env.ProgramFiles + '\\Sublime Text 3\\sublime_text.exe',
      args: stackLine
    },
    code: {
      name: 'VSCode',
      path: process.env.LOCALAPPDATA + '\\Programs\\Microsoft VS Code\\Code.exe',
      args: x => ['--goto', stackLine(x)]
    },
    webstorm: {
      name: 'WebStorm',
      path: (process.env.PATH.split(';').find(x => x.match(/webstorm/i)) || 'C:\\Program Files\\JetBrains\\WebStorm 2024.3\\bin\\') + 'webstorm64.exe',
      args: ({ path, line, column }) => ['--line', line, '--column', column - 1, path]
    }
  },
  linux: {

  }
})[os.platform()]

function goto(target) {
  const editor = findEditor()

  if (!editor)
    return

  cp.spawn(editor.spawn || editor.path, [].concat(editor.args(target)), {
    stdio: 'ignore',
    detached: true
  }).unref()
}

function findEditor() {
  if (editor || editor === false)
    return editor

  editor = process.env.EDITOR
    && envEditor()
    || editors[Object.keys(editors).find(editor => fs.existsSync(editors[editor].path))]

  if (!editor)
    throw new Error('Could not find any editor')

  if (editor && !fs.existsSync(editor.path))
    throw new Error('Could not find editor: ' + editor.name + ' at ' + editor.path)

  return editor
}

function envEditor() {
  const editor = editors[Object.keys(editors).find(x => process.env.EDITOR.toLowerCase().includes(x) || process.env.EDITOR.toLowerCase().includes(x))]
  return fs.existsSync(process.env.EDITOR)
    ? { args: editor ? editor.args : x => x.file, path: process.env.EDITOR }
    : editor
}
