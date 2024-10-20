import { CF_BaseModel, TableDef } from 'cofound/backend'
import debug from 'debug'

import { DbConn } from '../lib/db'
import { APP_NAME } from '../lib/env'

export { schema } from '../schema'

export abstract class BaseModel<Cols extends TableDef> extends CF_BaseModel<Cols, DbConn> {
  protected log = debug(`${APP_NAME}:actions:${this.constructor.name}`)
}
