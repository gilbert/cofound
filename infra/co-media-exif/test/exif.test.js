import assert from 'node:assert/strict'
import test from 'node:test'
import { exifCaptureDateMs, parseExifDateMs } from '../index.js'

// Build a minimal TIFF block: IFD0 with DateTime + a pointer to an Exif IFD
// holding DateTimeOriginal / DateTimeDigitized. Dates are 20-byte ASCII.
function tiffBlock({ original, digitized, plain, littleEndian = true } = {}) {
  const exifTags = [original && [0x9003, original], digitized && [0x9004, digitized]].filter(Boolean)
  const ifd0Tags = [plain && [0x0132, plain]].filter(Boolean)

  const ifd0Count = ifd0Tags.length + (exifTags.length ? 1 : 0)
  const ifd0Start = 8
  const ifd0End = ifd0Start + 2 + ifd0Count * 12 + 4
  const exifStart = exifTags.length ? ifd0End : 0
  const exifEnd = exifTags.length ? exifStart + 2 + exifTags.length * 12 + 4 : ifd0End
  const strings = [...ifd0Tags, ...exifTags].map(([, value]) => value)
  const size = exifEnd + strings.length * 20

  const buffer = new Uint8Array(size)
  const view = new DataView(buffer.buffer)
  const le = littleEndian

  buffer.set(le ? [0x49, 0x49] : [0x4d, 0x4d], 0)
  view.setUint16(2, 42, le)
  view.setUint32(4, ifd0Start, le)

  let stringAt = exifEnd
  const writeAscii = (offset, value) => {
    for (let i = 0; i < value.length; i++) buffer[offset + i] = value.charCodeAt(i)
  }
  const writeEntry = (at, tag, value) => {
    view.setUint16(at, tag, le)
    view.setUint16(at + 2, 2, le) // ASCII
    view.setUint32(at + 4, 20, le)
    view.setUint32(at + 8, stringAt, le)
    writeAscii(stringAt, value)
    stringAt += 20
  }

  view.setUint16(ifd0Start, ifd0Count, le)
  let at = ifd0Start + 2
  for (const [tag, value] of ifd0Tags) {
    writeEntry(at, tag, value)
    at += 12
  }
  if (exifTags.length) {
    view.setUint16(at, 0x8769, le)
    view.setUint16(at + 2, 4, le) // LONG
    view.setUint32(at + 4, 1, le)
    view.setUint32(at + 8, exifStart, le)
    at += 12
  }
  view.setUint32(at, 0, le)

  if (exifTags.length) {
    view.setUint16(exifStart, exifTags.length, le)
    let entry = exifStart + 2
    for (const [tag, value] of exifTags) {
      writeEntry(entry, tag, value)
      entry += 12
    }
    view.setUint32(entry, 0, le)
  }

  return buffer
}

function jpegWith(tiff) {
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]
  const length = payload.length + 2
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // unrelated APP0 to skip over
    0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...payload,
    0xff, 0xda, 0x00, 0x02,
  ])
}

const localMs = value => parseExifDateMs(value)

test('extracts DateTimeOriginal from a JPEG APP1 segment', () => {
  const jpeg = jpegWith(tiffBlock({ original: '2024:03:09 14:25:36', plain: '2026:01:01 00:00:00' }))
  assert.equal(exifCaptureDateMs(jpeg), localMs('2024:03:09 14:25:36'))
})

test('falls back to DateTimeDigitized, then DateTime', () => {
  const digitized = jpegWith(tiffBlock({ digitized: '2023:12:31 23:59:59', plain: '2026:01:01 00:00:00' }))
  assert.equal(exifCaptureDateMs(digitized), localMs('2023:12:31 23:59:59'))

  const plainOnly = jpegWith(tiffBlock({ plain: '2022:07:04 12:00:00' }))
  assert.equal(exifCaptureDateMs(plainOnly), localMs('2022:07:04 12:00:00'))
})

test('reads big-endian TIFF and bare TIFF buffers', () => {
  const bigEndian = jpegWith(tiffBlock({ original: '2021:05:06 07:08:09', littleEndian: false }))
  assert.equal(exifCaptureDateMs(bigEndian), localMs('2021:05:06 07:08:09'))

  const bare = tiffBlock({ original: '2020:02:29 10:11:12' })
  assert.equal(exifCaptureDateMs(bare), localMs('2020:02:29 10:11:12'))
})

test('returns null for non-JPEG, EXIF-less, truncated, and junk-date inputs', () => {
  assert.equal(exifCaptureDateMs(new Uint8Array([0x00, 0x01, 0x02])), null)
  assert.equal(exifCaptureDateMs(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02])), null)
  assert.equal(exifCaptureDateMs(new Uint8Array(0)), null)
  assert.equal(exifCaptureDateMs(null), null)
  assert.equal(exifCaptureDateMs('not bytes'), null)

  const valid = jpegWith(tiffBlock({ original: '2024:03:09 14:25:36' }))
  assert.equal(exifCaptureDateMs(valid.slice(0, 24)), null)

  const junk = jpegWith(tiffBlock({ original: '0000:00:00 00:00:00' }))
  assert.equal(exifCaptureDateMs(junk), null)
})

test('parseExifDateMs validates field ranges', () => {
  assert.equal(parseExifDateMs('2024:13:01 00:00:00'), null)
  assert.equal(parseExifDateMs('2024:00:01 00:00:00'), null)
  assert.equal(parseExifDateMs('2024:01:32 00:00:00'), null)
  assert.equal(parseExifDateMs('2024:01:01 24:00:00'), null)
  assert.equal(parseExifDateMs(''), null)
  assert.equal(parseExifDateMs(null), null)
  assert.equal(parseExifDateMs('2024:06:15 10:30:00'), new Date(2024, 5, 15, 10, 30, 0).getTime())
})
