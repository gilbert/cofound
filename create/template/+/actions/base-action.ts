import { CF_BaseAction } from 'cofound/backend'
import debug from 'debug'

import { APP_NAME } from '../lib/env'
import { Models } from '../models'

export abstract class BaseAction extends CF_BaseAction<Models> {
  protected log = debug(`${APP_NAME}:models:${this.constructor.name}`)
}
