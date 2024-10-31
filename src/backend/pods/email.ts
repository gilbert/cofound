import { BaseDbConn } from '../db/make-db'
import { SchemaDef, col } from '../db/schema'
import { CF_BaseModel } from '../models/base-model'

export namespace CF_EmailPod {
  export const defaultSessionData = () => ({})
  export const defaultAnonSessionData = () => ({})

  export const schema = {
    emails: {
      cols: {
        id: col.primary(),
        email: col.text(),
        primary: col.boolean().default(`0`),
        /** NULL here indicates an unverified attempted signup */
        user_id: col.integer().references().nullable(),
        verified_at: col.timestamp().nullable(),
      },
    },
  } satisfies SchemaDef

  export class Email extends CF_BaseModel<typeof schema.emails, BaseDbConn> {
    protected tablename = 'emails'
    protected table = schema.emails

    create(attrs: { email: string; user_id?: number }) {
      // Be internally consistent around primary emails
      const existing = attrs.user_id
        ? this.findByOptional({ user_id: attrs.user_id, primary: true })
        : false
      return this.insert({ ...attrs, primary: !existing })
    }

    setUserId(id: number, user_id: number) {
      const existing = this.findByOptional({ user_id: user_id, primary: true })
      this.updateWhere({ id }, { user_id, primary: !existing })
    }

    markVerified(id: number) {
      this.updateWhere({ id }, { verified_at: Date.now() })
    }
  }

  export type Models = { Email: Email }

  export function makeModels(db: BaseDbConn): Models {
    return {
      Email: new Email(db),
    }
  }
}
