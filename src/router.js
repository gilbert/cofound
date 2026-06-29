import window from './window.js'
import {
  isFunction,
  isPromise,
  cleanSlash,
  cleanHref,
  scrollRestore
} from './shared.js'

let routing = false

const routeState = {}

function tokenizePath(x) {
  return x.split(/(?=\/)/)
}

function params(path, xs) {
  return path.reduce((acc, x, i) => {
    x[1] === ':' && (acc[x.slice(2)] = decodeURIComponent(xs[i].slice(1)))
    return acc
  }, {})
}

export default function router(s, root, rootContext, parent) {
  const location = route.location = rootContext.location
  const routed = s(({ key, route, ...attrs }, [view], context) => { // eslint-disable-line
    context.route = router(s, key.replace(/[/*?]$/, ''), rootContext, route)
    route.key = key
    return () => resolve(view, attrs, context)
  })

  route.root = parent ? parent.root : route
  route.parent = parent || route
  route.query = rootContext.query
  route.toString = route
  route.has = x => {
    const path = getPath(location)
    if ((x = x.replace(root, '')) === '/')
      return (path === root || (path === '/' && root === ''))
    const full = cleanHref(root + '/' + x)
    return path.indexOf(full) === 0 && (path[full.length] === undefined || path[full.length] === '/')
  }

  Object.defineProperty(route, 'path', {
    get() {
      const path = getPath(location)
          , idx = path.indexOf('/', root.length + 1)

      return idx === -1 ? path : path.slice(0, idx)
    }
  })

  return route

  function resolve(view, attrs, context) {
    let result = isFunction(view) ? view(attrs, [], context) : view
    return isPromise(result)
      ? s(() => result)(attrs)
      : result
  }

  function getPath(location, x = 0) {
    return decodeURIComponent(cleanSlash(s.route.prefix[0] === '#'
      ? location.hash.slice(s.route.prefix.length + x)
      : s.route.prefix[0] === '?'
        ? location.search.slice(s.route.prefix.length + x)
        : location.pathname.slice(s.route.prefix.length + x)
    ))
  }

  async function reroute(path, { state, replace = false, redraw=true, scroll = true } = {}) {
    if (path === getPath(location) + location.search)
      return

    if (s.is.server)
      return (rootContext.doc.status(302), rootContext.doc.headers({ Location: s.route.prefix + path }))

    s.route.prefix[0] === '#'
      ? window.location.hash = s.route.prefix + path
      : s.route.prefix[0] === '?'
      ? window.location.search = s.route.prefix + path
      : window.history[replace ? 'replaceState' : 'pushState'](state, null, s.route.prefix + path)
    routeState[path] = state
    path.indexOf(location.search) > -1 && rootContext.query(location.search)

    redraw && await s.redraw()

    scroll === false || s.route.scroll === false
      ? s.route.scroll = undefined
      : scrollRestore()
  }

  function popstate({ state = {} } = {}) {
    s.redraw().then(() => scrollRestore(...(state && state.scroll || [])))
  }

  function route(routes, options = {}) {
    if (typeof routes === 'undefined')
      return root + '/'

    if (typeof routes === 'string')
      return reroute(cleanHref(routes[0] === '/' ? routes : '/' + routes), options)

    if (!routing) {
      routing = true
      s.route.prefix[0] === '#'
        ? window.addEventListener('hashchange', popstate, { passive: true })
        : isFunction(window.history.pushState) && window.addEventListener('popstate', popstate, { passive: true })
    }

    const path = getPath(location, root.length)
        , pathTokens = tokenizePath(path)
        , { match, view } = matchRoutes(routes, pathTokens)
        , key = root + (match ? match.map((x, i) => x === '/*' ? '*' : x === '/?' ? '?' : pathTokens[i]).join('') : '?')

    if (view === undefined || match[0] === '/?')
      rootContext.doc.status(404)

    route.params = { ...route.parent.params, ...params(match || [], pathTokens) }

    return routed({
      key,
      route,
      ...route.params,
      ...(root + path === key && routeState[root + path] || window.history.state || {}),
      ...options
    },
      view
    )
  }
}

function matchRoutes(routes, paths) {
  let max = 0
  let match
  let view

  function tryMatch(m, v) {
    m.charCodeAt(0) !== 47 && (m = '/' + m) // /
    m = tokenizePath(cleanSlash(m))

    if (typeof v === 'object' && v != null) {
      for (let key in v)
        tryMatch(m + key, v[key])
      return
    }

    const score = getScore(m, paths)
    if (score > max) {
      max = score
      match = m
      view = v
    }
  }

  for (const x in routes)
    tryMatch(x, routes[x])

  return { match, view }
}

function getScore(match, path) {
  return match.reduce((acc, x, i) =>
    acc + (
      x === '/?' ? 1
      : x === path[i] ? 7
      : x && path[i] && x.toLowerCase() === path[i].toLowerCase() ? 6
      : x[1] === ':' && path[i] && path[i].length > 1 ? 5
      : x === '/' && !path[i] ? 4
      : x.indexOf('/...') === 0 ? 3
      : x === '/*' ? 2
      : -Infinity
    )
  , 0)
}
