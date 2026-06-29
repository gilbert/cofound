import crypto from 'node:crypto'

// Vendored from nanoid (https://github.com/ai/nanoid)
// Only the customAlphabet function, no npm dependency needed

export function customAlphabet(alphabet, defaultSize) {
  const mask = (2 << (31 - Math.clz32((alphabet.length - 1) | 1))) - 1
  const step = Math.ceil((1.6 * mask * defaultSize) / alphabet.length)
  return (size = defaultSize) => {
    let id = ''
    while (true) {
      const bytes = crypto.randomBytes(step)
      for (let i = 0; i < step; i++) {
        const byte = bytes[i] & mask
        if (alphabet[byte]) {
          id += alphabet[byte]
          if (id.length === size) return id
        }
      }
    }
  }
}

export function nanoid(size = 21) {
  return customAlphabet(
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_',
    size,
  )()
}
