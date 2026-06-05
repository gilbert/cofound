# co-media-library

Small media library indexer.

This package turns media files on disk into stable records an app can cache, list, search, and play. It deliberately avoids UI, users, permissions, remote metadata, playback state, thumbnails, and transcoding.

## API

```js
import { jsonStorage, openLibrary } from 'co-media-library'
import { probe } from 'co-media-probe'

const library = await openLibrary({
  roots: ['media'],
  storage: jsonStorage('.media-library.json'),
  probe,
})

await library.scan()

const items = library.items()
const item = library.get(items[0].id)
```

`storage` is required. It must provide:

```js
{
  loadAll() {},       // returns all persisted records
  saveOne(record) {}, // upserts one changed or deleted record
}
```

Use `jsonStorage(file)` for a quick local JSON index.

## Record Shape

```js
{
  id,
  root,
  path,
  pathId,
  rel,
  name,
  type,
  parsed,
  size,
  mtimeMs,
  updatedAt,
  scannedAt,
  fingerprint,
  probe,
  deleted,
  deletedAt,
  movedFrom,
  movedAt,
}
```

Initial IDs are deterministic from resolved `root` plus relative path. Changed files keep the same ID. Deleted files are saved as tombstones with `deleted: true`.

Renames and moves keep the same ID when the scanner can make a conservative weak-fingerprint match in one scan. The match only happens when exactly one active record went missing and exactly one new file has the same fingerprint. Ambiguous matches and previously deleted tombstones stay as one deleted record plus one added record.

`pathId` is always deterministic from the current path. It can differ from `id` after a detected move.

## Scan Result

```js
{
  added,
  changed,
  unchanged,
  moved,
  deleted,
  total,
}
```

`probe(file)` is optional. Probe data is reused while `size`, `mtimeMs`, and `fingerprint` are unchanged.

## Move Detection

By default each file gets a weak fingerprint from its byte size plus up to 1 MB sampled across the start, middle, and end of the file. You can tune the scan:

```js
await library.scan({
  fingerprintBytes: 1024 * 1024,
})
```

Set `fingerprint: false` to disable move detection, or pass `fingerprint(file, stat)` to provide your own fingerprint.

## Known Missing Edge Cases

- No database adapter is included beyond `jsonStorage()`.
- No directory watcher or background daemon.
- No locking across multiple processes writing the same JSON file.
- Move detection is intentionally weak and conservative. Files with matching size plus sampled bytes can collide, and ambiguous matches or previously deleted tombstones are ignored.
- No remote metadata matching, artwork, collections, seasons, users, permissions, watch state, or transcoding.
- Probe errors are not swallowed. Apps that want partial scan success should wrap their probe function.

## Development

Run tests:

```sh
npm test
```
