import { ErrResult, Result, err } from '../../result'
import { BaseDbConn } from './make-db'

/**
 * ONLY USE THIS FOR SYNCHRONOUS TRANSACTIONS
 **/
export function makeDoTransaction(db: BaseDbConn) {
  return function doTransaction<R extends Result>(
    unexpectedErrCode: string,
    fn: () => R,
  ): R | ErrResult<'unexpected'> {
    try {
      return db.transaction(fn)()
    } catch (cause: any) {
      return err('unexpected', unexpectedErrCode, { meta: { cause } })
    }
  }
}
