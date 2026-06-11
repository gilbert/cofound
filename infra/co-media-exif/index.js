// Minimal, dependency-free EXIF capture-date extraction.
//
// Walks JPEG APP1 segments (or a bare TIFF buffer) for the standard date
// tags and returns the capture time in epoch milliseconds. EXIF datetimes
// carry no timezone, so values are interpreted in the host's local time —
// the usual convention for "when was this photo taken" displays.

const TAG_EXIF_IFD = 0x8769
const TAG_DATETIME_ORIGINAL = 0x9003
const TAG_DATETIME_DIGITIZED = 0x9004
const TAG_DATETIME = 0x0132

export function exifCaptureDateMs(input) {
  try {
    const buffer = toUint8(input)
    if (!buffer) return null
    const tiff = findTiff(buffer)
    if (tiff == null) return null
    const dates = readDateTags(buffer, tiff)
    const raw = dates.get(TAG_DATETIME_ORIGINAL)
      ?? dates.get(TAG_DATETIME_DIGITIZED)
      ?? dates.get(TAG_DATETIME)
    return raw ? parseExifDateMs(raw) : null
  } catch {
    return null
  }
}

export function parseExifDateMs(value) {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(value || '').trim())
  if (!match) return null
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number)
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null
  if (hour > 23 || minute > 59 || second > 60) return null
  const date = new Date(year, month - 1, day, hour, minute, second)
  return Number.isFinite(date.getTime()) ? date.getTime() : null
}

function toUint8(input) {
  if (input instanceof Uint8Array) return input
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  return null
}

// Locate the TIFF header: either the buffer is a JPEG whose APP1 segment
// carries "Exif\0\0" + TIFF, or the buffer is already TIFF ("II"/"MM").
function findTiff(buffer) {
  if (isTiffAt(buffer, 0)) return 0
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null

  let offset = 2
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return null
    const marker = buffer[offset + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2
      continue
    }
    if (marker === 0xda) return null // start of scan — no APP1 found
    const length = (buffer[offset + 2] << 8) | buffer[offset + 3]
    if (length < 2) return null
    if (marker === 0xe1) {
      const start = offset + 4
      if (hasBytes(buffer, start, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]) && isTiffAt(buffer, start + 6)) {
        return start + 6
      }
    }
    offset += 2 + length
  }
  return null
}

function isTiffAt(buffer, offset) {
  if (offset + 8 > buffer.length) return false
  const little = buffer[offset] === 0x49 && buffer[offset + 1] === 0x49
  const big = buffer[offset] === 0x4d && buffer[offset + 1] === 0x4d
  if (!little && !big) return false
  return readU16(buffer, offset + 2, little) === 42
}

function readDateTags(buffer, tiff) {
  const little = buffer[tiff] === 0x49
  const dates = new Map()
  const ifd0 = tiff + readU32(buffer, tiff + 4, little)
  let exifIfd = null

  walkIfd(buffer, tiff, ifd0, little, (tag, valueOffset, type, count) => {
    if (tag === TAG_EXIF_IFD) exifIfd = tiff + readU32(buffer, valueOffset, little)
    if (tag === TAG_DATETIME) saveAscii(dates, tag, buffer, tiff, valueOffset, type, count, little)
  })
  if (exifIfd != null) {
    walkIfd(buffer, tiff, exifIfd, little, (tag, valueOffset, type, count) => {
      if (tag === TAG_DATETIME_ORIGINAL || tag === TAG_DATETIME_DIGITIZED) {
        saveAscii(dates, tag, buffer, tiff, valueOffset, type, count, little)
      }
    })
  }
  return dates
}

function walkIfd(buffer, tiff, ifd, little, visit) {
  if (ifd < tiff || ifd + 2 > buffer.length) return
  const count = readU16(buffer, ifd, little)
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12
    if (entry + 12 > buffer.length) return
    const tag = readU16(buffer, entry, little)
    const type = readU16(buffer, entry + 2, little)
    const valueCount = readU32(buffer, entry + 4, little)
    visit(tag, entry + 8, type, valueCount)
  }
}

function saveAscii(dates, tag, buffer, tiff, valueOffset, type, count, little) {
  if (type !== 2 || count < 1 || count > 64) return
  // Values longer than 4 bytes live at an offset relative to the TIFF header.
  const start = count <= 4 ? valueOffset : tiff + readU32(buffer, valueOffset, little)
  if (start < 0 || start + count > buffer.length) return
  let text = ''
  for (let i = 0; i < count; i++) {
    const byte = buffer[start + i]
    if (byte === 0) break
    text += String.fromCharCode(byte)
  }
  if (text) dates.set(tag, text)
}

function hasBytes(buffer, offset, bytes) {
  if (offset + bytes.length > buffer.length) return false
  return bytes.every((byte, i) => buffer[offset + i] === byte)
}

function readU16(buffer, offset, little) {
  return little
    ? buffer[offset] | (buffer[offset + 1] << 8)
    : (buffer[offset] << 8) | buffer[offset + 1]
}

function readU32(buffer, offset, little) {
  return little
    ? (buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24)) >>> 0
    : ((buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3]) >>> 0
}
