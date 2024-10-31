import crypto from 'crypto'

import { BaseDbConn } from '../db/make-db'
import { SchemaDef, col } from '../db/schema'
import { CF_BaseModel } from '../models/base-model'

const DAY = 1000 * 60 * 60 * 24

export namespace CF_SessionsPod {
  export const defaultSessionData = () => ({})
  export const defaultAnonSessionData = () => ({})

  export const config = {
    sidLengthBytes: 128,
    sessionLength: DAY * 30,
  }

  export const schema = {
    sessions: {
      cols: {
        id: col.primary(),
        sid: col.text(),
        user_id: col.integer().references(),
        expires_at: col.timestamp(),
        data: col.json(),
      },
    },
  } satisfies SchemaDef

  export class Session extends CF_BaseModel<typeof schema.sessions, BaseDbConn> {
    protected tablename = 'sessions'
    protected table = schema.sessions

    /** Returns the new session's sid */
    create({ user_id, expires_at }: { user_id: number; expires_at?: number }) {
      expires_at ||= Date.now() + config.sessionLength
      const sid = crypto.randomBytes(config.sidLengthBytes).toString('base64url')
      this.insert({ sid, user_id, data: {}, expires_at })
      return { sid, expires_at }
    }

    /** WARNING: Untyped for flexibility, be careful! */
    patch(sid: string, attrs: any) {
      const session = this.findByOptional({ sid })
      if (!session) return
      this.updateWhere({ sid }, { data: { ...session.data, ...attrs } })
    }

    /** WARNING: Untyped for flexibility, be careful! */
    put(sid: string, attrs: any) {
      this.updateWhere({ sid }, { data: attrs })
    }
  }

  export type Models = { Session: Session }

  export function makeModels(db: BaseDbConn): Models {
    return {
      Session: new Session(db),
    }
  }
}
