import { CF_BaseAction } from './actions/base-action'
import { BaseDbConn } from './db/make-db'
import { JobQueue } from './jobs/job-queue'
import { CF_BaseModelView } from './model-views/base-model-view'

type Initable<Models> = typeof CF_BaseAction<Models> | typeof CF_BaseModelView<Models>

export type CF_Runtime<Models> = {
  get: <T extends Initable<any>>(
    ActionClass: T,
  ) => T extends Initable<infer M> ? (Models extends M ? InstanceType<T> : never) : never
  db: BaseDbConn
  models: Models
  jobQueue: JobQueue
}

export type CF_RuntimeEnv = {
  name: string
}

export function makeRuntime<Models>(
  db: BaseDbConn,
  models: Models,
  env: CF_RuntimeEnv,
): CF_Runtime<Models> {
  const get: CF_Runtime<Models>['get'] = (Class) => {
    if (!cache.has(Class)) {
      const isView = Class.prototype instanceof CF_BaseModelView
      cache.set(Class, new (Class as any)(isView ? models : runtime))
    }
    return cache.get(Class)
  }
  const cache = new Map<Initable<Models>, any>()
  const jobDirectory = new URL('../jobs', import.meta.url).pathname
  const jobQueue: JobQueue = new JobQueue({ jobDirectory, db, env, get: get })
  const runtime = { get, db, models, jobQueue }
  return runtime
}
