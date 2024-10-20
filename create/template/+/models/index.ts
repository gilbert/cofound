import { makeDoTransaction } from 'cofound/backend'

import { DbConn } from '../lib/db'
import { allPods } from '../pods'
import { User } from './user-model'

export type Models = ReturnType<typeof makeModels>

/**
 * Constructs a set of model classes for the given database connection.
 * Add more models here as you create them.
 */
export function makeModels(db: DbConn) {
  return {
    ...allPods.makeModels(db),
    //
    // Add additional models here.
    //
    User: new User(db),
    // MyModel: new MyModel(db),

    //
    // Helper for synchronous transactions
    //
    doTransaction: makeDoTransaction(db),
  }
}
