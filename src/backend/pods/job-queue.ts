import { BaseDbConn } from '../db/make-db'
import { SchemaDef } from '../db/schema'
import { jobQueueSchema } from '../jobs/job-queue-schema'

export namespace CF_JobQueuePod {
  export const defaultSessionData = () => ({})
  export const defaultAnonSessionData = () => ({})

  export const schema = jobQueueSchema satisfies SchemaDef

  export type Models = {}

  export function makeModels(db: BaseDbConn): Models {
    return {}
  }
}
