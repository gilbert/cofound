# Jobs

Cofound includes a small SQLite-backed job queue for server tasks that should survive process restarts.

```js
import { BaseJob, JobQueue, jobQueueSchema } from 'cofound/jobs'
import { migrate } from 'cofound/db'

migrate(db, {
  ...jobQueueSchema,
  media: { cols: { /* app schema */ } },
})

class GenerateThumbnailJob extends BaseJob {
  retryLimit = 2

  async run({ mediaId }) {
    // write thumbnail file, then update app state
  }
}

const jobs = new JobQueue({ db })
jobs.register(GenerateThumbnailJob).start()

await jobs.push(GenerateThumbnailJob, { mediaId: 'abc' })
```

## Exports

`cofound/jobs` exports:

- `jobQueueSchema` - schema mixin for the `queue_jobs` table.
- `JobModel` - direct model access for project code that needs queue inspection or admin actions.
- `BaseJob` - class base for named job classes.
- `JobQueue` - runner, scheduler, retry handler, and recovery helper.

## Schema

Spread `jobQueueSchema` into the app migration schema:

```js
migrate(db, {
  ...jobQueueSchema,
  posts: { cols: { /* ... */ } },
})
```

## Register Jobs

Class jobs get a stable type from the class name:

```js
class SyncFeedJob extends BaseJob {
  async run(params, meta) {
    console.log(params.feedId, meta.currentRetry)
  }
}

jobs.register(SyncFeedJob)
await jobs.push(SyncFeedJob, { feedId: 1 })
```

For small jobs, register a named handler:

```js
jobs.register('thumb.generate', async ({ mediaId }) => {
  await generateThumbnail(mediaId)
}, { retryLimit: 2 })

await jobs.push('thumb.generate', { mediaId: 'abc' })
```

## Retry And Delay

Jobs retry three times by default with exponential backoff. Override this on the class or registration options:

```js
class SendEmailJob extends BaseJob {
  retryLimit = 5
  delay = 10_000
}
```

`push()` can override delay for one job:

```js
await jobs.push(SendEmailJob, data, { delay: 60_000 })
```

Return `{ ok: false }`, return `false`, or throw to retry. Return `{ ok: false, meta: { abort: true } }` to fail without more retries.

## Concurrency

Set global concurrency on the queue:

```js
const jobs = new JobQueue({ db, concurrency: 2 })
```

Or group a job into its own queue:

```js
class GenerateThumbnailJob extends BaseJob {
  getConcurrency() {
    return { queue: 'thumbnails', limit: 1 }
  }
}
```

## Lifecycle

`start()` recovers queued, interrupted, and stale running jobs, then polls for delayed jobs. `shutdown()` marks in-memory running jobs as interrupted so a future process can resume them.

```js
jobs.start()
process.on('SIGTERM', () => jobs.shutdown())
```

## Known Limits

- No cross-process atomic claim. Run one worker process per queue database unless duplicate-safe jobs are acceptable.
- No directory auto-loading. Register the jobs you need from project code.
- No built-in dashboard, priority, cron syntax, or per-job cancellation.
- `shutdown()` only marks jobs tracked by the current process. A crashed process is recovered by stale heartbeat detection on the next `start()`.
