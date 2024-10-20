import s from 'sin'

import { App } from './frontend/App'
import { APP_NAME } from './frontend/lib/frontend-env'

s.mount(({}, [], { doc, modified }) => {
  doc.lang('en')

  doc.head([
    <link rel="stylesheet" type="text/css" href={`/global.css${modified ? `?v=${modified}` : ''}`} />,
    /* Add more here as needed */
  ])

  doc.title(APP_NAME)

  return App
})
