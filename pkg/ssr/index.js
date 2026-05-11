import process from 'node:process'

import window from './window.js'

import s from 'cofound'
import query from '../src/query.js'
import router from '../src/router.js'
import { asLocation, wrap, voidTags } from './shared.js'
import { formatValue, cssRules } from '../src/style.js'
import {
  cleanHref,
  className,
  ignoredAttr,
  tryPromise,
  isPromise,
  isEvent,
  isFunction,
  getName,
  getId,
  asArray,
  notValue,
  hasOwn,
  mergeTag,
  noop,
  emptyObject,
  emptyArray,
  styleProp
} from '../src/shared.js'

class TimeoutError extends Error {}

let lastWasText = false
  , wasText = false

const noscript = process.env.COFOUND_NOSCRIPT
const ignoredServerAttr = x => x !== 'value' && x !== 'href' && x !== 'type' && x !== 'src' && x !== 'srcset' && ignoredAttr(x)
const $uid = Symbol('uid')
const defaultTimeout = 1000 * 60 * 2

export { wrap }
export default function(mount, serverAttrs = {}, serverContext = {}, browserAttrs, browserContext) {
  if (!mount)
    return {}

  let { view, attrs, context } = mount
  serverContext.location = window.location = asLocation(
    typeof serverContext.location === 'string'
      ? new URL(serverContext.location, 'http://localhost/')
      : serverContext.location || 'http://localhost/'
  )

  serverContext.View = s.View
  serverContext.query = query(s, window.location)

  const headers = {
    Server: 'cofound',
    'Content-Type': 'text/html; charset=UTF-8',
    ...(serverContext.headers || {})
  }

  let head = ''
    , links = new Set()

  const doc = {
    lang: s.live(),
    title: s.live(s.title),
    status: s.live(200),
    doctype: s.live('html'),
    links: s.live('', x => links.add(x)),
    head: s.live('', x => [].concat(x).forEach(x => head += typeof x === 'string' ? x : update(x, { ...context, noscript: true }))),
    headers: s.live({}, x => Object.assign(headers, x))
  }

  attrs = { ...attrs, ...serverAttrs }
  context = {
    ...context,
    noscript,
    ...serverContext,
    doc,
    [$uid]: 1,
    onremove: noop,
    ignore: noop,
    redraw: noop,
    refresh: noop,
    reload: noop
  }

  context.route = router(s, '', context)

  let x
  try {
    x = view(attrs, [], context)
  } catch (error) {
    x = context.error(error, attrs, [], context)
  }

  let result = updateChildren(asArray(x), context)
  isPromise(result) && (result =
    Promise.race([
      result,
      new Promise((r, e) => setTimeout(e, 'timeout' in context ? context.timeout : defaultTimeout, new TimeoutError()).unref())
    ]).catch(error => {
      context.doc.status(error instanceof TimeoutError ? 408 : 500)
      return tryPromise(updateChildren([].concat(context.error(error, attrs, [], context)), context), x => x)
    })
  )

  return tryPromise(result, x => {
    const css = '<style class=cofound>' + cssRules().join('') + '</style>'
    return {
      headers,
      links,
      status: context.doc.status(),
      doctype: context.doc.doctype(),
      title: context.doc.title() || s.title,
      lang: context.doc.lang(),
      css, // perhaps remove classes according to names in html
      html: (context.noscript || !mount ? '' : hydration(browserAttrs, browserContext)) + x,
      head
    }
  })
}

function undefinedIfEmpty(x) {
  for (const prop in x)
    if (x.hasOwnProperty(prop))
      return x
}

function hydration(a, c) {
  const attrs = undefinedIfEmpty(a)
  const context = undefinedIfEmpty(c)
  return attrs || context
    ? '<script h type="application/json">' + JSON.stringify({ context, attrs }) + '</script>'
    : '<!--h-->'
}

function update(view, context) {
  wasText = false
  const x = isFunction(view)
    ? update(view(), context)
    : view instanceof context.View
      ? view.component
        ? updateComponent(view, context)
        : updateElement(view, context)
      : view instanceof Promise
        ? update(s(() => view)(), context)
        : view instanceof window.Node
          ? view.trusted
          : Array.isArray(view)
            ? updateArray(view, context)
            : typeof view === 'boolean' || view == null
              ? updateComment(view, context)
              : (wasText = updateText(view, context))
  lastWasText = wasText
  wasText = false
  return x
}

function updateElement(view, context) {
  const tag = context.NS
    ? getName(view.tag)
    : (getName(view.tag) || 'div').toLowerCase()
  const internal = !String(view.attrs.href).match(/^[a-z]+:|\/\//)
  if (hasOwn.call(view.attrs, 'id') === false) {
    view.attrs === emptyObject && (view.attrs = { })
    const id = getId(view.tag)
    id && (view.attrs.id = id)
  }
  if (getName(view.tag) === 'a' && hasOwn.call(view.attrs, 'href') && internal) {
    view.attrs === emptyObject && (view.attrs = { })
    view.attrs.href = cleanHref(view.attrs.href)
    context.doc.links(view.attrs.href)
  }
  return view.children === emptyArray || view.children.length === 0
    ? elementString(view, tag, '')
    : tryPromise(updateChildren(view.children, context), x => elementString(view, tag, x))
}

function elementString(view, tag, content = '') {
  return openingTag(view, tag)
    + (voidTags.has(tag)
      ? ''
      : content + '</' + tag + '>'
    )
}

function openingTag(view, tag) {
  return '<'
    + tag
    + getClassName(view)
    + Object.entries(view.attrs).reduce((acc, [k, v]) => acc += renderAttr(k, v), '')
    + getStyle(view)
    + '>'
}

function getStyle(view) {
  let style = ''

  const a = view.tag.args
  for (const [k, v] of Object.entries(view.tag.vars))
    style += (style ? ';' : '') + k + ':' + formatValue(a[v.index], v)

  const s = view.attrs.style
  if (typeof s === 'string') {
    style += (style ? ';' : '') + s
  } else if (s !== null && typeof s === 'object') {
    for (const [k, v] of Object.entries(s))
      style += (style ? ';' : '') + styleProp(k) + ':' + v
  }

  return style && (' style="' + escapeAttrValue(style) + '"')
}

function renderAttr(k, v) {
  return ignoredServerAttr(k) || isEvent(k) || notValue(v)
    ? ''
    : (' ' + escapeAttr(k) + (
      v === true
        ? ''
        : '="' + escapeAttrValue(v) + '"'
    ))
}

function getClassName(view) {
  const classes = className(view)
  return classes
    ? ' class="' + escape(classes) + '"'
    : ''
}

function updateChildren(xs, context) {
  let async = false
  const results = xs.map(x => {
    const result = update(x, context)
    isPromise(result) && (async = true)
    return result
  })
  return async
    ? Promise.all(results).then(xs => xs.join(''))
    : results.join('')
}

function updateArray(xs, context) {
  let async = false
  const results = xs.map(x => {
    const result = update(x, context)
    isPromise(result) && (async = true)
    return result
  })

  const first = (context.noscript ? '' : '<!--[' + xs.length + '-->')
  return async
    ? Promise.all(results).then(x => first + x.join(''))
    : first + results.join('')
}

function updateText(view, context) {
  return (lastWasText && !context.noscript ? '<!--,-->' : '') + escape(view)
}

function updateComment(view) {
  return '<!--' + view + '-->'
}

function updateComponent(view, context) {
  let x = view.component[0](view.attrs, view.children, context)
  mergeTag(x, view)
  return tryPromise(x, (x, wasPromise) => {
    const asyncId = wasPromise && ('<!--a' + context[$uid]++ + '-->') || ''
    x && hasOwn.call(x, 'default') && (x = x.default) // we might be able to move check above
    isFunction(x) && (x = x(view.attrs, view.children, context))
    mergeTag(x, view)
    return tryPromise(update(x, context), x => (
      context.noscript ? '' : asyncId)
      + x
      + (context.noscript ? '' : asyncId.replace('a', '/a'))
    )
  })
}

function escape(x = '') {
  x = '' + x
  let s = ''
  let c = -1
  let l = -1
  for (let i = 0; i < x.length; i++) {
    c = x.charCodeAt(i)
    c === 60 ? s += x.slice(l + 1, l = i) + '&lt;' : // <
    c === 62 ? s += x.slice(l + 1, l = i) + '&gt;' : // >
    c === 38 && (s += x.slice(l + 1, l = i) + '&amp;') // &
  }
  return l !== -1
    ? s + x.slice(l + 1)
    : x
}

function escapeAttr(x = '') {
  let s = ''
  let c = -1
  let l = -1
  for (let i = 0; i < x.length; i++) {
    c = x.charCodeAt(i)
    c !== 45 && (c < 97 || c > 122) && (c < 65 || c > 90) && (s += x.slice(l + 1, l = i)) // -a-zA-Z
  }
  return s || x
}

function escapeAttrValue(x = '') {
  typeof x === 'string' || (x = '' + x)
  let s = ''
  let c = -1
  let l = -1
  for (let i = 0; i < x.length; i++) {
    c = x.charCodeAt(i)
    c === 34 ? s += x.slice(l + 1, l = i) + '&quot;' : // "
    c === 60 ? s += x.slice(l + 1, l = i) + '&lt;' :   // <
    c === 62 ? s += x.slice(l + 1, l = i) + '&gt;' :   // >
    c === 38 && (s += x.slice(l + 1, l = i) + '&amp;') // &
  }
  return l === -1 ? x : s + x.slice(l + 1)
}
