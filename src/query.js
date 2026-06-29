import window from './window.js'

export default function Query(s, l) {
  const U = URLSearchParams
  const modifiers = ['append', 'delete', 'set', 'sort']
  let last = l.search
  let usp = new U(last)
  let temp

  const query = s.live()
  query.replace = x => (usp = new U(x), update())
  query.clear = () => query.replace('')

  for (const key in U.prototype)
    query[key] = (...xs) => (temp = USP()[key](...xs), modifiers.includes(key) && update(), temp)

  return query

  function USP() {
    return last === l.search ? usp : (last = l.search, usp = new U(last))
  }

  function update() {
    const target = l.pathname + (usp + '' ? '?' + (usp + '').replace(/=$/g, '') : '') + l.hash
    if (location.href.endsWith(target))
      return

    window.history.replaceState(
      window.history.state,
      null,
      target
    )
    query(l.search)
    s.redraw()
  }
}
