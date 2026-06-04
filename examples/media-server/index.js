import s from 'cofound'

const chunkSize = 8 * 1024 * 1024
const files = s.live([])
const uploads = s.live([])
let loaded = false

const FileHead = s`span
  font-size 12px
  text-transform uppercase
  letter-spacing 0
  c color-mix(in srgb, CanvasText 58%, Canvas)
`

s.mount(() => {
  if (!loaded && !s.is.server) {
    loaded = true
    refreshFiles()
  }

  return s`
  max-width 920px
  m 32px auto
  p 0 24px
  font-family system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
`(
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
        files().length + ' uploaded file' + (files().length === 1 ? '' : 's')
      )
    ),
    s`a c LinkText`({ href: '/files.json', target: '_self' }, 'JSON')
  ),

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
      'Drop files here or choose files to upload.'
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
      `('File'),
      FileHead`
        w 110px
      `('Size'),
      FileHead`
        w 190px
      `('Updated')
    ),
    files().length
      ? files().map(fileRow)
      : s`
          p 18px 8px
          c color-mix(in srgb, CanvasText 58%, Canvas)
          border-bottom 1px solid color-mix(in srgb, CanvasText 14%, Canvas)
        `('No uploaded files yet.')
  )
  )
})

function fileRow(file) {
  return s`
    d flex
    ai center
    gap 16px
    p 10px 8px
    border-bottom 1px solid color-mix(in srgb, CanvasText 14%, Canvas)
  `({ key: file.name },
    s`
      flex 1
      min-width 0
      overflow hidden
      text-overflow ellipsis
      white-space nowrap
    `(
      s`a c LinkText`({ href: file.href, target: '_self' }, file.name)
    ),
    s`
      w 110px
      white-space nowrap
      c color-mix(in srgb, CanvasText 66%, Canvas)
    `(formatBytes(file.size)),
    s`
      w 190px
      white-space nowrap
      c color-mix(in srgb, CanvasText 66%, Canvas)
    `(new Date(file.updatedAt).toLocaleString())
  )
}

async function refreshFiles() {
  files(await s.http.get('/files.json'))
  s.redraw()
}

function uploadFiles(list) {
  for (const file of list) uploadFile(file)
}

async function uploadFile(file) {
  const item = {
    id: crypto.randomUUID(),
    name: file.name,
    progress: 0,
    status: 'Starting',
  }
  uploads([item, ...uploads()])
  s.redraw()

  try {
    let url = localStorage.getItem(storageKey(file))
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
          'Upload-Metadata': metadata({ filename: file.name }),
        },
      })
      if (!created.ok) throw new Error('Create failed: ' + created.status)
      url = created.headers.get('Location')
      localStorage.setItem(storageKey(file), url)
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

    localStorage.removeItem(storageKey(file))
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

function storageKey(file) {
  return 'media-server:' + file.name + ':' + file.size + ':' + file.lastModified
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
