import t from 'cofound/test'
import { col, makeDb, migrate } from 'cofound/db'
import { BaseJob, JobModel, JobQueue, jobQueueSchema } from 'cofound/jobs'

function eq(a, b) {
  const as = JSON.stringify(a), bs = JSON.stringify(b)
  if (as !== bs) throw new Error('expected `' + as + '` but got `' + bs + '`')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fresh() {
  const db = makeDb(':memory:')
  migrate(db, {
    ...jobQueueSchema,
    files: {
      cols: {
        id: col.id(),
        path: col.text(),
      },
    },
  }, { silent: true })
  return db
}

t`jobs`(
  t`schema mixin migrates queue_jobs alongside app tables`(() => {
    const db = fresh()
    const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name != 'sqlite_sequence'").all()
    eq(['files', 'queue_jobs'], tables.map(row => row.name).sort())
  }),

  t`runs class jobs with queue concurrency`(async () => {
    const db = fresh()
    const ran = new Set()

    class TestJob extends BaseJob {
      async run(params) {
        if (params.delay) await sleep(params.delay)
        ran.add(params.id)
      }
    }

    const queue = new JobQueue({ db, env: 'test', concurrency: 2 }).register(TestJob)
    await Promise.all([
      queue.push(TestJob, { id: 10 }),
      queue.push(TestJob, { id: 20, delay: 10 }),
      queue.push(TestJob, { id: 30 }),
    ])

    eq([10, 20, 30], [...ran].sort((a, b) => a - b))
  }),

  t`runs named handlers`(async () => {
    const db = fresh()
    let value = 0
    const queue = new JobQueue({ db, env: 'test' })
      .register('thumb.generate', async params => {
        value = params.mediaId
      })

    await queue.push('thumb.generate', { mediaId: 42 })
    t.is(42, value)
  }),

  t`recovers interrupted jobs`(async () => {
    const db = fresh()
    const model = new JobModel(db)
    const ran = new Set()

    class TestJob extends BaseJob {
      async run(params) {
        ran.add(params.id)
      }
    }

    model.create({
      type: 'TestJob.run',
      args: JSON.stringify({ id: 20 }),
      run_at: Date.now(),
      status: 'interrupted',
      last_heartbeat_at: Date.now(),
    })

    const queue = new JobQueue({ db, env: 'test' }).register(TestJob).start()
    await queue.waitUntilEmpty()
    queue.stop()

    t.is(true, ran.has(20))
    t.is('success', model.findBy({ type: 'TestJob.run' }).status)
  }),

  t`recovers stale running jobs`(async () => {
    const db = fresh()
    const model = new JobModel(db)
    let runs = 0

    class TestJob extends BaseJob {
      async run() {
        runs++
      }
    }

    model.create({
      type: 'TestJob.run',
      args: '{}',
      run_at: Date.now(),
      status: 'running',
      last_heartbeat_at: Date.now() - 10_000,
    })

    const queue = new JobQueue({ db, env: 'test', staleMs: 100 }).register(TestJob).start()
    await queue.waitUntilEmpty()
    queue.stop()

    t.is(1, runs)
    t.is('success', model.findBy({ type: 'TestJob.run' }).status)
  }),

  t`recovery does not run future queued jobs`(async () => {
    const db = fresh()
    const model = new JobModel(db)
    let runs = 0

    class TestJob extends BaseJob {
      async run() {
        runs++
      }
    }

    model.create({
      type: 'TestJob.run',
      args: '{}',
      run_at: Date.now() + 10_000,
      status: 'queued',
      last_heartbeat_at: Date.now(),
    })

    const queue = new JobQueue({ db, env: 'test' }).register(TestJob).start()
    await queue.waitUntilEmpty()
    queue.stop()

    t.is(0, runs)
    t.is('queued', model.findBy({ type: 'TestJob.run' }).status)
  }),

  t`retries up to the retry limit`(async () => {
    const db = fresh()
    const queue = new JobQueue({ db, env: 'test' })
    let runs = 0

    class TestJob extends BaseJob {
      retryLimit = 2
      async run(params, meta) {
        t.is(runs, meta.currentRetry)
        runs++
        throw new Error('nope')
      }
    }

    queue.register(TestJob)
    await queue.push(TestJob, {})

    t.is(3, runs)
    t.is('failed', new JobModel(db).findBy({ type: 'TestJob.run' }).status)
  }),

  t`aborts retries when instructed`(async () => {
    const db = fresh()
    const queue = new JobQueue({ db, env: 'test' })
    let runs = 0

    class TestJob extends BaseJob {
      retryLimit = 99
      async run() {
        runs++
        return { ok: false, meta: { abort: runs >= 3 } }
      }
    }

    queue.register(TestJob)
    await queue.push(TestJob, {})

    t.is(3, runs)
    t.is('failed', new JobModel(db).findBy({ type: 'TestJob.run' }).status)
  }),

  t`delayed jobs wait until checked after run_at`(async () => {
    const db = fresh()
    const ran = new Set()

    class TestJob extends BaseJob {
      async run(params) {
        ran.add(params.id)
      }
    }

    const queue = new JobQueue({ db, env: 'test' }).register(TestJob)
    await queue.push(TestJob, { id: 10 }, { delay: 20 })
    await queue.push(TestJob, { id: 20 })
    await queue.waitUntilEmpty()

    t.is(false, ran.has(10))
    t.is(true, ran.has(20))

    await sleep(20)
    queue.checkForReadyJobs()
    await queue.waitUntilEmpty()

    t.is(true, ran.has(10))
  }),

  t`invalid recovered job types fail without sticking in runningJobs`(async () => {
    const db = fresh()
    const model = new JobModel(db)
    model.create({
      type: 'MissingJob.run',
      args: '{}',
      run_at: Date.now(),
      status: 'queued',
      last_heartbeat_at: Date.now(),
    })

    const queue = new JobQueue({ db, env: 'test' }).start()
    await queue.waitUntilEmpty()
    queue.stop()

    t.is(0, queue.length)
    t.is('failed', model.findBy({ type: 'MissingJob.run' }).status)
  }),

  t`final failure hooks cannot stick running jobs`(async () => {
    const db = fresh()
    const queue = new JobQueue({ db, env: 'test' })

    class TestJob extends BaseJob {
      retryLimit = 0
      async run() {
        throw new Error('nope')
      }
      async onFinalFailure() {
        throw new Error('hook failed')
      }
    }

    queue.register(TestJob)
    await queue.push(TestJob, {})

    t.is(0, queue.length)
    t.is('failed', new JobModel(db).findBy({ type: 'TestJob.run' }).status)
  }),
)
