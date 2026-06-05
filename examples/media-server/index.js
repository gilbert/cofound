import s from 'cofound'

const chunkSize = 8 * 1024 * 1024
const files = s.live([])
const uploads = s.live([])
const currentDir = s.live('')
let loaded = false

const videoExtensions = new Set(['mp4', 'm4v', 'mkv', 'mov', 'webm', 'avi', 'ts'])
const audioExtensions = new Set(['mp3', 'flac', 'm4a', 'ogg', 'opus', 'wav'])
const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'])

const FileHead = s`span
  font-size 12px
  text-transform uppercase
  letter-spacing 0
  c color-mix(in srgb, CanvasText 58%, Canvas)
`

s.mount((attrs, children, { route }) => {
  if (!loaded && !s.is.server) {
    loaded = true
    refreshFiles('')
  }

  return s`
  max-width 920px
  m 32px auto
  p 0 24px
  font-family system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
`(
    route({
      '/': libraryPage,
      '/player': () => playerPage(route.query.get('path') || ''),
    })
  )
})

function libraryPage() {
  const entries = files()
  const dir = currentDir()
  const fileCount = entries.filter(file => file.kind === 'file').length
  const directoryCount = entries.filter(file => file.kind === 'directory').length

  return [
  s`
    d flex
    ai end
    jc space-between
    gap 16px
    mb 24px
  `(
    s`div`(
      s`h1 m 0; font-size 28px; line-height 1.1; font-weight 650`('Media Server'),
      s`div mt 6px; c color-mix(in srgb, CanvasText 58%, Canvas)`(
        summary(directoryCount, fileCount)
      )
    ),
    s`
      d flex
      gap 10px
      ai center
    `(
      s`button`({ onclick: createDirectory }, 'New directory'),
      s`a c LinkText`({ href: filesJsonHref(), target: '_self' }, 'JSON')
    )
  ),

  breadcrumbs(dir),

  s`
    border 1px dashed color-mix(in srgb, CanvasText 34%, Canvas)
    border-radius 8px
    p 20px
    mb 24px
    bg color-mix(in srgb, CanvasText 4%, Canvas)
  `({
    ondragover: event => {
      event.preventDefault()
      event.currentTarget.style.borderColor = 'Highlight'
    },
    ondragleave: event => {
      event.currentTarget.style.borderColor = ''
    },
    ondrop: event => {
      event.preventDefault()
      event.currentTarget.style.borderColor = ''
      uploadFiles(event.dataTransfer.files)
    },
  },
    s`input w 100%`({
      type: 'file',
      multiple: true,
      onchange: event => uploadFiles(event.target.files),
    }),
    s`div mt 8px; c color-mix(in srgb, CanvasText 58%, Canvas)`(
      'Drop files here or choose files to upload into this directory.'
    ),
    uploads().length > 0 && s`div d grid; gap 10px; mt 14px`(
      uploads().map(upload => s`
        d grid
        ai center
        gap 8px 10px
        grid-template-columns minmax(0, 1fr) auto
      `({ key: upload.id },
        s`span overflow hidden; text-overflow ellipsis; white-space nowrap`(upload.name),
        s`span c color-mix(in srgb, CanvasText 66%, Canvas)`(upload.status),
        s`progress grid-column 1 / -1; w 100%`({
          max: 1,
          value: upload.progress,
        })
      ))
    )
  ),

  s`div w 100%`(
    s`
      d flex
      gap 16px
      p 0 8px 8px
      border-bottom 1px solid color-mix(in srgb, CanvasText 20%, Canvas)
    `(
      FileHead`
        flex 1
        min-width 0
      `('Name'),
      FileHead`
        w 110px
      `('Size'),
      FileHead`
        w 190px
      `('Updated')
    ),
    entries.length
      ? entries.map(entryRow)
      : s`
          p 18px 8px
          c color-mix(in srgb, CanvasText 58%, Canvas)
          border-bottom 1px solid color-mix(in srgb, CanvasText 14%, Canvas)
        `('This directory is empty.')
  )
  ]
}

function playerPage(file) {
  const src = fileHref(file)
  const name = fileName(file)
  const kind = mediaKind(file)

  return [
    s`
      d flex
      ai center
      jc space-between
      gap 16px
      mb 20px
    `(
      s`div min-width 0`(
        s`h1 m 0; font-size 28px; line-height 1.15; font-weight 650`(name || 'Player'),
        file && s`
          mt 6px
          overflow hidden
          text-overflow ellipsis
          white-space nowrap
          c color-mix(in srgb, CanvasText 58%, Canvas)
        `(file)
      ),
      s`
        d flex
        gap 10px
        ai center
      `(
        s`a c LinkText`({ href: '/' }, 'Library'),
        file && s`a c LinkText`({ href: src, target: '_self' }, 'Open file')
      )
    ),
    file
      ? playerSurface(kind, src, name)
      : s`
          p 18px
          border 1px solid color-mix(in srgb, CanvasText 18%, Canvas)
          border-radius 8px
          c color-mix(in srgb, CanvasText 58%, Canvas)
        `('No media file selected.')
  ]
}

function playerSurface(kind, src, name) {
  if (kind === 'video') {
    return s`video
      d block
      max-width 100%
      max-height 72vh
      m 0 auto
      bg black
      border-radius 8px
      object-fit contain
    `({
      src,
      controls: true,
      autoplay: true,
      playsinline: true,
      preload: 'metadata',
    })
  }

  if (kind === 'audio') {
    return s`
      d grid
      gap 16px
      p 24px
      border 1px solid color-mix(in srgb, CanvasText 18%, Canvas)
      border-radius 8px
      bg color-mix(in srgb, CanvasText 4%, Canvas)
    `(
      s`div font-size 18px; font-weight 600`(name),
      s`audio w 100%`({
        src,
        controls: true,
        autoplay: true,
      })
    )
  }

  if (kind === 'image') {
    return s`img
      d block
      max-width 100%
      max-height 72vh
      m 0 auto
      border-radius 8px
    `({ src, alt: name })
  }

  return s`
    p 18px
    border 1px solid color-mix(in srgb, CanvasText 18%, Canvas)
    border-radius 8px
    c color-mix(in srgb, CanvasText 58%, Canvas)
  `('This file type is not directly playable in the browser.')
}

function breadcrumbs(dir) {
  const parts = dir ? dir.split('/') : []
  const items = [crumb('Media', '')]
  let path = ''
  for (const part of parts) {
    path = path ? path + '/' + part : part
    items.push(s`span`('/'), crumb(part, path))
  }

  return s`
    d flex
    ai center
    gap 8px
    flex-wrap wrap
    mb 18px
    c color-mix(in srgb, CanvasText 66%, Canvas)
  `(items)
}

function crumb(label, dir) {
  return s`button
    p 0
    border 0
    bg transparent
    c LinkText
    cursor pointer
    font inherit
  `({ onclick: () => openDir(dir) }, label)
}

function entryRow(entry) {
  const directory = entry.kind === 'directory'
  return s`
    d flex
    ai center
    gap 16px
    p 10px 8px
    border-bottom 1px solid color-mix(in srgb, CanvasText 14%, Canvas)
  `({ key: entry.kind + ':' + entry.path },
    s`
      flex 1
      min-width 0
      overflow hidden
      text-overflow ellipsis
      white-space nowrap
    `(
      directory
        ? s`button
            p 0
            border 0
            bg transparent
            c LinkText
            cursor pointer
            font inherit
            text-align left
          `({ onclick: () => openDir(entry.path) }, entry.name + '/')
        : s`a c LinkText`({ href: playerHref(entry.path) }, entry.name)
    ),
    s`
      w 110px
      white-space nowrap
      c color-mix(in srgb, CanvasText 66%, Canvas)
    `(directory ? '-' : formatBytes(entry.size)),
    s`
      w 190px
      white-space nowrap
      c color-mix(in srgb, CanvasText 66%, Canvas)
    `(new Date(entry.updatedAt).toLocaleString())
  )
}

async function openDir(dir) {
  currentDir(dir)
  await refreshFiles(dir)
}

async function refreshFiles(dir = currentDir()) {
  const listing = await s.http.get(filesJsonHref(dir))
  currentDir(listing.dir || '')
  files(listing.entries || [])
  s.redraw()
}

async function createDirectory() {
  const name = window.prompt('Directory name')
  if (!name) return

  const response = await fetch('/directories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir: currentDir(), name }),
  })
  if (!response.ok) {
    window.alert('Could not create directory.')
    return
  }
  await refreshFiles()
}

function uploadFiles(list) {
  const dir = currentDir()
  for (const file of list) uploadFile(file, dir)
}

async function uploadFile(file, dir) {
  const item = {
    id: crypto.randomUUID(),
    name: file.name,
    progress: 0,
    status: 'Starting',
  }
  uploads([item, ...uploads()])
  s.redraw()

  try {
    let url = localStorage.getItem(storageKey(file, dir))
    let offset = 0
    if (url) {
      const head = await fetch(url, { method: 'HEAD', headers: tusHeaders() })
      if (head.ok) offset = Number(head.headers.get('Upload-Offset') || 0)
      else url = null
    }

    if (!url) {
      const created = await fetch('/upload', {
        method: 'POST',
        headers: {
          ...tusHeaders(),
          'Upload-Length': String(file.size),
          'Upload-Metadata': metadata({ filename: file.name, dir }),
        },
      })
      if (!created.ok) throw new Error('Create failed: ' + created.status)
      url = created.headers.get('Location')
      localStorage.setItem(storageKey(file, dir), url)
    }

    while (offset < file.size) {
      const next = Math.min(offset + chunkSize, file.size)
      const patched = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...tusHeaders(),
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: file.slice(offset, next),
      })

      if (patched.status === 409) {
        const head = await fetch(url, { method: 'HEAD', headers: tusHeaders() })
        if (!head.ok) throw new Error('Resume failed: ' + head.status)
        offset = Number(head.headers.get('Upload-Offset') || 0)
        continue
      }
      if (!patched.ok) throw new Error('Upload failed: ' + patched.status)

      offset = Number(patched.headers.get('Upload-Offset') || next)
      updateUpload(item.id, {
        progress: file.size ? offset / file.size : 1,
        status: Math.round((file.size ? offset / file.size : 1) * 100) + '%',
      })
    }

    localStorage.removeItem(storageKey(file, dir))
    updateUpload(item.id, { progress: 1, status: 'Done' })
    await refreshFiles()
  } catch (err) {
    console.error(err)
    updateUpload(item.id, { status: 'Failed' })
  }
}

function updateUpload(id, patch) {
  uploads(uploads().map(upload => upload.id === id ? { ...upload, ...patch } : upload))
  s.redraw()
}

function tusHeaders() {
  return { 'Tus-Resumable': '1.0.0' }
}

function metadata(values) {
  return Object.entries(values)
    .map(([key, value]) => key + ' ' + btoa(unescape(encodeURIComponent(String(value)))))
    .join(',')
}

function storageKey(file, dir) {
  return 'media-server:' + dir + ':' + file.name + ':' + file.size + ':' + file.lastModified
}

function filesJsonHref(dir = currentDir()) {
  return '/files.json' + (dir ? '?dir=' + encodeURIComponent(dir) : '')
}

function playerHref(file) {
  return '/player?path=' + encodeURIComponent(file)
}

function fileHref(file) {
  return '/files?path=' + encodeURIComponent(file)
}

function fileName(file) {
  return (file || '').split('/').pop()
}

function mediaKind(file) {
  const ext = fileName(file).split('.').pop().toLowerCase()
  if (videoExtensions.has(ext)) return 'video'
  if (audioExtensions.has(ext)) return 'audio'
  if (imageExtensions.has(ext)) return 'image'
  return 'file'
}

function summary(directories, uploadedFiles) {
  const parts = [
    directories + ' director' + (directories === 1 ? 'y' : 'ies'),
    uploadedFiles + ' file' + (uploadedFiles === 1 ? '' : 's'),
  ]
  return parts.join(', ')
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  for (const unit of units) {
    if (value < 1024) return value.toFixed(value < 10 ? 1 : 0) + ' ' + unit
    value /= 1024
  }
  return value.toFixed(1) + ' PB'
}
