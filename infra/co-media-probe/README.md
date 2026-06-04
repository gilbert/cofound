# co-media-probe

Small, dependency-free FFprobe wrapper for normalized media facts.

This package shells out to `ffprobe`, parses its JSON output, and returns the small set of fields a media app usually needs before deciding how to display or play a file.

## API

```js
import { probe, normalizeProbe } from 'co-media-probe'

const info = await probe('/media/The Matrix (1999).mkv', {
  ffprobe: '/opt/homebrew/bin/ffprobe',
})

console.log(info.video.codec)
console.log(info.audio)
```

`probe(path, options)` runs:

```sh
ffprobe -v error -print_format json -show_format -show_streams -show_chapters <path>
```

The binary is resolved in this order:

- `options.ffprobe`
- `FFPROBE_PATH`
- `ffprobe` from `PATH`

`normalizeProbe(json, options)` is exported for tests and callers that already have FFprobe JSON.

## Result Shape

```js
{
  path,
  container,
  duration,
  bitrate,
  video: {
    index,
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

Pass `{ raw: true }` to keep the original FFprobe JSON under `result.raw`.

## Errors

`probe()` throws `MediaProbeError` when:

- `ffprobe` cannot be started
- `ffprobe` exits nonzero
- stdout is not valid JSON

The error message is intended to be useful for logs. App-level user messaging should still be handled by the app.

## Known Missing Edge Cases

- Only the first video stream is normalized as `video`; secondary camera angles or cover-art video streams are not modeled separately.
- HDR detection is conservative and does not fully classify Dolby Vision, HDR10+, HLG metadata variants, mastering display metadata, or tone-mapping needs.
- Subtitle normalization only covers codec, language, and forced flag. It does not classify external subtitles, default subtitles, hearing-impaired tracks, PGS renderability, or ASS/SSA styling needs.
- Audio normalization does not expose sample rate, layout names, channel layout, default track, title, commentary flags, bit depth, or Atmos/DTS:X metadata.
- Container format is reported from FFprobe's raw `format_name`; it is not collapsed into a single friendly label.
- Corrupt or partially downloaded files are only reported as FFprobe failures; there is no recovery or partial probing mode.
- Chapter data is minimal and does not include end time.
- There is no browser compatibility policy. The final app should decide whether a probed file is direct-playable.

## Development

Run tests:

```sh
npm test
```

The deterministic tests use FFprobe JSON fixtures. If `ffprobe` is installed, the smoke test also probes media in `tmp-samples/`.
