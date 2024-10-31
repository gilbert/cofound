import o from 'ospec'

import { CF_BaseJob, JobQueue, JobRunMeta } from '../../../src/backend'
import { jobQueueSchema } from '../../../src/backend/jobs/job-queue-schema'
import { cf_makeTestRuntime } from '../../../src/backend/test'
import { err, ok } from '../../../src/result'
import { sleep } from '../../../src/shared/function-utils'
import { testEnv } from '../../test-helper'

o.spec('JobQueue', () => {
  function makeRuntime(opts: { concurrency?: number } = {}) {
    return cf_makeTestRuntime({
      env: testEnv,
      fresh: true,
      models: {},
      schema: jobQueueSchema,
      schemaExtra: {},
      jobQueueConcurrency: opts.concurrency,
    })
  }

  const make = (concurrency: number, runtime = makeRuntime({ concurrency })) => {
    return {
      runtime,
      queue: runtime.jobQueue,
    }
  }

  o('runs jobs concurrently', async () => {
    const { queue } = make(2)
    const ran = new Set<number>()
    class TestJob extends CF_BaseJob<{}> {
      async run(params: { id: number; delay?: number }) {
        if (params.delay) {
          await new Promise((resolve) => setTimeout(resolve, params.delay))
        }
        ran.add(params.id)

        return ok({})
      }
    }
    queue.register(TestJob)

    await Promise.all([
      queue.push(TestJob, { id: 10 }).then(() => {
        o(ran.has(10)).equals(true)
        o(ran.has(20)).equals(false)
      }),
      queue.push(TestJob, { id: 20, delay: 40 }).then(() => {
        o(ran.has(20)).equals(true)
        o(ran.size).equals(4)
      }),
      queue.push(TestJob, { id: 30 }).then(() => {
        o(ran.has(10)).equals(true)
        o(ran.has(20)).equals(false)
        o(ran.has(30)).equals(true)
      }),
      queue.push(TestJob, { id: 40 }),
    ])
  })

  o('recovers jobs', async () => {
    let current: JobQueue

    const { queue: before, runtime } = make(1)
    current = before

    const ran = new Set<number>()
    class TestJob extends CF_BaseJob<{}> {
      async run(params: { id: number; delay?: number }) {
        if (params.delay) {
          await new Promise((resolve) => setTimeout(resolve, params.delay))
        }
        if (current.isShuttingDown) {
          throw new Error('Interrupted')
        }
        ran.add(params.id)
        return ok({})
      }
    }
    before.register(TestJob)

    await before.push(TestJob, { id: 10 })
    before.push(TestJob, { id: 20 })
    before.shutdown()
    o(before.length).equals(1)
    o(ran.has(10)).equals(true)
    o(ran.has(20)).equals(false)

    const rows = runtime.db
      .prepare<[], any>('SELECT * FROM queue_jobs ORDER BY created_at ASC')
      .all()
    o(rows.length).equals(2)
    o(rows[0].status).equals('success')
    o(rows[1].status).equals('interrupted')

    const after = new JobQueue({
      db: runtime.db,
      env: testEnv,
      get: runtime.get,
      concurrency: 1,
    })
    after.register(TestJob)
    after.start()
    current = after
    o(after.length).equals(1)

    await after.waitUntilEmpty()
    o(after.length).equals(0)
    o(ran.has(20)).equals(true)
  })

  o('retries up to a limit', async () => {
    const { queue, runtime } = make(2)
    const counts: number[] = []

    let runCount = 0
    class TestJob extends CF_BaseJob<{}> {
      retryLimit = Math.floor(Math.random() * 3) + 1
      async run({}, meta: JobRunMeta) {
        runCount += 1
        counts.push(meta.currentRetry)
        if (1 + 1) throw new Error('TestError jq retry')
        return ok({})
      }
    }
    queue.register(TestJob)

    queue.push(TestJob, {})
    await queue.waitUntilEmpty()
    o(runCount).equals(runtime.get(TestJob).retryLimit + 1)
    o(counts).deepEquals(Array.from({ length: runtime.get(TestJob).retryLimit + 1 }, (_, i) => i))
  })

  o('aborts if instructed', async () => {
    const { queue } = make(2)
    let runCount = 0
    class TestJob extends CF_BaseJob<{}> {
      retryLimit = 999
      async run({}) {
        runCount += 1
        if (4 + 4) return err('x', 'e', { meta: { abort: runCount >= 3 } })
        return ok({})
      }
    }
    queue.register(TestJob)

    queue.push(TestJob, {})
    await queue.waitUntilEmpty()
    o(runCount).equals(3)
  })

  o('awaits empty', async () => {
    const { queue } = make(2)
    const ran = new Set<number>()
    class TestJob extends CF_BaseJob<{}> {
      async run(params: { id: number; delay?: number }) {
        if (params.delay) {
          await new Promise((resolve) => setTimeout(resolve, params.delay))
        }
        ran.add(params.id)
        return ok({})
      }
    }
    queue.register(TestJob)

    queue.push(TestJob, { id: 10 })
    queue.push(TestJob, { id: 20, delay: 20 })
    queue.push(TestJob, { id: 30 })

    await queue.waitUntilEmpty()
    o(queue.length).equals(0)
  })

  o('delayed jobs', async () => {
    const { queue } = make(2)
    const ran = new Set<number>()
    class TestJob extends CF_BaseJob<{}> {
      async run(params: { id: number; delay?: number }) {
        ran.add(params.id)
        return ok({})
      }
    }
    queue.register(TestJob)

    queue.push(TestJob, { id: 10 }, { delay: 20 })
    queue.push(TestJob, { id: 20 })
    queue.push(TestJob, { id: 30 }, { delay: 10 })

    await queue.waitUntilEmpty()
    o(ran.has(10)).equals(false)
    o(ran.has(20)).equals(true)
    o(ran.has(30)).equals(false)

    await sleep(10)

    queue.checkForReadyJobs()
    await queue.waitUntilEmpty()
    o(ran.has(10)).equals(false)
    o(ran.has(30)).equals(true)

    await sleep(10)

    queue.checkForReadyJobs()
    await queue.waitUntilEmpty()
    o(ran.has(10)).equals(true)
  })
})
