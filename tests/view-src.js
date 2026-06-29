import t from 'cofound/test'
import { srcChanged } from '../src/shared.js'

// A minimal stand-in for a media element: assigning `.src` resolves the value to
// an absolute URL against baseURI, exactly like a real <video>/<audio>/<img>.
function mediaEl(base = 'http://tustin.house/') {
  return {
    baseURI: base,
    _src: '',
    get src() { return this._src },
    set src(v) { this._src = new URL(v, this.baseURI).href },
  }
}

t`view-src`(
  // Regression: updateElement compared `dom.src` (the RESOLVED absolute URL) to
  // the view's relative `src` string. They never matched, so src was re-applied
  // on every redraw — and assigning a media element's src reloads it, restarting
  // playback. Any redraw (data load, poll) made <video>/<audio> loop the first
  // second forever. srcChanged resolves the candidate before comparing.
  t`treats an unchanged relative src as a no-op (no media reload)`(() => {
    const el = mediaEl()
    el.src = '/asset/abc/file'
    t.is('http://tustin.house/asset/abc/file', el.src) // browser resolves to absolute
    // The naive comparison that shipped the bug:
    t.is(true, el.src !== '/asset/abc/file')
    // srcChanged resolves first, so an unchanged src is correctly skipped:
    t.is(false, srcChanged(el, '/asset/abc/file'))
  }),

  t`detects a genuinely changed src`(() => {
    const el = mediaEl()
    el.src = '/asset/abc/file'
    t.is(true, srcChanged(el, '/asset/def/file'))
  }),

  t`treats an already-absolute, unchanged src as a no-op`(() => {
    const el = mediaEl()
    el.src = 'http://tustin.house/asset/abc/file'
    t.is(false, srcChanged(el, 'http://tustin.house/asset/abc/file'))
  }),

  t`falls back to identity comparison for non-string src`(() => {
    const el = mediaEl()
    const blob = {}
    t.is(true, srcChanged(el, blob))
  }),
)
