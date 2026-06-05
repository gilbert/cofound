# Media Server Example

Tiny upload-and-view media server using Cofound plus Cofound infra primitives.

It provides:

- upload files with the small tus-compatible resumable upload flow
- browse directories under `MEDIA_DIR`
- create directories in the current directory
- scan media into an in-memory `co-media-library` index on server start
- open uploaded media in a simple player page
- link indexed media by stable library ID
- serve media with HTTP range support for browser viewing and seeking

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

Uploaded files are moved into the selected directory under `MEDIA_DIR` after completion. Existing filenames are preserved when possible; collisions get a numeric suffix. Completed uploads trigger a library rescan.

## Structure

- `index.js`: Cofound client page.
- `+server/index.js`: Cofound server routes for uploads, directory listing, directory creation, library records, and file serving.
- `media/`: completed uploads.
- `.uploads/`: temporary tus upload files.
