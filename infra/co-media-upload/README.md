# co-media-upload

Small sequential tus-compatible upload support.

This package implements the small tus 1.0.0 subset needed for reliable local-network media uploads: create, resume by offset, append bytes, cancel, expire stale uploads, and call an app hook when an upload completes.

## API

```js
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_UPLOAD_DIR,
  DEFAULT_UPLOAD_PREFIX,
  DEFAULT_UPLOAD_TTL,
  handleUpload,
  uploadFile,
  uploadServer,
} from 'co-media-upload'
```

The default upload prefix, temp directory, upload TTL, and browser chunk size are exported at the top of `index.js` so vendored copies can change environment-specific defaults in one obvious place.

## Plain Node Handler

```js
import http from 'node:http'
import { handleUpload } from 'co-media-upload'

http.createServer((req, res) => {
  handleUpload(req, res, {
    prefix: DEFAULT_UPLOAD_PREFIX,
    dir: DEFAULT_UPLOAD_DIR,
    maxSize: 100 * 1024 * 1024 * 1024,
    onComplete({ id, path, metadata }) {
      // Move the temp file into the library and scan it.
    },
  })
}).listen(3000)
```

## App Adapter

```js
uploadServer(app, {
  prefix: DEFAULT_UPLOAD_PREFIX,
  dir: DEFAULT_UPLOAD_DIR,
  onComplete({ id, path, metadata }) {},
})
```

`uploadServer()` mounts the route methods when the app exposes `options`, `post`, `head`, `patch`, and `delete`. It also returns `{ handle }` for direct Node-style use.

## Browser Helper

```js
const upload = uploadFile(file, {
  endpoint: '/upload',
  metadata: { filename: file.name },
  onProgress({ uploaded, total }) {},
  onComplete(result) {},
  onError(error) {},
})

upload.start()
upload.pause()
upload.resume()
upload.cancel()
```

The client stores the upload URL in `localStorage` using `name:size:lastModified`, checks `HEAD` before resuming, and sends sequential `PATCH` chunks.

## Supported tus Subset

```text
OPTIONS  /upload       advertise capabilities
POST     /upload       create upload resource
HEAD     /upload/:id   report current offset
PATCH    /upload/:id   append bytes at current offset
DELETE   /upload/:id   cancel upload
```

Advertised extensions:

```http
Tus-Extension: creation,termination,expiration
```

Not advertised:

```http
concatenation
checksum
creation-with-upload
```

## Storage

Uploads are stored in one directory:

```text
.uploads/
  <id>.bin
  <id>.json
```

The default directory is `DEFAULT_UPLOAD_DIR`.

The JSON record contains:

```js
{
  id,
  length,
  offset,
  metadata,
  createdAt,
  updatedAt,
  expiresAt,
  complete,
  notified,
}
```

## Known Missing Edge Cases

- No parallel upload support. The tus Concatenation extension is intentionally not implemented.
- No checksum support. Corruption detection must be added separately if it becomes necessary.
- No `creation-with-upload`; `POST` creates an empty upload and bytes arrive through `PATCH`.
- No locking for concurrent `PATCH` requests to the same upload ID. Clients should send sequential chunks.
- If a `PATCH` request omits `Content-Length`, the server validates final size after append but does not stream-abort exactly at `Upload-Length`.
- The temp file is not renamed on completion. The app should move it from `onComplete`.
- `onComplete` is called after the upload is marked complete; if the hook throws, the client receives an error and app-level recovery is required.
- No authentication, authorization, quota, virus scanning, or destination policy.
- No CORS headers are set.
- The app adapter is intentionally small and assumes route handlers expose raw Node `req`/`res` as `r.req`/`r.res` or equivalent.

## Development

Run tests:

```sh
npm test
```

The tests cover creation, offset checks, resume headers, sequential patching, completion, delete, expiry cleanup, metadata, and the browser helper.
