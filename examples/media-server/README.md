# Media Server Example

Tiny upload-and-view media server using Cofound plus Cofound infra primitives.

It provides one page:

- upload files with the small tus-compatible resumable upload flow
- browse directories under `MEDIA_DIR`
- create directories in the current directory
- open uploaded media in a simple player page
- link each raw file directly through `/files?path=<path>`
- serve linked files with HTTP range support for browser viewing and seeking

## Run

```sh
npm run dev
```

Then open:

```text
http://127.0.0.1:7357
```

## Configuration

Environment variables:

- `PORT`: default `7357`
- `MEDIA_DIR`: default `examples/media-server/media`
- `UPLOAD_DIR`: default `examples/media-server/.uploads`

Uploaded files are moved into the selected directory under `MEDIA_DIR` after completion. Existing filenames are preserved when possible; collisions get a numeric suffix.

## Structure

- `index.js`: Cofound client page.
- `server/index.js`: Cofound server routes for uploads, directory listing, directory creation, and file serving.
- `media/`: completed uploads.
- `.uploads/`: temporary tus upload files.
