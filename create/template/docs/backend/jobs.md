# Jobs

Your app has access to a jobQueue for async, delayed, and/or must-complete tasks.

## Example Job

```ts
// Note this file MUST be named ./+/jobs/SubmitDeploymentJob.ts
import { BaseJob, JobRunMeta } from './base-job'

type Params = {
  deployment_id: number
}
export class SubmitDeploymentJob extends BaseJob {
  // Optional
  retryLimit = 5

  // Optional
  backoffStrategy = this.jobQueue.BackoffStrategies.linear()

  async run({ deployment_id }: Params) {
    if (some_bad_condition) {
      // Returning an error will cause this job to retry later
      return err('bad', 'e123')
    }

    if (some_other_condition) {
      // Returning `abort: true` in meta will cause this job to no longer be retried.
      return err('bad_2', 'e456', { meta: { abort: true } })
    }

    // Returning ok completes the job
    return ok({})
  }

  // Optional
  onFinalFailure({ deployment_id }: Params, meta: JobFailMeta): void {
    // meta : {
    //   job_id: number;
    //   aborted: boolean;
    //   errorResult: ErrResult;
    //   currentRetry: number;
    // }
  }
}
```

To use this job, access `this.jobQueue` within an action or rpc:

```ts
// Within an Action or RPC:
this.jobQueue.push(SubmitDeploymentJob, { deployment_id: myId })

// You can also override options:
this.jobQueue.push(SubmitDeploymentJob, { deployment_id: myId }, {
  retryLimit: 10,
  backoffStrategy: this.jobQueue.BackoffStrategies.exponential(),
})
```
