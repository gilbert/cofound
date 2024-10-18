import { v4 as uuidv4 } from 'uuid'

export function newUuidV4() {
  return uuidv4()
}

export function newUuidV4Buffer() {
  const buffer = Buffer.alloc(16)
  uuidv4(null, buffer)
  return buffer
}

export function bufferToUuidString(buffer: Buffer) {
  return [
    buffer.subarray(0, 4).toString('hex'),
    buffer.subarray(4, 6).toString('hex'),
    buffer.subarray(6, 8).toString('hex'),
    buffer.subarray(8, 10).toString('hex'),
    buffer.subarray(10, 16).toString('hex'),
  ].join('-')
}

export function stringToUuidBuffer(str: string) {
  return Buffer.from(str.replace(/-/g, ''), 'hex')
}
