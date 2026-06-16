# co-media-exif

Small, dependency-free EXIF capture-date extraction.

This package walks JPEG APP1 segments (or a bare TIFF buffer) for the standard EXIF date tags and returns the capture time in epoch milliseconds. It deliberately avoids full EXIF parsing, thumbnails, GPS, and writing — apps that need "when was this photo taken" can read a file head and ask.

## API

```js
import { exifCaptureDateMs, parseExifDateMs } from 'co-media-exif'
import { readFile } from 'node:fs/promises'

const buffer = await readFile('photo.jpg') // the first ~128 KB is enough
const ms = exifCaptureDateMs(buffer)       // number | null
```

Tag priority: `DateTimeOriginal` (0x9003), then `DateTimeDigitized` (0x9004), then IFD0 `DateTime` (0x0132). Both byte orders are supported.

EXIF datetimes carry no timezone, so values are interpreted in the host's local time — the usual convention for capture-date displays.

`exifCaptureDateMs` accepts a `Uint8Array`/`Buffer` or `ArrayBuffer` and never throws: malformed, truncated, or EXIF-less input returns `null`. `parseExifDateMs('YYYY:MM:DD HH:MM:SS')` is exported for callers that already hold the string.

## Known gap: no HEIC

Only JPEG (APP1) and bare TIFF are parsed. **HEIC/HEIF is not supported** —
its EXIF lives in an item inside the ISO-BMFF `meta` box, which this parser
does not walk, so `exifCaptureDateMs` returns `null` for HEIC. Callers fall
back to a supplied capture date (e.g. the Immich app's `fileCreatedAt`) or the
file modification time. To close this, locate the EXIF item in the `meta` box
and hand its embedded TIFF block to this parser. (Context: `canister/docs/immich.md`.)
