import {
  VerifiedRegistrationResponse,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/types'

import { formatDate } from '../../shared/date-utils'
import { err, ok } from '../../shared/result'
import { NoReadonly } from '../../shared/type-utils'
import { CF_BaseAction } from '../actions/base-action'
import { BaseDbConn } from '../db/make-db'
import { SchemaDef, SchemaExtra, col } from '../db/schema'
import { HttpSession } from '../http/http-session'
import { CF_BaseModel } from '../models/base-model'

export namespace CF_PasskeyPod {
  export type SessionData = {
    passkeyConnectOpts?: PublicKeyCredentialCreationOptionsJSON
  }
  export type AnonSessionData = {
    passkeyLoginOpts?: PublicKeyCredentialRequestOptionsJSON
  }

  export const defaultSessionData = () => ({}) as SessionData
  export const defaultAnonSessionData = () => ({}) as AnonSessionData

  type HttpSess = HttpSession<AnonSessionData, SessionData>

  export const PASSKEY_TRANSPORTS = [
    'ble',
    'cable',
    'hybrid',
    'internal',
    'nfc',
    'smart-card',
    'usb',
  ] as const

  export const schema = {
    passkeys: {
      id: col.primary(),
      type: col.enum(['passkey'] as const),
      user_id: col.integer().references(),
      credential_id: col.text().index('unique'),
      public_key: col.text(),
      webauthn_user_id: col.text(),
      counter: col.integer().default(`0`),
      device_type: col.enum(['singleDevice', 'multiDevice']),
      backed_up: col.boolean().default(`0`),
      transports: col.json<NoReadonly<typeof PASSKEY_TRANSPORTS>>(),
      created_at: col.created_at(),
    },
  } satisfies SchemaDef

  export const schemaExtra: SchemaExtra<typeof schema> = {}

  export class Passkey extends CF_BaseModel<typeof schema.passkeys, BaseDbConn> {
    protected tablename = 'passkeys'
    protected columns = schema.passkeys

    clean = this.makePick([
      'type',
      'credential_id',
      'public_key',
      'webauthn_user_id',
      'device_type',
      'backed_up',
      'transports',
      'created_at',
    ])

    register = this.insert

    updateCounter(id: number, counter: number) {
      this._updateWhere({ id }, { counter })
    }

    delete(id: number) {
      this.deleteWhere({ id })
    }
  }

  export abstract class PasskeyActions extends CF_BaseAction<Models> {
    protected abstract passkeysConfig: {
      rpName: string
      rpId: string
      origin: string
    }

    async getSignupOptions({
      email,
      user_id,
      httpSession,
    }: {
      email: string
      user_id: number
      httpSession: HttpSess
    }) {
      const { Passkey } = this.models
      const opts = await generateRegistrationOptions({
        rpName: this.passkeysConfig.rpName,
        rpID: this.passkeysConfig.rpId,
        userName: `${email} (${formatDate('yyyy-MM-DD HH:mm', new Date())})`,

        // Don't prompt users for additional information about the authenticator
        // (Recommended for smoother UX)
        attestationType: 'none',

        // Prevent users from re-registering existing authenticators
        excludeCredentials: Passkey.findAll({ user_id }).map((passkey) => ({
          id: passkey.credential_id,
          // Optional
          transports: passkey.transports.slice(),
        })),

        authenticatorSelection: {
          // Defaults
          residentKey: 'preferred',
          userVerification: 'preferred',
          // Optional
          // authenticatorAttachment: 'platform',
        },
      })
      httpSession.patch({ passkeyConnectOpts: opts })
      return ok(opts)
    }

    async connectNewPasskey({
      user_id,
      session,
      attestation,
    }: {
      session: SessionData
      user_id: number
      attestation: RegistrationResponseJSON
    }) {
      const { Passkey } = this.models

      const opts = session.passkeyConnectOpts
      if (!opts) {
        return err('missing_options', 'e142793255')
      }

      let res: VerifiedRegistrationResponse
      try {
        res = await this.verifyRegistrationResponse({
          response: attestation,
          expectedRPID: this.passkeysConfig.rpId,
          expectedOrigin: this.passkeysConfig.origin,
          expectedChallenge: opts.challenge,
          requireUserVerification: false,
        })
      } catch (cause: any) {
        return err('invalid_passkey_response', 'e8411344', { meta: { cause } })
      }

      if (!res.verified) {
        return err('not_verified', 'e95113442')
      }

      Passkey.register({
        type: 'passkey',
        user_id,
        backed_up: false,
        credential_id: res.registrationInfo!.credentialID,
        counter: res.registrationInfo!.counter,
        device_type: res.registrationInfo!.credentialDeviceType,
        public_key: Buffer.from(res.registrationInfo!.credentialPublicKey).toString('base64'),
        transports: attestation.response.transports || [],
        webauthn_user_id: opts.user.id,
      })

      return ok({})
    }

    verifyRegistrationResponse = verifyRegistrationResponse

    async getLoginOptions({ httpSession }: { httpSession: HttpSess }) {
      const passkeyLoginOpts = await generateAuthenticationOptions({
        rpID: this.passkeysConfig.rpId,
        userVerification: 'preferred',
      })
      await httpSession.setAnon({ passkeyLoginOpts })
      return ok(passkeyLoginOpts)
    }

    async loginWithPasskey({
      attestation,
      httpSession,
    }: {
      attestation: AuthenticationResponseJSON
      httpSession: HttpSess
    }) {
      const { passkeyLoginOpts } = (await httpSession.getAnon()) || {}
      if (!passkeyLoginOpts) {
        return err('no_options', 'e14555823')
      }
      const passkey = await this.verifyAttestation({ attestation, passkeyLoginOpts })
      if (!passkey.ok) return passkey

      await httpSession.create(passkey.value.user_id)
      return passkey
    }

    async verifyAttestation({
      attestation,
      passkeyLoginOpts,
    }: {
      attestation: AuthenticationResponseJSON
      passkeyLoginOpts: PublicKeyCredentialRequestOptionsJSON
    }) {
      const { Passkey } = this.models
      const passkey = Passkey.findByOptional({ credential_id: attestation.id })
      if (!passkey) {
        return err('no_such_passkey', 'e45528841')
      }

      const verification = await err.catch('verify_failed', 'e9522234', () =>
        verifyAuthenticationResponse({
          response: attestation,
          expectedChallenge: passkeyLoginOpts.challenge,
          expectedOrigin: this.passkeysConfig.origin,
          expectedRPID: this.passkeysConfig.rpId,
          authenticator: {
            credentialID: passkey.credential_id,
            credentialPublicKey: Buffer.from(passkey.public_key, 'base64'),
            counter: passkey.counter,
            transports: passkey.transports,
          },
          requireUserVerification: false,
        }),
      )

      if (!verification.ok) return verification
      if (!verification.value.verified) return err('verify_failed', 'e862584345')

      Passkey.updateCounter(passkey.id, verification.value.authenticationInfo.newCounter)

      return ok.sensitive(passkey)
    }
  }

  export type Models = { Passkey: Passkey }

  export function makeModels(db: BaseDbConn): Models {
    return {
      Passkey: new Passkey(db),
    }
  }
}
