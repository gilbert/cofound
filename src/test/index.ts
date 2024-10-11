export function makeRandom(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x9e3779b9) | 0
    let t = seed ^ (seed >>> 16)
    t = Math.imul(t, 0x21f0aaad)
    t = t ^ (t >>> 15)
    t = Math.imul(t, 0x735a2d97)
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296
  }
}

export const seed = +process.env.TEST_SEED! || Math.floor(Math.random() * 800) + 120
console.log('Using seed', seed)

export const seededRandom = makeRandom(seed)
export const seededRandomInt = (min: number, max: number) =>
  Math.floor(seededRandom() * (max - min + 1)) + min
