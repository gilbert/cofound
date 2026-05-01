// @ts-nocheck
import s from 'cos'
import t from 'cos/test'
import ssr from 'cos/ssr'

async function toHtml(x) {
  const result = await ssr(s.mount(() => x), {})
  return result.html
}

t`ssr`(
  t`style`(
    t`as object`(() => [
      '<!--h--><div style="color:red"></div>',
      toHtml(s('', { style: { color: 'red' } }))
    ]),
    t`as string`(() => [
      '<!--h--><div style="color:red"></div>',
      toHtml(s('', { style: 'color:red' }))
    ])
  ),
  t`css-vars`(
    t`as object`(() => [
      '<!--h--><div style="--color:red"></div>',
      toHtml(s('', { style: { '--color': 'red' } }))
    ]),
    t`as string`(() => [
      '<!--h--><div style="--color:red"></div>',
      toHtml(s('', { style: '--color:red' }))
    ]),
    t`embedded in template literal`(() => [
      '<!--h--><div style="--sauu0bf0:red"></div>',
      toHtml(s` color: ${'red'}`())
    ])
  ),
  t`className`(
    t`as string`(() => [
      '<!--h--><div class="a b"></div>',
      toHtml(s('', { className: 'a b' }))
    ]),
    t`as object`(() => [
      '<!--h--><div class="a b"></div>',
      toHtml(s('', { className: { a: true, b: true } }))
    ]),
    t`as object with false`(() => [
      '<!--h--><div class="a"></div>',
      toHtml(s('', { className: { a: true, b: false } }))
    ]),
    t`as object with null`(() => [
      '<!--h--><div class="a"></div>',
      toHtml(s('', { className: { a: true, b: null } }))
    ]),
    t`as object with undefined`(() => [
      '<!--h--><div class="a"></div>',
      toHtml(s('', { className: { a: true, b: undefined } }))
    ])
  ),
  t`class`(
    t`as string`(() => [
      '<!--h--><div class="a b"></div>',
      toHtml(s('', { class: 'a b' }))
    ]),
    t`as object`(() => [
      '<!--h--><div class="a"></div>',
      toHtml(s('', { class: { a: true, b: false } }))
    ])
  )
)
