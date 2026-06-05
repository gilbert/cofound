# Media Server Example

Tiny upload-and-view media server using Cofound plus Cofound infra primitives.

It provides:

- upload files with the small tus-compatible resumable upload flow
- browse directories under `MEDIA_DIR`
- create directories in the current directory
- scan media into a persistent `co-media-library` JSON index on server start
- generate video and image thumbnails with a small Cofound job queue
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
- `THUMB_DIR`: default `examples/media-server/.thumbs`
- `THUMB_WIDTH`: default `320`
- `THUMB_CONCURRENCY`: default `2`
- `FFMPEG_PATH`: default `ffmpeg`
- `LIBRARY_FILE`: default `examples/media-server/.media-library.json`
- `DB_FILE`: default `examples/media-server/app.db`

Uploaded files are moved into the selected directory under `MEDIA_DIR` after completion. Existing filenames are preserved when possible; collisions get a numeric suffix. Completed uploads trigger a library rescan.

Thumbnail state is stored on `co-media-library` entries under `metadata.thumbnail`. The example keeps the library index in `.media-library.json`, queue state in `app.db`, and generated JPEG thumbnails in `.thumbs/`.

## Structure

- `index.js`: Cofound client page.
- `+server/index.js`: Cofound server routes for uploads, directory listing, directory creation, library records, and file serving.
- `+server/thumbnails.js`: example-local thumbnail generation helpers and job class factory.
- `media/`: completed uploads.
- `.uploads/`: temporary tus upload files.
- `.thumbs/`: generated thumbnail files.
