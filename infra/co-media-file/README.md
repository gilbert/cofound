# co-media-file

Small media file utilities: extension detection, filename parsing, recursive scanning, and HTTP range serving.

This package deliberately avoids owning a media library schema or scanner daemon. It gives apps enough primitives to find local files and serve direct-play media with browser seeking.

## API

```js
import {
  isMediaFile,
  mediaType,
  parseMediaName,
  scanMediaFiles,
  serveRange,
} from 'co-media-file'
```

## Media Detection

```js
isMediaFile('/media/The Matrix (1999).mkv') // true
mediaType('/media/song.flac')              // 'audio'
```

Default video extensions:

```js
['.mp4', '.m4v', '.mkv', '.mov', '.webm', '.avi', '.ts']
```

Default audio extensions:

```js
['.mp3', '.flac', '.m4a', '.ogg', '.opus', '.wav']
```

## Filename Parsing

```js
parseMediaName('The.Matrix.1999.1080p.BluRay.x264.mkv')
// { kind: 'movie', title: 'The Matrix', year: 1999 }

parseMediaName('Breaking Bad S03E07 - One Minute.mkv')
// { kind: 'episode', show: 'Breaking Bad', season: 3, episode: 7, title: 'One Minute' }
```

The parser is best-effort. Unknown names return a cleaned title with `kind: 'video'`, `kind: 'audio'`, or `kind: 'unknown'`.

## Scanning

```js
for await (const file of scanMediaFiles('/media')) {
  console.log(file.path, file.type, file.parsed)
}
```

`scanMediaFiles(root, options)` is an async generator, so callers can index progressively. It does not probe files and does not write to a database.

Ignored names by default:

```js
[
  '$RECYCLE.BIN',
  'System Volume Information',
  '.DS_Store',
  '.actors',
  'metadata',
]
```

## Range Serving

```js
app.get('/media/:id/file', async r => {
  const item = await db.items.get(r.params.id)
  await serveRange(r, item.path)
})
```

`serveRange()` supports:

- no `Range` header: `200` with full stream
- valid single byte range: `206`
- suffix byte range such as `bytes=-1024`: `206`
- unsatisfiable or invalid range: `416`
- `HEAD` requests
- `Accept-Ranges`, `Content-Length`, `Content-Type`, and `Content-Range`

## Known Missing Edge Cases

- No multi-range response support. Requests such as `bytes=0-10,20-30` return `416`.
- No conditional request support yet: `If-Range`, `If-None-Match`, `If-Modified-Since`, `ETag`, and `Last-Modified` are not handled.
- No cache policy headers are set.
- MIME detection is a small extension map, not content sniffing.
- The scanner follows normal directory traversal only; it does not include watcher support, symlink policy, device boundary checks, or loop detection.
- Permission errors abort scans unless `ignoreErrors` is passed.
- Filename parsing is intentionally heuristic. It does not handle anime absolute episode numbers, multi-episode ranges, specials, editions, disc parts, stacked files, release groups, non-English season markers, or folder-context inference.
- The parser does not perform remote title matching or confidence scoring.
- No stable media IDs are generated. Apps should decide ID and database policy.

## Development

Run tests:

```sh
npm test
```

The integration smoke test uses existing `tmp-samples/` media and generates MKV, WebM, MP3, and WAV samples in a temp directory when `ffmpeg` and `ffprobe` are available.
