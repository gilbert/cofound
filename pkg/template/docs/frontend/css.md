# CSS

Element styling can be expressed inline and allows for expressive cascades. The `:` and `;` are optional for single line definitions.

```js
s`span
  font-size 16px
  text-decoration underline
  color pink
`
```

> It's not possible to mix shorthand and standard styling conventions. Pick one style per component:
>
> ```diff
> +  font-size 16
> +  fs 16
> +  font-size: 16;
> -  fs: 16;
> -  font-size: 16
> -  font-size 16;
> ```

## Styles `s.css`

The `s.css` method defines global stylesheets that can be used anywhere in your application.

```css
s.css`
  /* your global stylesheet here */
`
```

## Resets `s.css.reset`

To reduce browser inconsistencies you can use the opinionated css reset style rules.

```js
s.css.reset`
  /* your global reset here */
`
```

<details>
<summary>Default CSS Reset</summary>

Cos applies a minimal default CSS reset:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

input,
button,
textarea,
select {
  font: inherit;
  text-transform: none;
}

* {
  margin: 0;
  padding: 0;
  overflow-wrap: break-word;
  hyphens: auto;
}

body {
  font-family: system-ui, sans-serif;
  min-height: 100svh;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

p {
  line-height: 1.5;
}

img, svg, video, canvas, audio, iframe, embed, object {
  display: block;
  vertical-align: middle;
}

img, video {
  max-width: 100%;
  height: auto;
}

ol, ul, li {
  list-style: none;
}
```

</details>

## Units

Cos supports all standard CSS units (px, em, rem, %, vw, vh, etc.) when explicitly defined, but also provides implicit unit handling. Pixel units are favored — cos automatically appends `px` to numeric values where appropriate, unless the CSS property takes a unitless value.

```js
s`span
  font-size 16
  width 200
  height 600
`
```

> Implicit units will not be applied to properties that accept unitless values, such as `line-height`, `opacity`, `z-index`, etc. Variable definitions require explicit units.

## Variables `$variable`

Cos provides CSS variables with the `$` prefix syntax. Variables can be defined globally using `s.css` or locally within components.

```css
s.css`
  :root {
    $red tomato
    $white #fff
  }
`
```

Reference, overwrite, and create variables on the component level:

```js
const styling = s`
  $pink hotpink
  $size 200
`(
  s`p
    bc $white
    c $pink
    w $size
  `(
    'Paragraph has 200px width, font color hotpink and background white!'
  )
)

// Overriding variables at callsite
styling`
  $pink deeppink
  $size 300
`
```

## Interpolation `${...}`

Interpolate JavaScript values directly into CSS using `${...}` syntax. You can access the current component DOM within the interpolation via function callback.

```js
// Interpolating Values
s`
  w ${ window.innerWidth / 2}
  h ${ window.innerHeight / 2}
`

// Accessing Component DOM
s`
  max-height ${ dom => dom.scrollHeight }
`
```

## Alias `s.css.alias({...})`

The `s.css.alias` method defines aliases for media queries. Aliases are also available on `s.is.*` and reflect breakpoint changes via the MatchMedia API.

```js
// Definition
s.css.alias({
  mobile: '@media (max-width: 767.98px)',
  tablet: '@media (max-width: 1200px)',
  desktop: '@media (min-width: 1500px)',
  ios: '@supports (-webkit-touch-callout: none)'
})

// Usage
s`
  @mobile {
   display none
  }
`('Not visible on mobile devices...')
```

## Shorthands

The most popular CSS properties can be referenced by their initials.

| abbreviation | keyword               |
| ------------ | --------------------  |
| ai           | align-items           |
| b            | bottom                |
| bc           | background-color      |
| bg           | background            |
| bf           | backdrop-filter       |
| br           | border-radius         |
| bs           | box-shadow            |
| bi           | background-image      |
| c            | color                 |
| d            | display               |
| fg           | flex-grow             |
| fb           | flex-basis            |
| f            | float                 |
| fd           | flex-direction        |
| ff           | font-family           |
| fs           | font-size             |
| fw           | font-weight           |
| g            | gap                   |
| ga           | grid-area             |
| gg           | grid-gap              |
| gta          | grid-template-areas   |
| gtc          | grid-template-columns |
| gtr          | grid-template-rows    |
| h            | height                |
| jc           | justify-content       |
| l            | left                  |
| lh           | line-height           |
| ls           | letter-spacing        |
| m            | margin                |
| mb           | margin-bottom         |
| ml           | margin-left           |
| mr           | margin-right          |
| mt           | margin-top            |
| o            | opacity               |
| p            | padding               |
| pb           | padding-bottom        |
| pl           | padding-left          |
| pr           | padding-right         |
| pt           | padding-top           |
| pi           | place-items           |
| pe           | pointer-events        |
| r            | right                 |
| t            | top                   |
| ta           | text-align            |
| td           | text-decoration       |
| tt           | text-transform        |
| ts           | text-shadow           |
| us           | user-select           |
| ws           | white-space           |
| w            | width                 |
| zi           | z-index               |
| z            | zoom                  |
