export const voidTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

export function parseAcceptEncoding(x, preferred = []) {
  return (x || '').split(',')
    .map(x => (x = x.split(';q='), { type: x[0].trim(), q: parseFloat(x[1] || 1) }))
    .filter(x => x.q !== 0)
    .sort((a, b) => b.q === a.q
      ? preferred.indexOf(a.type) - preferred.indexOf(b.type)
      : b.q - a.q)
}

export function asLocation(x) {
  return {
    hash: x.hash,
    host: x.host,
    hostname: x.hostname,
    href: x.href,
    origin: x.origin,
    pathname: x.pathname,
    port: x.port,
    protocol: x.protocol,
    search: x.search
  }
}

export function wrap({
  html = '',
  css = '',
  title = '',
  doctype = 'html',
  head = '',
  lang = ''
}, {
  body = '',
  head: serverHead = ''
} = {}) {
  return html.slice(0, 15).toLowerCase() === '<!doctype html>'
      ? html.replace('</head>', head + css + '</head>').replace('</body>', body + '</body>')
      : `<!doctype ${doctype}><html${ lang ? ' lang="' + lang + '"' : '' }><head><meta charset="utf8"><title>${
          title
        }</title><meta name="viewport" content="width=device-width, initial-scale=1">${
          serverHead + head + css
        }</head><body>${
          html + body
        }</body></html>`
}
