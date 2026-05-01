import window from './window.js' // eslint-disable-line
import {
  hasOwn,     // eslint-disable-line
  stackTrace, // eslint-disable-line
  emptyObject,
  emptyArray
} from './shared.js'

export default class View {
  constructor(inline, component, tag = null, nesting = 0, attrs = emptyObject, children = emptyArray) {
    this.nesting = nesting
    this.component = component
    this.inline = inline
    this.tag = tag
    this.attrs = attrs
    this.key = attrs ? attrs.key : undefined
    this.dom = null
    this.children = children
    // dev-stack
  }
}
