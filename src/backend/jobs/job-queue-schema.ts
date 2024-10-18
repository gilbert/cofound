import { SchemaDef, col } from '../db/schema'

const jobStatus = ['queued', 'running', 'success', 'failed', 'interrupted'] as const

export const jobQueueSchema = {
  queue_jobs: {
    cols: {
      id: col.primary(),
      type: col.text(),
      run_at: col.timestamp(),
      status: col.enum(jobStatus),
      retries: col.integer().default(`0`),
      error: col.text().nullable(),
      last_heartbeat_at: col.timestamp(),
      args: col.text(),
    },
  },
} satisfies SchemaDef
