// Stolen and modified from https://github.com/porsager/datie
// @ts-nocheck

/**
 * Simple date formatter. Converts a Date, string, or number into a specified string. Useful examples:
 * - `formatDate('yyyy-MM-dd HH:mm:ss', new Date())` => '2021-01-01 00:00:00'
 * - `formatDate('MMMM do, yyyy', new Date())` => 'January 1st, 2021'
 * - `formatDate('EEE, MMM d', new Date())` => 'Fri, Jan 1'
 * - `formatDate('hh:mm a', new Date())` => '12:00 AM'
 */
export function formatDate(formatString: string, date: Date | string | number) {
  const fns = []
  let l = 0
  for (let i = 0; i < formatString.length; i++)
    if (formatString[i] !== formatString[i + 1]) {
      fns.push(f[formatString.slice(l, i + 1)] || formatString.slice(l, i + 1))
      l = i + 1
    }
  const x = new Date(date)
  let last
  return fns.map((fn) => (last = typeof fn === 'function' ? fn(x, last) : fn)).join('')
}

const weekMS = 1000 * 60 * 60 * 24 * 7,
  pad = (x) => (x > 9 ? x : '0' + x)

const f = {
  y: (x) => x.getFullYear(),
  yy: (x) => String(f.y(x)).slice(-2),
  yyyy: (x) => f.y(x),
  M: (x) => x.getMonth() + 1,
  MM: (x) => pad(f.M(x)),
  MMMM: (x) => formatDate.names.months[x.getMonth()],
  MMM: (x) => f.MMMM(x).slice(0, 3),
  MMMMM: (x) => f.MMMM(x)[0],
  d: (x) => x.getDate(),
  dd: (x) => pad(f.d(x)),
  e: (x) => x.getDay(),
  ee: (x) => pad(f.e(x)),
  EEEE: (x) => formatDate.names.days[f.e(x)],
  E: (x) => f.EEEE(x).slice(0, 3),
  EE: (x) => f.E(x),
  EEE: (x) => f.E(x),
  EEEEE: (x) => f.E(x).slice(0, 2),
  EEEEEE: (x) => f.E(x)[0],
  H: (x) => x.getHours(),
  HH: (x) => pad(f.H(x)),
  h: (x) => f.H(x),
  hh: (x) => f.HH(x),
  m: (x) => x.getMinutes(),
  mm: (x) => pad(f.m(x)),
  s: (x) => x.getSeconds(),
  ss: (x) => pad(f.s(x)),
  w: (x) => {
    x = new Date(x)
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7) + 3)
    const firstThursday = x.getTime()
    x.setMonth(0, 1)
    if (x.getDay() !== 4) x.setMonth(0, 1 + ((4 - x.getDay() + 7) % 7))
    return 1 + Math.ceil((firstThursday - x) / weekMS)
  },
  ww: (x) => pad(f.w(x)),
  o: (x, p) => ['', 'st', 'nd', 'rd'][(p % 100 >> 3) ^ 1 && p % 10] || 'th',
}

formatDate.names = {
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  // prettier-ignore
  months: ['January', 'February', 'March', 'April', 'May',   'June', 'July', 'August', 'September', 'October', 'November', 'December',  ],
}
