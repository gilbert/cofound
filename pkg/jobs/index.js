import Debug from 'debug'
import { col } from '../db/schema.js'
import { Model, Sql } from '../db/index.js'

const log = Debug('cofound:jobs')

const JOB_STATUS = ['queued', 'running', 'success', 'failed', 'interrupted']
const DEFAULT_CONCURRENCY = Number.MAX_SAFE_INTEGER

export const jobQueueSchema = {
  queue_jobs: {
    cols: {
      id: col.primary(),
      queue: col.text().nullable(),
      type: col.text(),
      run_at: col.timestamp(),
      status: col.enum(JOB_STATUS),
      retries: col.integer().default('0'),
      error: col.text().nullable(),
      last_heartbeat_at: col.timestamp(),
      args: col.text(),
    },
  },
}

export class JobModel extends Model {
  constructor(db) {
    super(db, 'queue_jobs', jobQueueSchema.queue_jobs)
    this.CHUNK_SIZE = 1000
  }

  create(attrs) {
    return this.insert(attrs)
  }

  update(id, attrs) {
    return this.updateWhere({ id }, attrs)
  }

  fail(id, error) {
    return this.update(id, { status: 'failed', error })
  }

  updateStatus(id, status) {
    return this.update(id, { status })
  }

  heartbeat(id) {
    return this.update(id, { last_heartbeat_at: Date.now() })
  }

  findReadyJobs() {
    return this.findAll(
      { status: 'queued', run_at: Sql.lte(Date.now()) },
      `ORDER BY created_at ASC LIMIT ${this.CHUNK_SIZE}`,
    )
  }

  findRecoverable({ skip = 0, staleMs = 5000 } = {}) {
    return this.db.prepare(`
      SELECT * FROM queue_jobs
      WHERE (
        status IN ('queued', 'interrupted')
        OR (status = 'running' AND last_heartbeat_at < @staleBefore)
      )
      AND run_at <= @now
      ORDER BY created_at ASC
      LIMIT @limit
      OFFSET @skip
    `).all({
      staleBefore: (Date.now() - staleMs) / 1000,
      now: Date.now() / 1000,
      limit: this.CHUNK_SIZE,
      skip,
    }).map(row => this.deserialize(row))
  }

  markInterrupted(id) {
    return this.update(id, { status: 'interrupted' })
  }
}

export class BaseJob {
  delay = 0
  retryLimit = 3

  constructor(queue) {
    this.queue = queue
  }

  getConcurrency() {
    return { queue: 'default', limit: this.queue?.concurrency || DEFAULT_CONCURRENCY }
  }

  backoffStrategy(retries) {
    return this.queue.backoffStrategies.exponential()(retries)
  }

  async run() {
    throw new Error(`${this.constructor.name}.run() is not implemented`)
  }

  onFinalFailure() {}
}

export class JobQueue {
  constructor({
    db,
    model = db && new JobModel(db),
    concurrency = DEFAULT_CONCURRENCY,
    heartbeatMs = 4900,
    pollMs = 17000,
    staleMs = 5000,
    env = process.env.NODE_ENV || 'development',
    get,
  } = {}) {
    if (!model) throw new Error('JobQueue requires db or model')

    this.model = model
    this.concurrency = concurrency
    this.heartbeatMs = heartbeatMs
    this.pollMs = pollMs
    this.staleMs = staleMs
    this.env = env
    this.get = get
    this.handlers = new Map()
    this.limiters = new Map()
    this.runningJobs = new Set()
    this.emptyQueueResolvers = []
    this.started = false
    this.shuttingDown = false
    this.pollTimer = null
    this.defaultJobOptions = { delay: 0, retryLimit: 3 }
    this.backoffStrategies = makeBackoffStrategies(env)
  }

  get length() {
    return this.runningJobs.size
  }

  get isShuttingDown() {
    return this.shuttingDown
  }

  register(type, handler, options = {}) {
    if (isJobClass(type)) {
      this.handlers.set(jobType(type), { type: jobType(type), JobClass: type, options: handler || {} })
      return this
    }
    if (typeof type !== 'string' || !handler) {
      throw new Error('JobQueue.register() requires a job class or type plus handler')
    }
    this.handlers.set(type, { type, handler, options })
    return this
  }

  start() {
    if (this.started) return this
    this.started = true
    this.recoverJobs()
    this.pollTimer = setInterval(() => this.checkForReadyJobs(), this.pollMs)
    this.pollTimer.unref?.()
    return this
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    this.started = false
  }

  shutdown() {
    if (this.shuttingDown) return
    this.shuttingDown = true
    this.stop()
    for (const id of this.runningJobs) this.model.markInterrupted(id)
  }

  push(type, args = {}, optionsOverride = {}) {
    if (this.shuttingDown) {
      this.log(`Cannot push ${type} because queue is shutting down`)
      return Promise.resolve(null)
    }

    const registered = this.resolveRegistered(type)
    const options = { ...this.defaultJobOptions, ...this.getJobOptions(registered), ...optionsOverride }
    const id = this.model.create({
      type: registered.type,
      args: JSON.stringify(args),
      run_at: Date.now() + (options.delay || 0),
      status: 'queued',
      last_heartbeat_at: Date.now(),
    })

    this.log(`Pushed job ${id}: ${registered.type}`)
    if (options.delay) return Promise.resolve(id)
    return this.enqueue(this.model.findBy({ id })).then(() => id)
  }

  async waitUntilEmpty(waitMs = 0) {
    if (waitMs) await sleep(waitMs)
    if (this.length === 0) this.checkForReadyJobs()
    if (this.length === 0) return
    return new Promise(resolve => this.emptyQueueResolvers.push(resolve))
  }

  checkForReadyJobs() {
    if (this.shuttingDown) return
    for (const job of this.model.findReadyJobs()) this.enqueue(job)
  }

  recoverJobs(skip = 0) {
    if (this.shuttingDown) return
    const jobs = this.model.findRecoverable({ skip, staleMs: this.staleMs })
    this.log(`Recovering ${jobs.length} jobs`)
    for (const job of jobs) this.enqueue(job)
    if (jobs.length === this.model.CHUNK_SIZE) {
      setImmediate(() => this.recoverJobs(skip + this.model.CHUNK_SIZE))
    } else if (skip > 0) {
      setImmediate(() => this.recoverJobs(0))
    }
  }

  enqueue(job) {
    if (this.runningJobs.has(job.id) || this.shuttingDown) return Promise.resolve()

    const registered = this.handlers.get(job.type)
    if (!registered) {
      this.model.fail(job.id, `Invalid job type: ${job.type}`)
      this.checkIfEmpty()
      return Promise.resolve()
    }

    const instance = this.makeInstance(registered)
    const args = parseArgs(job)
    const meta = { job_id: job.id, currentRetry: job.retries || 0 }
    const { queue = 'default', limit = this.concurrency } = getConcurrency(instance, args, meta, this.concurrency)
    const limiter = this.getLimiter(queue, limit)

    this.runningJobs.add(job.id)
    if (job.queue !== queue) this.model.update(job.id, { queue })

    return limiter.run(async () => {
      if (this.shuttingDown) {
        this.runningJobs.delete(job.id)
        this.checkIfEmpty()
        return
      }
      await this.processJob(job, registered, instance)
    })
  }

  async processJob(job, registered, instance) {
    try {
      this.model.updateStatus(job.id, 'running')
      const heartbeat = setInterval(() => {
        if (!this.shuttingDown) this.model.heartbeat(job.id)
      }, this.heartbeatMs)
      heartbeat.unref?.()

      let result = { ok: true }
      try {
        result = await runJob(instance, parseArgs(job), {
          job_id: job.id,
          currentRetry: job.retries || 0,
        })
        if (result === undefined) result = { ok: true }
        if (result !== false && result?.ok !== false) this.model.updateStatus(job.id, 'success')
      } catch (error) {
        result = { ok: false, error: serializeError(error) }
      } finally {
        clearInterval(heartbeat)
      }

      if (result === false || result?.ok === false) await this.handleFailure(job, registered, instance, normalizeFailure(result))
    } finally {
      this.runningJobs.delete(job.id)
      this.checkIfEmpty()
    }
  }

  async handleFailure(job, registered, instance, errorResult) {
    const args = parseArgs(job)
    const options = { ...this.defaultJobOptions, ...this.getJobOptions(registered, instance) }
    const retries = (job.retries || 0) + 1
    const error = JSON.stringify(errorResult)
    const abort = !!(errorResult.abort || errorResult.meta?.abort)

    if (abort || retries > options.retryLimit) {
      this.model.fail(job.id, error)
      try {
        await instance.onFinalFailure?.(args, {
          job_id: job.id,
          aborted: abort,
          errorResult,
          currentRetry: retries,
        })
      } catch (error) {
        this.log(`Job ${job.id} onFinalFailure failed`, error)
      }
      return
    }

    const delay = getBackoff(instance, retries, this.backoffStrategies)
    this.model.update(job.id, {
      status: 'queued',
      retries,
      error,
      run_at: Date.now() + delay,
    })
  }

  resolveRegistered(type) {
    const key = isJobClass(type) ? jobType(type) : type
    const registered = this.handlers.get(key)
    if (!registered) throw new Error(`Job type is not registered: ${key}`)
    return registered
  }

  makeInstance(registered) {
    if (!registered.JobClass) return registered.handler
    if (this.get) return this.get(registered.JobClass)
    return new registered.JobClass(this)
  }

  getJobOptions(registered, instance) {
    const source = instance || (registered.JobClass ? this.makeInstance(registered) : registered.handler)
    return {
      ...pick(source, ['delay', 'retryLimit']),
      ...registered.options,
    }
  }

  getLimiter(queue, limit) {
    const current = this.limiters.get(queue)
    if (current?.limit === limit) return current
    const next = makeLimiter(limit)
    next.limit = limit
    this.limiters.set(queue, next)
    return next
  }

  checkIfEmpty() {
    if (this.length === 0) this.checkForReadyJobs()
    if (this.length === 0) {
      while (this.emptyQueueResolvers.length) this.emptyQueueResolvers.pop()()
    }
  }

  log(...args) {
    if (this.env === 'test' || this.env?.name === 'test') return
    log(...args)
  }
}

function makeBackoffStrategies(env) {
  const test = env === 'test' || env?.name === 'test'
  return {
    exponential(baseDelay = 1000) {
      return retries => test ? 0 : jitter(Math.min(baseDelay * Math.pow(2, retries), 1000 * 60 * 60))
    },
    linear(baseDelay = 3000) {
      return retries => test ? 0 : jitter(Math.min(baseDelay * retries, 1000 * 60 * 60))
    },
  }
}

function makeLimiter(limit) {
  let active = 0
  const pending = []
  return {
    limit,
    run(task) {
      return new Promise((resolve, reject) => {
        pending.push({ task, resolve, reject })
        next()
      })
    },
  }

  function next() {
    if (active >= limit || pending.length === 0) return
    const job = pending.shift()
    active++
    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        active--
        next()
      })
  }
}

function isJobClass(value) {
  return typeof value === 'function' && value.prototype instanceof BaseJob
}

function jobType(JobClass) {
  return `${JobClass.name}.run`
}

function getConcurrency(instance, args, meta, fallback) {
  return instance.getConcurrency?.(args, meta) || { queue: 'default', limit: fallback }
}

function getBackoff(instance, retries, strategies) {
  if (typeof instance.backoffStrategy === 'function') return instance.backoffStrategy(retries)
  return strategies.exponential()(retries)
}

function runJob(instance, args, meta) {
  return typeof instance === 'function' ? instance(args, meta) : instance.run(args, meta)
}

function parseArgs(job) {
  return JSON.parse(job.args || '{}')
}

function normalizeFailure(result) {
  if (result === false) return { ok: false, error: 'Job returned false' }
  return result
}

function serializeError(error) {
  return {
    message: error?.message || String(error),
    stack: error?.stack,
  }
}

function jitter(delay) {
  return delay + Math.random() * delay * 0.1
}

function pick(source, keys) {
  const out = {}
  for (const key of keys) {
    if (source?.[key] !== undefined) out[key] = source[key]
  }
  return out
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
