import { CF_BaseJob, JobFailMeta } from 'cofound/backend'

import { Models } from '../models'

export abstract class BaseJob extends CF_BaseJob<Models> {
  // delay = 0
  // retryLimit = 3
  // backoffStrategy JobBackoffStrategy = this.jobQueue.backoffStrategies.exponential()

  /**
   * Overwrite this to handle when this job fails too many times.
   * @param params The parameters of the job that failed.
   * @param meta Metadata about the failure.
   */
  onFinalFailure(_params: any, _meta: JobFailMeta) {}
}
