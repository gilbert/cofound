import { randomInt } from 'crypto'

import { err, ok } from '../../shared/result'
import { CF_BaseAction } from '../actions/base-action'
import { BaseDbConn } from '../db/make-db'
import { SchemaDef, col } from '../db/schema'
import { DevEmailer, Emailer } from '../email'
import { CF_BaseModel, Sql } from '../models/base-model'

export namespace CF_OtpPod {
  export const defaultSessionData = () => ({})
  export const defaultAnonSessionData = () => ({})

  export const config = {
    env: {
      APP_NAME: 'My App',
    },

    /** How long an OTP is valid for. Default: 5m */
    expiry: 5 * 60 * 1000,

    /** How long generated OTPs should be. Default: 6 */
    otpLength: 6,

    /** How many OTP attempts are allowed before locking the user out. Default: 3 */
    maxAttempts: 3,

    /** How long to wait before a user can resend an OTP. Default: 45s */
    resendWaitTime: 45 * 1000,

    /**
     * Override this to change how OTPs are generated.
     *
     * Default: Numeric characters, e.g. '123456'
     *
     * @param length The length of the OTP to generate, taken from `config.otpLength`
     * */
    generateOtp(length: number): string {
      let otp = ''
      for (let i = 0; i < length; i++) {
        otp += randomInt(10).toString()
      }
      return otp
    },

    getTargetTypeForIntent(intent: OtpIntent): OtpTargetType {
      switch (intent) {
        case 'recover':
        case 'signup':
        case 'login':
          return 'email'
        default:
          const _exhaustiveCheck: never = intent
          throw new Error(`Unhandled intent: ${_exhaustiveCheck}`)
      }
    },

    generateEmailSubject(_intent: OtpIntent) {
      return 'Your One-Time Password (OTP)'
    },

    generateEmailContent(intent: OtpIntent, code: string) {
      const actionText = (
        {
          login: 'login process',
          signup: 'validation process',
          recover: 'account recovery process',
        } satisfies Record<OtpIntent, string>
      )[intent]

      const htmlContent = `
        <p>Dear User,</p>
        <p>Your One-Time Password (OTP) is: <strong>${code}</strong></p>
        <p>Please use this OTP to complete your ${actionText}. It is valid for a single use only, and will expire in 5 minutes.</p>
        <p>Thank you,</p>
        <p>${config.env.APP_NAME}</p>
      `

      const textContent = `
Dear User,

Your One-Time Password (OTP) is: ${code}

Please use this OTP to complete your ${actionText}. It is valid for a single use only, and will expire in 5 minutes

Thank you,
${config.env.APP_NAME}
      `

      return { htmlContent, textContent }
    },

    /** To deploy to production, replace this with your email provider of choice. */
    emailer: new DevEmailer() as Emailer,
  }

  export type OtpIntent = (typeof intents)[number]
  export const intents = ['signup', 'login', 'recover'] as const

  /** To broaden this type (e.g. 'email' | 'text'), you must first eject this pod (TS limitation). */
  export type OtpTargetType = 'email'

  export const schema = {
    otps: {
      cols: {
        id: col.primary(),
        uuid: col.uuid(),
        code: col.text(),
        intent: col.enum(intents),
        target_type: col.text(),
        target_id: col.integer(),
        created_at: col.created_at(),
        expires_at: col.timestamp(),
      },
      indexes: [
        // For faster target lookups
        'CREATE INDEX otps_target ON otps (target_type, target_id)',
      ],
    },
  } satisfies SchemaDef

  export class Otp extends CF_BaseModel<typeof schema.otps, BaseDbConn> {
    protected tablename = 'otps'
    protected table = schema.otps

    generateForEmail(params: {
      intent: OtpIntent
      target_type: OtpTargetType
      target_id: number
      expires_at?: number
    }) {
      let { intent, expires_at, ...rest } = params
      expires_at ||= Date.now() + config.expiry
      const code = config.generateOtp(config.otpLength)
      const id = this.insert({ ...rest, expires_at, intent, code })
      return this.findBy({ id })
    }

    /** Returns newest to oldest */
    findAllActive(target_type: OtpTargetType, target_id: number) {
      return this.findAll(
        { target_type, target_id, expires_at: Sql.gt(Date.now()) },
        `ORDER BY expires_at DESC`,
      )
    }

    markUsed(id: number) {
      this._updateWhere({ id }, { expires_at: 0 })
    }
  }

  export class Actions extends CF_BaseAction<Models> {
    async send({
      email,
      intent,
      target_id,
    }: {
      email: string
      intent: OtpIntent
      target_id: number
    }) {
      const { Otp } = this.models
      const target_type = config.getTargetTypeForIntent(intent)
      const existingCodes = Otp.findAllActive(target_type, target_id)
      if (existingCodes.length >= config.maxAttempts) {
        const oldest = existingCodes[existingCodes.length - 1]!
        const minutesLeft = Math.ceil((oldest.expires_at - Date.now()) / 60000)
        return err('too_many_otps', 'ep45413525', { status: 400, meta: { minutesLeft } })
      }
      const newest = existingCodes[0]
      if (newest && newest.created_at > Date.now() + config.resendWaitTime) {
        const minutesLeft = Math.ceil((newest.created_at - Date.now()) / 60000)
        return err('resend_too_soon', 'ep45413526', { status: 400, meta: { minutesLeft } })
      }
      const otp = Otp.generateForEmail({ intent, target_type, target_id })

      const res = await err.catch(
        'otp_send_failed',
        'e58814439',
        config.emailer.send({
          to: email,
          subject: config.generateEmailSubject(intent),
          ...config.generateEmailContent(intent, otp.code),
        }),
      )
      if (!res.ok) return res

      return ok.sensitive(otp)
    }

    verify({ code, by }: { code: string; by: { otp_id: number } | { uuid: string } }) {
      const { Otp } = this.models
      const otp = Otp.findByOptional('otp_id' in by ? { id: by.otp_id } : by)
      if (!otp || otp.expires_at < Date.now()) {
        return err('expired_code', 'ep457111243')
      }
      if (otp.code !== code) {
        return err('invalid_code', 'ep486934958')
      }
      Otp.markUsed(otp.id)

      return ok.sensitive(otp)
    }
  }

  export type Models = ReturnType<typeof makeModels>

  export function makeModels(db: BaseDbConn) {
    return {
      Otp: new Otp(db),
    }
  }
}
