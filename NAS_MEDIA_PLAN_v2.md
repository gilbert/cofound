# NAS Media Server - Cofound Infra Plan v2

A lightweight infra plan for a future Jellyfin + FileRise alternative: a self-hosted media app with polished browsing, playback, and upload UX. The final app will live outside this repo. This repo should provide small, vendorable building blocks that make that app easy to build without turning Cofound infra into a media-server framework.

---

## Guiding Principle

Cofound infra should support excellent UX by exposing small, composable capabilities and status hooks. It should not own product policy, app schema, remote metadata strategy, user management, library UI, or media-server orchestration.

The final NAS media app needs seamless UX:

- Drag-and-drop upload of huge media files
- Resume after network drops, browser reloads, and device sleep
- Fast library discovery after upload
- Direct video playback with reliable seeking
- Graceful fallback when a file cannot play directly
- Good thumbnails and optional scrub previews
- A polished player surface with keyboard controls and progress events

The infra packages should enable those flows, but remain small enough that other projects can vendor only the parts they need.

---

## Scope Boundary

### Infra Owns

- FFprobe normalization
- Filename parsing and media file discovery
- Direct HTTP range serving
- Sequential tus-compatible resumable uploads
- Frame extraction and trickplay sprite generation
- A small video player/controller primitive
- Hooks/events for app integration

### The Final App Owns

- Auth, users, permissions, and parental controls
- Library database schema and migrations
- Watch history, favorites, continue-watching state
- Browse/search pages and Netflix-style app UI
- Upload destination rules
- Scan scheduling and post-upload indexing policy
- Remote metadata lookup, poster ranking, and API keys
- Transcode policy and unsupported-file messaging
- Admin settings and hardware-specific configuration

---

## Package Plan

```
co-media-probe      # ffprobe wrapper and normalized media facts
co-media-file       # file discovery, filename parsing, direct range serving
co-media-upload     # small tus-compatible resumable upload server/client
co-media-thumb      # frame extraction and optional trickplay sprites
co-player           # polished video primitive with hooks

Later / optional:
co-media-hls        # remux/HLS session support
co-media-transcode  # full FFmpeg transcode adapter, if proven necessary
co-media-artwork    # optional remote poster/artwork lookup
```

This reduces the original package graph by merging scanning and direct file serving into `co-media-file`, keeping upload independent, and deferring heavyweight streaming features.

---

## Research References

`NAS_MEDIA_PLAN.md` contains the full research notes. This v2 plan intentionally keeps only the references needed to implement the first passes.

| Area | References | Use For |
|------|------------|---------|
| FFprobe wrapper | `eugeneware/ffprobe`, `@dropb/ffprobe`, `fluent-ffmpeg/lib/ffprobe.js` | Spawn `ffprobe`, collect stdout, parse JSON, normalize streams |
| FFmpeg process handling | `fluent-ffmpeg/lib/processor.js` | Later process lifecycle, stderr parsing, signal handling |
| Range requests | `pillarjs/send`, `jshttp/range-parser` | Correct `206`, `416`, `Content-Range`, and stream slicing behavior |
| Filename parsing | `video-name-parser`, `parse-torrent-title`, `@ctrl/video-filename-parser` | Small regex pipeline and real fixture coverage |
| Local scanning | `stremio-local-addon/lib/findFiles.js`, `stremio-local-addon/lib/identify.js` | Recursive scan shape and parse-identify-associate split |
| Resumable uploads | tus protocol spec, `tus-js-client`, `tus-node-server` handlers | Sequential tus flow and verb-per-handler organization |
| Player controls | Vidstack Player, Media Chrome | Control surface behavior, keyboard interactions, accessibility patterns |
| HLS later | `advplyr/hls-media-server`, HLS.js | Remux/HLS only after direct play proves insufficient |
| Trickplay | `videojs-sprite-thumbnails`, Vidstack thumbnails | Sprite sheet indexing and hover preview behavior |

References are for studying shape and edge cases, not for importing large dependencies by default.

---

## `co-media-probe`

Server-only FFprobe wrapper.

### Minimal API

```js
import { probe } from 'co-media-probe'

const info = await probe('/media/Movie (1999).mkv', {
  ffprobe: 'ffprobe',
})
```

Returns normalized facts:

```js
{
  path,
  container,
  duration,
  bitrate,
  video: {
    codec,
    profile,
    width,
    height,
    fps,
    hdr,
  },
  audio: [
    { index, codec, channels, language }
  ],
  subtitles: [
    { index, codec, language, forced }
  ],
  chapters: [
    { start, title }
  ]
}
```

### UX Enabled

- Playback decisions can be made before the user presses play.
- The app can warn gracefully when a file is unlikely to play.
- The scanner can index duration, resolution, audio tracks, subtitles, and HDR status.

### Does Not Own

- Whether to transcode
- Browser/device policy
- Database writes
- Remote metadata lookup

### Implementation Target

One `index.js` plus focused tests. Spawn `ffprobe`, capture JSON, normalize. No framework, no ORM, no external npm dependencies.

### Implementation Notes

- Resolve binary path in this order: explicit option, `FFPROBE_PATH`, then `ffprobe` from `PATH`.
- Use `child_process.spawn`, not shell string execution.
- Run:

```bash
ffprobe -v error -print_format json -show_format -show_streams -show_chapters <path>
```

- Treat missing streams as empty arrays, not errors.
- Preserve raw `ffprobe` fields only behind an option such as `{ raw: true }`.
- Normalize duration and bitrate to numbers.
- Normalize stream language from tags when present.
- Detect HDR conservatively from `color_transfer`, `color_primaries`, and `pix_fmt`; avoid claiming HDR when unsure.

### Tests

- Fixture JSON for MP4/H.264/AAC.
- Fixture JSON for MKV/HEVC/multiple audio/subtitle tracks.
- Fixture JSON with missing bitrate/duration fields.
- Spawn failure returns a useful error.
- Invalid JSON returns a useful error.

### References

- Minimal baseline: `eugeneware/ffprobe`
- Modern interface shape: `@dropb/ffprobe`
- Capability/process details for later: `fluent-ffmpeg/lib/ffprobe.js`

---

## `co-media-file`

Server-side media file utilities: filename parsing, recursive discovery, and direct range serving.

### Minimal API

```js
import {
  isMediaFile,
  parseMediaName,
  scanMediaFiles,
  serveRange,
} from 'co-media-file'
```

```js
isMediaFile('/media/The Matrix (1999).mkv')

parseMediaName('Breaking Bad S03E07 - One Minute.mkv')
// { kind: 'episode', show: 'Breaking Bad', season: 3, episode: 7, title: 'One Minute' }

for await (const file of scanMediaFiles('/media')) {
  // { path, kind, parsed }
}

await serveRange(req, res, '/media/The Matrix (1999).mp4')
```

### UX Enabled

- New uploads appear in the library quickly.
- Direct-play files support browser seeking via HTTP range requests.
- The app gets enough parsed structure to group movies and episodes without a huge model.

### Does Not Own

- Library database schema
- Stable item IDs, unless exposed as a helper
- Watchers as a complex daemon
- Remote title matching
- Poster selection

### Watch Strategy

Do not start with a full watcher package. The final app can call `scanMediaFiles()`:

- On startup
- After upload completion
- On a simple interval
- From its own file watcher if needed

If a watcher is later added, keep it as a tiny optional helper with:

- Debounced change events
- Polling fallback
- Ignore patterns
- No DB coupling

### Implementation Notes

- Keep extension allowlists small and configurable.
- Default video extensions: `.mp4`, `.m4v`, `.mkv`, `.mov`, `.webm`, `.avi`, `.ts`.
- Default audio extensions: `.mp3`, `.flac`, `.m4a`, `.ogg`, `.opus`, `.wav`.
- Ignore common junk directories: `$RECYCLE.BIN`, `System Volume Information`, `.DS_Store`, `.actors`, `metadata`.
- `scanMediaFiles(root)` should be an async generator so callers can index progressively.
- Do not probe during scan by default; probing is a separate app decision because it is expensive.
- `parseMediaName()` should return best-effort structured data plus the cleaned title.
- Filename parsing should be heuristic, not strict. Prefer usable fallback over rejection.

### Range Serving Details

`serveRange(req, res, path)` should support:

- No `Range` header: `200` with full stream.
- Valid single range: `206` with `Content-Range`.
- Unsatisfiable range: `416` with `Content-Range: bytes */<size>`.
- `Accept-Ranges: bytes`.
- `Content-Length`.
- MIME type from extension, with a small local map.

Skip multi-range support initially. Browsers normally need single ranges for video seeking.

### Tests

- Filename parser fixtures for movie, dotted movie, episode, season folder, unknown video.
- Scanner ignores junk paths and yields only allowlisted media.
- Range serving tests for full response, partial response, suffix range, and invalid range.

### References

- Range behavior: `pillarjs/send`, `jshttp/range-parser`
- Parser shape: `video-name-parser`, `parse-torrent-title`
- Real-world scanner shape: `stremio-local-addon`

---

## `co-media-upload`

Small tus-compatible resumable upload support. Uploads are primarily local-network, so we intentionally forgo parallel chunk uploads.

### Why tus

Tus gives us a standard HTTP protocol for resumable upload. Generic tus clients can work with the server if we advertise only the capabilities we actually implement.

### Supported Subset

```
OPTIONS  /upload       advertise capabilities
POST     /upload       create upload resource
HEAD     /upload/:id   report current offset
PATCH    /upload/:id   append bytes at current offset
DELETE   /upload/:id   cancel upload, optional but useful
```

Advertise:

```http
Tus-Extension: creation,termination,expiration
```

Do not advertise:

```http
concatenation
checksum
creation-with-upload
```

Checksum can be added later if corruption becomes a real concern. Concatenation should remain deferred unless parallel upload throughput becomes necessary.

### Important Protocol Constraint

Core tus is sequential and offset-based. The server tracks one `Upload-Offset`; each `PATCH` appends bytes starting at that offset. That gives reliable resume behavior, but not parallel chunks.

That is acceptable here because local-network uploads should already be fast enough, and sequential tus is much smaller to implement correctly.

### Minimal API

```js
import { uploadServer, uploadFile } from 'co-media-upload'

uploadServer(app, {
  prefix: '/upload',
  dir: '.uploads',
  maxSize: 100 * 1024 * 1024 * 1024,
  ttl: 24 * 60 * 60 * 1000,
  onComplete({ id, path, metadata }) {
    // App moves file into the library and triggers a scan.
  },
})
```

```js
const upload = uploadFile(file, {
  endpoint: '/upload',
  metadata: { filename: file.name },
  onProgress({ uploaded, total }) {},
  onComplete(result) {},
  onError(error) {},
})

upload.pause()
upload.resume()
upload.cancel()
```

### Protocol Details

All tus responses should include:

```http
Tus-Resumable: 1.0.0
```

`OPTIONS /upload`:

```http
204 No Content
Tus-Version: 1.0.0
Tus-Extension: creation,termination,expiration
Tus-Max-Size: <bytes>
```

`POST /upload`:

- Requires `Upload-Length`.
- Accepts optional `Upload-Metadata`.
- Creates a temp upload record with offset `0`.
- Returns `201 Created` and `Location`.

`HEAD /upload/:id`:

- Returns `Upload-Offset`.
- Returns `Upload-Length`.
- Returns `Upload-Expires` when expiration is enabled.

`PATCH /upload/:id`:

- Requires matching `Upload-Offset`.
- Appends request body to the temp file.
- Returns `204 No Content` with new `Upload-Offset`.
- On offset mismatch, return `409 Conflict`.
- When offset equals length, atomically mark complete and call `onComplete`.

`DELETE /upload/:id`:

- Deletes temp file and metadata record.
- Returns `204 No Content`.

### Storage Model

Use one temp directory:

```text
.uploads/
  <id>.bin
  <id>.json
```

The JSON record stores:

```js
{
  id,
  length,
  offset,
  metadata,
  createdAt,
  updatedAt,
  expiresAt,
  complete
}
```

This avoids a database dependency and matches Cofound infra's vendorable style.

### Client Resume Model

- Store upload URL by file fingerprint in `localStorage`.
- Fingerprint can be `name:size:lastModified`.
- On resume, `HEAD` the upload URL and continue from returned offset.
- If the server returns `404` or expired state, create a new upload.

### Tests

- Create upload.
- PATCH first bytes, HEAD offset, PATCH remaining bytes.
- Resume from stored offset.
- Reject wrong offset with `409`.
- Complete upload calls `onComplete` exactly once.
- Delete removes temp files.
- Expired uploads are cleaned up.

### References

- Protocol: tus resumable upload spec.
- Client shape: `tus-js-client/lib/upload.ts`.
- Server handler organization: `tus-node-server` handlers.

### UX Enabled

- Huge file upload without timeout-prone single POSTs
- Resume after browser reload or network drop
- Pause/resume/cancel controls
- Progress bars
- Stale upload cleanup
- Post-upload scan hook

### Does Not Own

- Final media destination
- Library indexing
- Virus scanning
- Per-user quota policy
- Upload UI beyond a small primitive/helper

---

## `co-media-thumb`

Server-only FFmpeg thumbnail helpers.

### Minimal API

```js
import { extractFrame, makeTrickplay } from 'co-media-thumb'

await extractFrame('/media/movie.mkv', {
  at: 600,
  out: '/cache/movie-poster.webp',
  width: 640,
})

await makeTrickplay('/media/movie.mkv', {
  outDir: '/cache/movie-trickplay',
  every: 10,
  width: 160,
  columns: 10,
})
```

### UX Enabled

- Default thumbnail when remote posters are unavailable
- Chapter images
- Optional scrub-preview sprites in the player

### Does Not Own

- TMDb/OMDB lookup
- API keys
- Poster ranking
- Scheduled jobs
- Library cache schema

Remote artwork should be an app concern or a later optional `co-media-artwork` package.

### Implementation Notes

- Resolve FFmpeg path in this order: explicit option, `FFMPEG_PATH`, then `ffmpeg` from `PATH`.
- Use `spawn`, not shell strings.
- Prefer WebP output by default.
- `extractFrame()` should seek with `-ss` before input for speed unless accuracy is requested.
- `makeTrickplay()` should produce sprite images plus an index file.
- Keep concurrency outside the core helper at first; the app can queue jobs.

Example trickplay index:

```js
{
  width: 160,
  height: 90,
  interval: 10,
  columns: 10,
  sprites: [
    { url: 'sprite-000.webp', start: 0, count: 100 }
  ]
}
```

### Tests

- Argument construction tests.
- Missing FFmpeg reports a useful error.
- Trickplay index math maps timestamps to sprite coordinates.

### References

- Sprite behavior: `videojs-sprite-thumbnails`
- Player-side index formats: Vidstack thumbnail docs
- FFmpeg command/process handling: `fluent-ffmpeg/lib/processor.js`

---

## `co-player`

Client-side video primitive for polished playback. This should be a reusable player/controller, not the whole Netflix-style app.

### Minimal API

```js
import Player from 'co-player'

Player({
  src,
  type: 'video/mp4',
  poster,
  tracks,
  hls: false,
  onProgress({ currentTime, duration }) {},
  onEnded() {},
  onError(error) {},
})
```

### Initial Features

- HTML5 video wrapper
- Custom controls
- Keyboard controls
- Seek bar and buffered range display
- Volume, mute, fullscreen
- Subtitle track picker for VTT/TextTrack
- Progress events for the app to persist watch state
- Graceful error callback

### Optional Features

- HLS.js adapter
- Trickplay preview adapter
- ASS/SSA renderer adapter
- PGS renderer adapter

Optional means separate import or option, not a default dependency in the core player.

### Implementation Notes

- Core player should be plain Cofound UI around an HTML `<video>` element.
- Do not depend on HLS.js in the default import.
- Expose state through callbacks/events instead of app-specific persistence.
- Use native TextTrack for VTT first.
- Keep controls accessible: buttons need labels, keyboard focus must work, and shortcuts should not fire while inputs are focused.
- Persisting volume/mute is acceptable as a local player preference; watch progress is app-owned.

### Tests

- Renders video element with source and poster.
- Play/pause button calls video methods.
- Keyboard shortcuts seek/play/mute/fullscreen.
- Progress callback emits throttled current time.
- Track picker toggles VTT tracks.
- Error callback fires on media error.

### References

- Control behavior and accessibility: Media Chrome
- Player state and thumbnail/subtitle patterns: Vidstack
- HLS adapter later: HLS.js

### UX Enabled

- The final app can feel polished without reimplementing video controls from scratch.
- Watch progress and resume state are easy for the app to wire up.
- Unsupported playback can show an app-specific message instead of a raw browser error.

### Does Not Own

- Item APIs
- Watch-history persistence
- Media source selection policy
- Browse UI
- Remote metadata

---

## Deferred Streaming Work

The original plan included a full `co-media-stream` package with direct play, HLS, remux, transcode, hardware acceleration, subtitle burn-in, tone mapping, segment cleanup, and transcode throttling.

That is too much for a first Cofound infra pass.

### v0 Playback Policy

Start with:

- Probe media files.
- Prefer direct play.
- Serve direct-play files with range requests.
- Let the app show a clear unsupported-file state if direct play is not available.

### v1 Optional `co-media-hls`

Add only if real app testing shows enough common files fail direct play:

- FFmpeg remux to HLS
- Session temp directories
- M3U8 playlist generation
- Segment cleanup
- Seek restart support

Still avoid full video transcoding at this stage if possible.

### v2 Optional `co-media-transcode`

Add only after strong evidence:

- Video codec transcode
- Audio downmix/transcode
- Concurrency limits
- FFmpeg process lifecycle
- Maybe hardware acceleration detection

Defer or avoid:

- HDR tone mapping
- Subtitle burn-in
- Per-device hardware tuning
- Complex adaptive bitrate ladders

Those are legitimate media-server needs, but they are where a small infra package can become a large product.

---

## Final App Integration Shape

The separate NAS media app can compose the infra like this:

```js
uploadServer(app, {
  onComplete: async ({ path, metadata }) => {
    const finalPath = await moveIntoLibrary(path, metadata)
    const parsed = parseMediaName(finalPath)
    const media = await probe(finalPath)
    await db.items.upsert({ path: finalPath, parsed, media })
  },
})

app.get('/media/:id/file', async (req, res) => {
  const item = await db.items.get(req.params.id)
  await serveRange(req, res, item.path)
})
```

The app owns the workflow. Infra owns the small operations.

---

## Implementation Phases

### Phase 1 - Core Local Media

- `co-media-probe`
- `co-media-file`
- Direct range playback
- Basic tests with fixture filenames and mocked probe output

Goal: local files can be scanned, represented, and played directly when browser-compatible.

### Phase 2 - Upload UX

- `co-media-upload`
- Sequential tus subset
- Browser client helper with pause/resume/cancel
- Upload completion hook

Goal: huge local-network uploads feel reliable and recoverable.

### Phase 3 - Better Visual UX

- `co-media-thumb`
- `co-player`
- Frame extraction
- Player controls and progress events

Goal: the final app can feel polished without owning all playback mechanics.

### Phase 4 - Optional Compatibility

- `co-media-hls`, if direct play coverage is insufficient
- HLS.js adapter in `co-player`
- Remux-first streaming path

Goal: support common MKV/container incompatibilities without jumping straight to full transcoding.

### Phase 5 - Optional Transcoding

- `co-media-transcode`, only if necessary
- Explicit concurrency and cleanup model
- Minimal codec targets

Goal: handle truly incompatible files while keeping the heavy machinery isolated.

---

## Review Checklist For Each Package

Before implementing any package, answer:

1. What is the smallest useful API?
2. What final-app UX does it enable?
3. What policy does it refuse to own?
4. Can another project vendor this package without taking the rest?
5. Is the package still useful if the NAS media app never ships?
6. Can the first implementation fit in a few small files with focused tests?

If the answer to 4, 5, or 6 is no, the idea probably belongs in the final app or an optional later package.

---

## Summary

The original plan correctly identified the capabilities needed for a great Jellyfin alternative. v2 keeps those UX needs, but reshapes the infra into smaller primitives:

- Keep probe, file, upload, thumb, and player.
- Use a small sequential tus-compatible upload subset.
- Defer parallel upload, HLS, and full transcoding.
- Keep app schema, metadata, auth, browsing, and policy outside Cofound infra.

This gives the final app room to feel seamless without forcing Cofound infra to become a large media-server platform.
