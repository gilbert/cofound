import { Insertable, SchemaCols, Selectable, Updateable, col } from 'cofound/backend'

import { allPods } from './pods'

//
// WARNING:
// - Tables MUST be defined in order of dependency
// - Tables are NOT deleted by auto-migration
// - A deleted column's data IS LOST by auto-migration if you don't specify a sourceDataFrom()!
//
export const schema = {
  users: {
    cols: {
      id: col.primary(),
      uid: short_uid(),
      name: col.text(),
    },
  },
  ...allPods.schemas,
}

//
// Schema Helpers
//
function short_uid() {
  return col.text().index('unique')
}

//
// Type Helpers
//
export type Schema = SchemaCols<typeof schema>

export type Selects = {
  [K in keyof Schema]: Selectable<Schema[K]>
}
export type Inserts = {
  [K in keyof Schema]: Insertable<Schema[K]>
}
export type Updates = {
  [K in keyof Schema]: Updateable<Omit<Schema[K], 'id'>>
}
