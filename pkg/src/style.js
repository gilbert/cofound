import window from './window.js'
import { isFunction, stackTrace, snake, asCssVar, hasOwn, isObservable, tryCall } from './shared.js'
import shorthands from './shorthands.js'

let style

const prefix = 's'
    , doc = window.document
    , vendorRegex = /^(ms|moz|webkit)[-A-Z]/i
    , div = doc.createElement('div')
    , unitsCache = new Map()
    , propCache = {}
    , unitCache = {}
    , loadCache = new Map()

export const aliasCache = {}
export const styleElement = x => style || (style = x || doc.querySelector('style.cofound') || doc.createElement('style'))
export const cssRules = () => style ? style.sheet.cssRules : []

export function load(href) {
  if (loadCache.has(href))
    return loadCache.get(href)

  const x = Object.assign(document.createElement('link'), { rel: 'stylesheet', href })
  document.head.appendChild(x)
  const promise = new Promise((resolve, reject) => {
    x.onload = () => resolve(x)
    x.onerror = reject
  })
  loadCache.set(href, promise)
  return promise
}

export const unit = (k, fn) => typeof fn === 'function'
  ? unitsCache.set(k.charCodeAt(0), fn)
  : Object.entries(k).forEach(([k, fn]) => unitsCache.set(k.charCodeAt(0), fn))

const pxCache = {
  flex: '',
  border: 'px',
  'line-height': '',
  'box-shadow': 'px',
  'border-top': 'px',
  'border-left': 'px',
  'border-right': 'px',
  'border-bottom': 'px',
  'text-shadow': 'px',
  '@media': 'px',
  '@container': 'px'
}

const properties = Array.from(
  Object.keys(hasOwn.call(div.style, 'width') ? div.style : Object.getPrototypeOf(div.style))
  .reduce((acc, x) => (acc.add(x.match(vendorRegex) ? '-' + snake(x) : snake(x)), acc), new Set(['float']))
)

const vendorMap = properties.reduce((acc, x) => {
  const vendor = x.match(/-(ms|o|webkit|moz)-/g)
  if (vendor) {
    const unprefixed = x.replace(/-(ms|o|webkit|moz)-/, '')
    if (properties.indexOf(unprefixed) === -1) {
      if (unprefixed === 'flexDirection')
        acc.flex = '-' + vendor[1].toLowerCase() + '-flex'
      acc[unprefixed] = x
    }
  }
  return acc
}, {})

const cache = new Map()
    , hashed = new Set()
    , cssVars = window.CSS && window.CSS.supports('color', 'var(--support-test)')
    , pxFunctions = ['perspective', 'blur', 'drop-shadow', 'inset', 'polygon', 'minmax']
    , nested = ['@media', '@container', '@supports', '@document', '@layer', '@starting-style']
    , isNested = x => nested.some(n => x.indexOf(n) === 0)
    , isPx = (prop, x) => prop === 'translate' || (x.indexOf('translate') === 0 || pxFunctions.indexOf(x) > -1)
    , isDeg = (prop, x) => prop === 'rotate' || x.indexOf('rotate') === 0 || x.indexOf('skew') === 0
    , isStartChar = x => x !== 32 && x !== 9 && x !== 10 && x !== 13 && x !== 59 // ws \t \n \r ;
    , isNumber = x => (x >= 48 && x <= 57) || x === 46 // 0 9 .
    , isCssVar = x => (x >= 65 && x <= 90) || (x >= 97 && x <= 122) || x ===  45 || x === 95 // azAZ-_
    , isUnit = x => x === 37 || (x >= 65 && x <= 90) || (x >= 97 && x <= 122) // % a-z A-Z
    , quoteChar = x => x === 34 || x === 39 // ' "
    , propEndChar = x => x === 32 || x === 58 || x === 9 // ws : \t
    , valueEndChar = x => x === 59 || x === 10 || x === 125 // ; \n }
    , noSpace = x => x === 38 || x === 58 || x === 64 || x === 91 // & : @ [
    , strict = x => x === 59 || x === 125
    , last = xs => xs[xs.length - 1]
    , selectors = []

let start = -1
  , valueStart = -1
  , classIdx = -1
  , idIdx = -1
  , startChar = -1
  , quote = -1
  , char = -1
  , prev = -1
  , lastSpace = -1
  , numberStart = -1
  , fontFaces = -1
  , cssVarAlpha = -1
  , cssVar = -1
  , temp = ''
  , prop = ''
  , path = '&&'
  , selector = ''
  , animation = ''
  , specificity = ''
  , keyframe = ''
  , rule = ''
  , keyframes = ''
  , name = ''
  , id = ''
  , classes = ''
  , x = ''
  , value = ''
  , varName = ''
  , rules = null
  , append = true
  , colon = false
  , styles = false
  , cacheable = true
  , hasRules = false
  , hash = 0
  , raw = false
  , fn = []

function shorthand(x) {
  return x.charCodeAt(0) === 36
    ? '--' + x.slice(1)
    : shorthands[x] || x
}

function propValue(r, x, v) {
  return (r ? ';' : '') + (colon ? x : renderProp(x)) + ':' + v + (prev === 33 ? 'important' : '')
}

function renderProp(x) {
  return propCache[x] || (propCache[x] = vendor(shorthand(x)))
}

function splitSelector(x) {
  return raw
    ? x
    : x.replace(/,\s*[:[&]?/g, x => noSpace(x.charCodeAt(x.length - 1)) ? ',&' + last(x) : ',& ')
}

function insert(rule, index) {
  if (append) {
    style && doc.head && doc.head.appendChild(style)
    append = false
  }

  if (style && style.sheet) {
    try {
      style.sheet.insertRule(
        rule,
        index != null ? index : style.sheet.cssRules.length
      )
    } catch (e) {
      console.error('Insert rule error:', e, rule) // eslint-disable-line
    }
  }
}

export function parse([xs, ...args], parent, nesting = 0, root = false) {
  style || styleElement()
  if (cache.has(xs)) {
    const cached = cache.get(xs)
    return {
      ...cached,
      parent,
      args
    }
  }

  raw = root
  const vars = {}
  fn = []
  path = '&&'
  name = id = classes = rule = value = prop = ''
  selectors.length = hash = 0
  lastSpace = valueStart = fontFaces = startChar = cssVar = cssVarAlpha = -1
  rules = raw ? {} : null
  hasRules = false
  styles = false
  cacheable = true

  x = xs[0]
  for (let j = 0; j < xs.length; j++) {
    rules
      ? parseStyles(0, j === xs.length - 1)
      : parseSelector(xs, j)

    x = xs[j + 1]
    if (j < args.length) {
      const before = xs[j].slice(valueStart)
      if (!root && cssVars && valueStart >= 0) {
        temp = prefix + Math.abs(hash).toString(31)
        vars[varName = '--' + temp + j] = { property: prop, fns: fn.slice(-1), unit: getUnit(prop, last(fn)), index: j, transform: cssVarAlpha !== -1 && getOpacityArg }
        value += before + 'var(' + varName + ')' + (cssVarAlpha === -1 ? '' : (cssVarAlpha = -1, ')'))
        valueStart = 0
      } else if (xs[j + 1].trim().charCodeAt(0) === 123) {
        temp = prefix + Math.abs(hash).toString(31)
        vars[varName = temp + j] = { index: j }
        selectors.push('[' + varName + ']')
      } else {
        const x = before + tryCall(args[j]) + getUnit(prop, last(fn))
        value += x
        for (let i = 0; i < x.length; i++)
          hash = Math.imul(31, hash) + x.charCodeAt(i) | 0
        cacheable = false
        valueStart = valueStart >= 0 ? 0 : cssVars ? -1 : 0
      }
    }
  }

  if (hasRules) {
    if (raw) {
      Object.entries(rules).forEach(([k, v]) => {
        insert(k.replace(/&\s+/g, '').replace(/{&$/, '') + '{' + v + '}')
      })
    } else {
      temp = prefix + Math.abs(hash).toString(31)
      classes += (classes ? ' ' : '') + temp
      specificity = nesting && '&'.repeat(nesting + 1)
      hashed.has(temp) || Object.entries(rules).forEach(([k, v]) => {
        specificity && (k = k.replace('&', '&'.repeat(nesting + 1)))
        insert(k.replace(/&/g, '.' + temp) + '{' + v + '}')
      })
    }
  }

  const result = {
    name,
    classes,
    id,
    args,
    vars,
    parent
  }

  cacheable
    ? cache.set(xs, result)
    : hashed.add(temp)

  return result
}

function parseSelector(xs, j) {
  for (let i = 0; i <= x.length; i++) {
    char = x.charCodeAt(i)
    i < x.length && (hash = Math.imul(31, hash) + char | 0)

    if (styles) {
      if (isStartChar(char)) {
        rules = {}
        parseStyles(i++, j === xs.length - 1)
        break
      }
    } else if (!isStartChar(char) || i === x.length) {
      classes = (classIdx !== -1
        ? x.slice(classIdx + 1, i).replace(/\./g, ' ')
        : ''
      ) + classes

      id === '' && (id = (idIdx !== -1
        ? x.slice(idIdx, classIdx === -1 ? i : classIdx)
        : ''
      ))

      name = x.slice(0, id
        ? idIdx - 1
        : (classIdx !== -1 ? classIdx : i)
      )
      idIdx = classIdx = -1
      styles = true
    } else if (char === 35) { // #
      idIdx = i + 1
    } else if (classIdx === -1 && char === 46) { // .
      classIdx = i
    }
  }
}

function aliases(x) {
  return aliasCache[x] || x
}

function parseStyles(idx, end) {
  for (let i = idx; i <= x.length; i++) { // rewrite to i < length and avoid NaN charCode
    prev = char
    char = x.charCodeAt(i)
    i < x.length && (hash = Math.imul(31, hash) + char | 0)

    if (quote === -1 && valueStart !== -1 && ((colon ? strict(char) : valueEndChar(char) || (end && i === x.length))))
      addRule(i)

    if (quote !== -1) {
      if (quote === char && x.charCodeAt(i - 1) !== 92) // \
        quote = -1
    } else if (quote === -1 && quoteChar(char)) {
      quote = char
      if (valueStart === -1)
        valueStart = i
    } else if (char === 123) { // {
      startBlock(i)
    } else if (char === 125 || (end && i === x.length)) { // }
      endBlock()
    } else if (i !== x.length && start === -1 && isStartChar(char)) {
      start = i
      startChar = char
    } else if (!prop && start >= 0 && propEndChar(char)) {
      prop = x.slice(start, i)
      colon = char === 58 // :
    } else if (valueStart === -1 && prop && !propEndChar(char)) {
      valueStart = lastSpace = i
      isNumber(char)
        ? (numberStart = i)
        : char === 36 && (cssVar = i)
    } else if (valueStart !== -1) {
      handleValue(i)
    } else if (char === 9 || char === 32) { // \t ws
      lastSpace = i + 1
    }
  }
}

function addRule(i) {
  afterValue(i)
  prop === '@import'
    ? insert(prop + ' ' + x.slice(valueStart, i) + ';', 0)
    : rule += propValue(rule, prop, value + x.slice(valueStart, i))
  hasRules = true
  start = valueStart = -1
  colon = false
  prop = value = ''
}

function afterValue(i) {
  cssVarAlpha !== -1
    ? addCssVarAlpha(i)
    : cssVar !== -1
    ? addCssVar(i)
    : numberStart !== -1 && addUnit(i)
}

function startBlock(i) {
  if (prop === 'animation') {
    rule && (rules[path] = rule)
    animation = value + x.slice(valueStart, i).trim()
    keyframes = value = ''
    rule = ''
  } else if (animation) {
    keyframe = x.slice(start, i).trim()
    rule = ''
  } else {
    rule && (rules[path] = rule)
    selector = (startChar === 64 // @
      ? aliases(prop) + (value || '') + x.slice(valueStart - 1, i)
      : x.slice(start, i)
    ).trim()
    selector.indexOf(',') !== -1 && (selector = splitSelector(selector))
    value = prop = ''
    selectors.push(
      (noSpace(startChar) ? '' : ' ')
      + selector
      + (
        selector === '@font-face' && ++fontFaces
          ? '/*' + Array(fontFaces).join(' ') + '*/' // unique font-face selector for rules
          : ''
      )
    )
    path = getPath(selectors)
    rule = rules[path] || ''
  }
  start = valueStart = -1
  prop = ''
}

function endBlock() {
  if (keyframe) {
    keyframes += keyframe + '{' + rule + '}'
    keyframe = rule = ''
  } else if (animation) {
    rule = rules[path] || ''
    temp = prefix + Math.abs(hash).toString(31)
    insert('@keyframes ' + temp + '{' + keyframes + '}')
    rule += propValue(rule, 'animation', animation + ' ' + temp)
    animation = ''
  } else {
    const closing = selectors.map(x => x.charCodeAt(0) === 64 && isNested(x) ? '}' : '').join('') // @
    selectors.pop()
    selectors.length && selectors[0].indexOf('@keyframes') === 0
      ? rules[selectors[0]] = (rules[selectors[0]] || '') + selector + '{' + rule + '}'
      : rule && (rules[path] = rule.trim() + closing)
    path = getPath(selectors)
    rule = rules[path] || ''
  }
  start = valueStart = -1
  prop = ''
}

function handleValue(i) {
  isNumber(char)
    ? numberStart === -1 && (numberStart = i)
    : char === 40
    ? cssVar = -1
    : afterValue(i)

  if (char === 40) { // (
    if (prev === 36) { // $
      value += x.slice(valueStart, i - 1) + 'calc('
      fn.push('calc')
      valueStart = i + 1
    } else {
      fn.push(x.slice(Math.max(lastSpace, valueStart), i))
    }
    lastSpace = i + 1
  } else if (char === 41) // )
    fn.pop()
  else if (char === 9 || char === 32) // \t ws
    lastSpace = i + 1
  else if (char === 36) // $
    cssVar = i
  else if (cssVar !== -1 && char === 47)// /
    cssVarAlpha = i
}

function addCssVar(i) {
  if (x.charCodeAt(i) === 47) { // /
    cssVarAlpha = i
  } else if (!isCssVar(char)) {
    value = value + x.slice(valueStart, cssVar) + 'var(--' + x.slice(cssVar + 1, i) + ')'
    valueStart = i
    cssVar = -1
  }
}

function addCssVarAlpha(i) {
  value = value
    + x.slice(valueStart, cssVar)
    + 'color-mix(in oklab, var(--' + x.slice(cssVar + 1, cssVarAlpha) + '), transparent '
    + (x.length === cssVarAlpha + 1 ? '' : getOpacity(x.slice(cssVarAlpha + 1, i), x.charCodeAt(i)) + ')')

  valueStart = i + 1
  cssVar = numberStart = -1
}

function getOpacity(x, after) {
  cssVarAlpha = -1
  return 100 - (x * (after === 37 ? 1 : 100)).toFixed(0) + '%' // %
}

function getOpacityArg(x) {
  return (100 - (typeof x === 'string' && x.charCodeAt(x.length - 1) === 37 ? x.slice(0, -1) : x * 100)).toFixed(0) + '%' // %
}

function addUnit(i) {
  if (isUnit(char)) {
    if (unitsCache.has(char)) {
      value = value + x.slice(valueStart, numberStart) + unitsCache.get(char)(x.slice(numberStart, i))
      valueStart = i + 1
    }
  } else if (x.charCodeAt(lastSpace) !== 35) { // #
    value = value + x.slice(valueStart, i) + getUnit(prop, last(fn))
    valueStart = i
  }
  numberStart = -1
}

function getUnit(prop, fn = '') {
  prop = shorthand(prop)
  if (prop.charCodeAt(0) === 45  && prop.charCodeAt(1) === 45) // -
    return ''

  const id = prop + ',' + fn
  if (hasOwn.call(unitCache, id))
    return unitCache[id]

  return unitCache[id] = (
    fn && isPx(prop, fn)
      ? 'px'
      : isDeg(prop, fn)
        ? 'deg'
        : fn
          ? ''
          : px(prop)
  )
}

export function formatValue(v, { property, fns, unit, transform }) {
  isFunction(v) && (v = window.isServerCofound && !isObservable(v) ? '6iacvt' : v())
  transform && (v = transform(v))
  if (!v && v !== 0)
    return ''

  if (typeof v === 'number')
    return v + unit

  typeof v !== 'string' && (v = '' + v)
  if (v.charCodeAt(0) === 36) // $
    return 'var(--' + v.slice(1) + ')'

  x = v
  value = ''
  valueStart = 0
  numberStart = lastSpace = -1
  prop = property
  fn = fns
  for (let i = 0; i <= v.length; i++) {
    char = v.charCodeAt(i)
    handleValue(i)
  }
  return value + v.slice(valueStart)
}

function getPath(selectors) {
  if (selectors.length === 0)
    return '&&'

  let n = 0
  return selectors.reduce((acc, x, i, xs) => {
    const char = x.charCodeAt(0)
    return char === 64 && (x.indexOf('@font-face') === 0 && i++, isNested(x)) // @
      ? (n++, x + '{' + (i === xs.length - 1 ? '&&' : '') + acc)
      : acc + (raw || (i - n) ? '' : char === 32 ? '&' : '&&') + x
  }, '')
}

function px(x) {
  x = shorthand(x)
  if (asCssVar(x) || hasOwn.call(pxCache, x))
    return pxCache[x]

  try {
    div.style[x] = '1px'
    div.style.setProperty(x, '1px')
    return pxCache[x] = div.style[x].slice(-3) === '1px' ? 'px' : ''
  } catch (err) {
    return pxCache[x] = ''
  }
}

function vendor(x) {
  if (properties.indexOf(x) === -1) {
    if (vendorMap[x])
      return vendorMap[x]

    x.indexOf('--') !== 0 && window.cofounddevhmr && window.console.error(x, 'css property not found') // eslint-disable-line
  }
  return x
}
