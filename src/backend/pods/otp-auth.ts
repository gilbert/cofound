import { z } from 'zod'

import { err, ok } from '../../shared/result'
import { CF_BaseAction } from '../actions/base-action'
import { BaseDbConn } from '../db/make-db'
import { SchemaDef, SchemaExtra, col } from '../db/schema'
import { HttpSession } from '../http/http-session'
import { BaseRpcCtx, makeRpcDefiner } from '../rpcs'
import { CF_Runtime } from '../runtime'
import { CF_EmailPod } from './email'
import { CF_OtpPod } from './otp'

export namespace CF_OtpAuthPod {
  type SessionData = {}
  type AnonSessionData = { otp_id?: number }
  export const defaultSessionData = () => ({}) as SessionData
  export const defaultAnonSessionData = () => ({}) as AnonSessionData

  export const config = {
    OtpPod: CF_OtpPod,

    /** Instructs the pod how to create a user upon registeration success. */
    createUser({}: { email: string }): Promise<number> {
      throw new Error('Not implemented')
    },
  }

  type OtpPod = typeof config.OtpPod
  type HttpSess = HttpSession<AnonSessionData, {}>

  export const schema = {} satisfies SchemaDef
  export const schemaExtra: SchemaExtra<typeof schema> = {}

  export class Actions extends CF_BaseAction<RequiredModels> {
    OtpActions = this.init(config.OtpPod.Actions)

    async sendRegisterOtp({ email: emailStr, session }: { email: string; session: HttpSess }) {
      const { Email } = this.models
      let email = Email.findByOptional({ email: emailStr })
      if (email && email.user_id) {
        return err('email_taken', 'e142685')
      }
      email ||= Email.findBy({ id: Email.create({ email: emailStr }) })

      const otp = await this.OtpActions.send({
        email: email.email,
        intent: 'signup',
        target_id: email.id,
      })
      if (!otp.ok) return otp

      await session.setAnon({ otp_id: otp.value.id })

      return ok({ uuid: otp.value.uuid })
    }

    async verifyRegisterOtp({ code, session }: { code: string; session: HttpSess }) {
      const { Email } = this.models
      const { otp_id } = (await session.getAnon()) || {}
      if (!otp_id) return err('expired_code', 'e26596735')

      const res = this.OtpActions.verify({ code, by: { otp_id } })
      if (!res.ok) return res

      const { target_type, target_id } = res.value

      if (target_type === 'email') {
        const email = Email.findBy({ id: target_id })
        if (email.user_id) {
          // Login
          session.create(email.user_id)
        } else {
          // Register
          const res = await err.catch('user_create_failed', 'e5017428453', async () =>
            config.createUser({ email: email.email }),
          )
          if (!res.ok) return res
          session.create(res.value)
        }

        if (!email.verified_at) {
          Email.markVerified(email.id)
        }
      } else {
        return err('invalid_target', 'e957147385', { meta: { target_type } })
      }

      return ok({})
    }

    async sendRecoveryOtp({ email: emailStr, session }: { email: string; session: HttpSess }) {
      const { Email } = this.models
      let email = Email.findByOptional({ email: emailStr })
      if (!email || !email.user_id) {
        return err('email_not_found', 'e511459312')
      }
      const otp = await this.OtpActions.send({
        email: email.email,
        intent: 'recover',
        target_id: email.id,
      })
      if (!otp.ok) return otp

      await session.setAnon({ otp_id: otp.value.id })
      return otp
    }

    async verifyRecoveryOtp({ code, session }: { code: string; session: HttpSess }) {
      const { Email } = this.models
      const { otp_id } = (await session.getAnon()) || {}
      if (!otp_id) return err('expired_code', 'e57141231')

      const res = await this.OtpActions.verify({ code, by: { otp_id } })
      if (!res.ok) return res

      const { target_type, target_id } = res.value

      if (target_type === 'email') {
        const email = Email.findBy({ id: target_id })
        if (!email.user_id) {
          // Not recoverable
          return err('email_not_registered', 'e55722851')
        }
        session.create(email.user_id)
      } else {
        return err('invalid_target', 'e911459312', { meta: { target_type } })
      }

      return ok({})
    }
  }

  //
  // NOTE: If you eject this pod, you can replace the below with a reference to your own models
  //
  type RequiredModels = ReturnType<OtpPod['makeModels']> &
    ReturnType<(typeof CF_EmailPod)['makeModels']> &
    Models

  export type Models = {}

  export function makeModels(_db: BaseDbConn): Models {
    return {}
  }

  type RequiredCtx = BaseRpcCtx<CF_Runtime<RequiredModels>, SessionData, AnonSessionData>

  export function makeRpcs<R extends RequiredCtx>() {
    const def = makeRpcDefiner<R>()
    return {
      rpc_sendRegisterOtp: def(
        z.object({
          email: z.string().email(),
        }),
        async function execute({ email }) {
          return this.init(Actions).sendRegisterOtp({ email, session: this.httpSession })
        },
      ),
      rpc_verifyRegisterOtp: def(
        z.object({
          code: z.string(),
        }),
        async function execute({ code }) {
          return this.init(Actions).verifyRegisterOtp({ code, session: this.httpSession })
        },
      ),
      rpc_sendRecoveryOtp: def(
        z.object({
          email: z.string().email(),
        }),
        async function execute({ email }) {
          return this.init(Actions).sendRecoveryOtp({ email, session: this.httpSession })
        },
      ),
      rpc_verifyRecoveryOtp: def(
        z.object({
          code: z.string(),
        }),
        async function execute({ code }) {
          return this.init(Actions).verifyRecoveryOtp({ code, session: this.httpSession })
        },
      ),
    }
  }
}