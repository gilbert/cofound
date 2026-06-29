const charCodeAt = String.prototype.charCodeAt

export default function(s, fn) {
  const length = lastIndex(s)

  if (length === -1)
    return s

  const blocks = []
      , starts = []

  let x = ''
    , t = ''
    , n = 0
    , v = 0
    , m = 0
    , r = -1
    , b = -1
    , i = -1
    , c = -1
    , l = -1
    , u = -1
    , mc = -1
    , vc = -1
    , rc = -1
    , lend = 0
    , last = 0
    , start = 0
    , lstart = 0
    , lb = false

  for (i = 0; i < length; i++) {
    c = charCodeAt.call(s, i)

      b === 39  ?  c === 39  && l !== 92 && pop(1, 0, true)  // ' \
    : b === 34  ?  c === 34  && l !== 92 && pop(1, 0, true)  // " \
    : b === 96  ?  c === 96  ?  l !== 92 && pop(1, 0, true)  // ` \
    : l === 36  && c === 123 && u !== 92 && push(36)         // $ { \
    : b === 42  ?  c === 47  && l === 42 && pop(-1, 1)       // * /
    : b === 47  ?  c === 10  && pop(-1, 0)                   // / \n
    : b === 36  && c === 125 ? pop(1, 0)                     // $ }
    : b === 91  && c === 93  ? pop()                         // [ ]
    : b === 40  && c === 41  ? pop(1, 0)                     // ( )
    : b === 123 && c === 125 ? pop(0, 1)                     // { }
    : b === 112 && c === 125 ? pop(0, 1)                     // p }
    : c === 47  && l === 47  ? push(c)                       // / /
    : c === 42  && l === 47  ? push(c)                       // / *
    : c === 34  ?  push(c)                                   // "
    : c === 39  ?  push(c)                                   // '
    : c === 96  ?  push(c)                                   // `
    : c === 40  ?  push(c)                                   // (
    : c === 91  ?  push(c)                                   // [
    : c === 123 ?  push(c)                                   // {
    : n === 0   && (c === 10 || c === 59) ? (r = rc = -1)    // \n ;
    : ws(c) || (v = i + 1, vc = c, r === -1 && (r = i, rc = c))

    u = l
    l = c
  }

  return x + s.slice(last)

  function push(c) {
    n++
    if (b !== -1) {
      blocks.push(b)
      starts.push(start)
    }
    b = c
    start = i

    if (b === 123 && (rc === 101 || rc === 105) && ((t = s.slice(r, r + 6)) === 'import' || t === 'export')) {
      b = 112
    } else if (b === 40) {  // (
      m = v
      mc = vc
    }
  }

  function pop(ob = 0, oe = 0, string = false) {
    if (!n)
      return

    n--

    if (lb && b === 40 && mc === 116 && s.charCodeAt(m - 6) === 105 && s.slice(m - 6, m) === 'import') { // ( t i
      t = s.slice(lstart, lend)
      if (t.length === s.slice(start + ob, i + oe).trim().length - 2) {
        x += s.slice(last, lstart) + fn(t)
        last = lend
      }
    } else if (string && n === 0 && (rc === 101 || rc === 105) && port(s.slice(r, r + 6))) {
      x += s.slice(last, start + ob) + fn(s.slice(start + ob, i + oe))
      last = i + oe
    }

    lend = i
    lstart = start + 1
    lb = string
    if (n === 0) {
      b === 112 || (r = rc = -1)
      b = -1
      start = -1
    } else {
      b = blocks.pop()
      start = starts.pop()
    }
  }

  function port(x) {
    return x === 'import' || (x === 'export' && s.slice(v - 4, v) === 'from')
  }

  function ws(c) {
    return c === 9 || c === 10 || c === 13 || c === 32 // \t \n \r space
  }

}

function lastIndex(s, imp = s.lastIndexOf('import'), from = s.lastIndexOf('export ')) {
  if (imp === -1 && from === -1)
    return -1

  let c = -1
    , b = -1
    , i = -1
    , l = -1

  for (i = Math.max(imp, from); i < s.length; i++) {
    c = s.charCodeAt(i)
    if (b === 34 || b === 39 || b === 96) { // " ' `
      if (b === c && l !== 92) // \
        break
    } else if (b === 123) {                 // {
      b = -1
    } else if (c === 34 || c === 39 || c === 96 || c === 123) { // " ' ` {
      b = c
    }
    l = c
  }

  return Math.min(i + 20, s.length)
}
