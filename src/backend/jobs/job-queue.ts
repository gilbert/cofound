import debug from 'debug'
import fs from 'fs'
import pLimit from 'p-limit'
import path from 'path'
import prexit from 'prexit'

import { ErrResult, OkResult, Result, err } from '../../result'
import { sleep } from '../../shared/function-utils'
import { CF_BaseAction } from '../actions/base-action'
import { BaseDbConn } from '../db/make-db'
import { Selectable, Updateable } from '../db/schema'
import { CF_BaseModel, Sql } from '../models/base-model'
import { CF_Runtime } from '../runtime'
import { jobQueueSchema } from './job-queue-schema'

type JobRecord = Selectable<typeof jobQueueSchema.queue_jobs.cols>

type JobQueueEnv = { name: string }

export type JobOptions = {
  delay?: number
  retryLimit?: number
}

export type JobBackoffStrategy = (retries: number) => number

class JobModel extends CF_BaseModel<typeof jobQueueSchema.queue_jobs, BaseDbConn> {
  protected tablename = 'queue_jobs'
  protected table = jobQueueSchema.queue_jobs

  CHUNK_SIZE = 1000

  create = this.insert

  update(id: number, attrs: Updateable<JobRecord>) {
    return this.updateWhere({ id }, attrs)
  }

  fail(id: number, error: string) {
    return this.update(id, { status: 'failed', error })
  }

  updateStatus(id: number, status: JobRecord['status']) {
    return this.update(id, { status })
  }

  heartbeat(id: number) {
    this.db
      .prepare(`UPDATE queue_jobs SET last_heartbeat_at = unixepoch('subsec') WHERE id = ?`)
      .run(id)
  }

  findRecoverable(skip = 0) {
    return this.findAll(
      {},
      `
        WHERE status IN ('queued', 'interrupted')
           OR (status = 'processing' AND last_heartbeat_at < (unixepoch('subsec') - 5))
          AND run_at <= unixepoch('subsec')
        ORDER BY created_at ASC
        LIMIT ${this.CHUNK_SIZE}
        OFFSET ${skip}
      `,
    )
  }

  findReadyJobs() {
    return this.findAll(
      {
        status: 'queued',
        run_at: Sql.lte(Date.now()),
      },
      `ORDER BY created_at ASC LIMIT ${this.CHUNK_SIZE}`,
    )
  }

  markInterrupted(id: number) {
    this.db.prepare<[number]>(`UPDATE queue_jobs SET status = 'interrupted' WHERE id = ?`).run(id)
  }
}

export type JobRunMeta = {
  currentRetry: number
}
export type JobFailMeta = {
  job_id: number
  aborted: boolean
  errorResult: ErrResult
  currentRetry: number
}
export abstract class CF_BaseJob<Models> extends CF_BaseAction<Models> {
  delay = 0
  retryLimit = 3
  backoffStrategy: JobBackoffStrategy = this.jobQueue.backoffStrategies.exponential()

  abstract run(params: any, meta: JobRunMeta): Promise<OkResult | ErrResult>
  // @ts-ignore
  onFinalFailure(params: any, meta: JobFailMeta) {}
}

/** Cache for test suite performance */
const jobClassesCache = new Map<string, Record<string, typeof CF_BaseJob>>()

function isJobClass(x: any): x is typeof CF_BaseJob {
  return x.prototype instanceof CF_BaseJob
}

export class JobQueue {
  readonly jobDirectory?: string

  private env: JobQueueEnv
  private model: JobModel
  private jobClasses: Record<string, typeof CF_BaseJob>
  private runAsync: ReturnType<typeof pLimit>
  private runningJobs = new Set<JobRecord['id']>()
  private shuttingDown: boolean = false
  private emptyQueueResolvers: (() => void)[] = []
  private get: CF_Runtime<any>['get']

  private _log = debug('cf:job-queue')

  backoffStrategies: ReturnType<typeof JobQueue.makeBackoffStrategies>

  started = false

  defaultJobOptions: Required<JobOptions> = {
    delay: 0,
    retryLimit: 3,
  }

  static makeBackoffStrategies(env: JobQueueEnv) {
    return {
      exponential(baseDelay = 1000) {
        return (retries: number) => {
          if (env.name === 'test') return 0
          const maxDelay = 1000 * 60 * 60 // 1 hour
          const delay = Math.min(baseDelay * Math.pow(2, retries), maxDelay)
          return delay + Math.random() * delay * 0.1 // Add jitter
        }
      },
      linear(baseDelay = 3000) {
        return (retries: number) => {
          if (env.name === 'test') return 0
          const maxDelay = 1000 * 60 * 60 // 1 hour
          const delay = Math.min(baseDelay * retries, maxDelay)
          return delay + Math.random() * delay * 0.1 // Add jitter
        }
      },
    }
  }

  constructor(params: {
    jobDirectory?: string
    db: BaseDbConn
    env: JobQueueEnv
    concurrency?: number
    get: CF_Runtime<any>['get']
  }) {
    this.env = params.env
    this.model = new JobModel(params.db)
    this.runAsync = pLimit(params.concurrency || 8)
    this.jobClasses = {}
    this.jobDirectory = params.jobDirectory
    this.get = params.get
    this.backoffStrategies = JobQueue.makeBackoffStrategies(this.env)
  }

  /** Useful for registering a job class not defined as a file in jobDirectory */
  register(jobClass: typeof CF_BaseJob<any>) {
    if (!isJobClass(jobClass)) {
      throw new Error(`Invalid job class: ${jobClass}`)
    }
    this.jobClasses[jobClass.name] = jobClass
  }

  async start() {
    if (this.started) return

    this.started = true

    if (this.jobDirectory) {
      // Populate job classes from project directory
      if (jobClassesCache.has(this.jobDirectory)) {
        this.jobClasses = {
          ...this.jobClasses,
          ...jobClassesCache.get(this.jobDirectory)!,
        }
      } else {
        const jobClasses = {} as typeof this.jobClasses
        const files = await fs.promises.readdir(this.jobDirectory)
        const jobFiles = files.filter((file) => file.endsWith('Job.ts'))
        for (const file of jobFiles) {
          const jobModule = await import(path.join(this.jobDirectory, file))
          for (const key of Object.keys(jobModule)) {
            if (isJobClass(jobModule[key])) {
              jobClasses[key] = jobModule[key]
            }
          }
        }
        jobClassesCache.set(this.jobDirectory, jobClasses)
        this.jobClasses = { ...this.jobClasses, ...jobClasses }
      }
    }
    this.recoverJobs()
    this.setupShutdownHandlers()
    setInterval(() => this.checkForReadyJobs(), 1000 * 17)
  }

  get length() {
    return this.runningJobs.size
  }

  get isShuttingDown() {
    return this.shuttingDown
  }

  push<J extends typeof CF_BaseJob<any>>(
    jobClass: J,
    args: Parameters<InstanceType<J>['run']>[0],
    optionsOverride: JobOptions = {},
  ) {
    if (this.shuttingDown) {
      this.log(`Cannot push job ${jobClass} because queue is shutting down`)
      return Promise.resolve()
    }
    if (!this.jobClasses) {
      throw new Error('Job classes not loaded')
    }

    const options = {
      ...this.getJobOptions(this.get(jobClass)),
      ...optionsOverride,
    }

    const argsJson = JSON.stringify(args)
    const jobType = `${jobClass.name}.run`

    const id = this.model.create({
      type: jobType,
      args: argsJson,
      run_at: Date.now() + (options.delay || 0),
      status: 'queued',
      last_heartbeat_at: Date.now(),
    })

    this.log(`Pushed job ${id}: ${jobType}`)

    if (!options.delay) {
      const newJob = this.model.findBy({ id })
      return this.enqueue(newJob)
    }
    return Promise.resolve()
  }

  /** Only use in tests */
  async waitUntilEmpty(waitMs = 0): Promise<void> {
    if (waitMs) {
      await sleep(waitMs)
    }
    if (this.length === 0) {
      this.checkForReadyJobs()
    }
    if (this.length === 0) {
      return
    }
    return new Promise((resolve) => {
      this.emptyQueueResolvers.push(resolve)
    })
  }

  /**
   * Checks for originally-delayed jobs that are now ready to run.
   * Not really meant to be used publically except in tests.
   *
   * Only runs if the queue is empty, otherwise does a noop.
   **/
  checkForReadyJobs() {
    if (this.shuttingDown || this.runningJobs.size > 0) return

    const jobs = this.model.findReadyJobs()
    for (const job of jobs) {
      this.enqueue(job)
    }
  }

  shutdown() {
    if (this.shuttingDown) return
    this.shuttingDown = true
    this.markRunningJobsAsInterrupted()
  }

  private enqueue(job: JobRecord) {
    if (this.runningJobs.has(job.id) || this.shuttingDown) return Promise.resolve()
    this.runningJobs.add(job.id)
    return this.runAsync(
      () =>
        new Promise<void>((resolve) =>
          // Reduce event loop priority to other tasks (e.g. the web server)
          // https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick#setimmediate-vs-settimeout
          setTimeout(() => {
            this.processJob(job).finally(resolve)
          }, 0),
        ),
    )
  }

  private recoverJobs(skip = 0) {
    if (this.shuttingDown) return

    const jobs = this.model.findRecoverable(skip)

    this.log('Recovering', jobs.length, 'jobs')

    for (let job of jobs) {
      this.enqueue(job)
    }
    if (jobs.length === this.model.CHUNK_SIZE) {
      setImmediate(() => this.recoverJobs(skip + this.model.CHUNK_SIZE))
    } else if (skip > 0) {
      // Just in case
      setImmediate(() => this.recoverJobs(0))
    }
  }

  private async processJob(job: JobRecord) {
    if (this.shuttingDown) return

    // [ASSUMPTION]: Path to this method can only be reached if start has been called
    const jobClasses = this.jobClasses!

    const [jobClassName, method] = job.type.split('.')
    const JobClass = jobClassName && jobClasses[jobClassName]
    if (!jobClassName || !JobClass || method !== 'run' || !(method in JobClass.prototype)) {
      this.log(`Invalid job type: ${job.type}`)
      this.model.fail(job.id, `Invalid job type: ${job.type}`)
      return
    }

    this.model.updateStatus(job.id, 'running')

    const heartbeatInterval = setInterval(() => {
      if (this.shuttingDown) return
      this.model.heartbeat(job.id)
    }, 4900)

    // [ASSUMPTION]: Path to this method can only be reached if start has been called
    const instance = this.get(JobClass)
    var result: Result
    try {
      this.log(`Running job ${job.id}: ${job.type}`, job.args)
      result = await (instance as any)[method](JSON.parse(job.args), {
        currentRetry: job.retries || 0,
      })
      this.model.updateStatus(job.id, 'success')
      this.runningJobs.delete(job.id)
    } catch (details: any) {
      result = err('unexpected', 'e500', { meta: { details: details.stack || details.toString() } })
    }

    if (result?.ok === false) {
      this.log(`Job ${job.id} failed:`, JobClass.name, job.args, result)
      const options = this.getJobOptions(instance)
      const retries = (job.retries || 0) + 1
      const errorDetails = JSON.stringify(result)
      if (retries > options.retryLimit || result.meta?.abort) {
        this.model.fail(job.id, errorDetails)
        instance.onFinalFailure(JSON.parse(job.args), {
          job_id: job.id,
          aborted: !(retries > options.retryLimit),
          errorResult: result,
          currentRetry: retries,
        })
      } else {
        const delay = instance.backoffStrategy(retries)
        this.model.update(job.id, {
          status: 'queued',
          retries,
          error: errorDetails,
          run_at: Date.now() + delay,
        })
      }
    }

    clearInterval(heartbeatInterval)
    this.runningJobs.delete(job.id)
    this.checkIfEmpty()
  }

  private setupShutdownHandlers() {
    prexit.last((signal) => {
      // This will run after any async handlers right before exit, meaning only sync cleanup
      if (this.shuttingDown) return
      this.log(`Shutdown signal received (${signal}). Attempting to gracefully shut down...`)
      this.shutdown()
    })
  }

  private markRunningJobsAsInterrupted() {
    this.log(`Marking ${this.runningJobs.size} running jobs as interrupted`)
    for (const jobId of this.runningJobs) {
      this.model.markInterrupted(jobId)
    }
  }

  private getJobOptions(jobClass: CF_BaseJob<any>): Required<JobOptions> {
    let options: any = {}
    for (let key of ['delay', 'retryLimit'] as const) {
      if (jobClass[key] !== undefined) {
        options[key] = jobClass[key]
      }
    }
    return { ...this.defaultJobOptions, ...options }
  }

  private checkIfEmpty() {
    if (this.length === 0) {
      this.checkForReadyJobs()
    }
    if (this.length === 0) {
      while (this.emptyQueueResolvers.length > 0) {
        this.emptyQueueResolvers.pop()!()
      }
    }
  }

  private log(x: any, ...xs: any[]) {
    if (this.env.name === 'test') return
    this._log(x, ...xs)
  }
}
