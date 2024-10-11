import { customAlphabet } from 'nanoid'

const ALPHABET = {
  standard: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  domainFriendly: '0123456789abcdefghijklmnopqrstuvwxyz',
}

export type UidAlphabet = keyof typeof ALPHABET

export function generateUid(length: number, alphabet: UidAlphabet = 'standard') {
  return customAlphabet(ALPHABET[alphabet], length)()
}
