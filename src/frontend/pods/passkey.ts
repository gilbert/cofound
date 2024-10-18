import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types'

import { err } from '../../shared/result'

export async function getLoginAttestation(
  errCode: string,
  options: PublicKeyCredentialRequestOptionsJSON,
) {
  return err.catch('attest_failed', errCode, startAuthentication(options))
}

export async function activateLoginPasskeyAutofill(
  errCode: string,
  options: PublicKeyCredentialRequestOptionsJSON,
) {
  return err.catch('passkey_autofill_failed', errCode, startAuthentication(options, true))
}

export async function getNewPasskeyAttestation(
  errCode: string,
  options: PublicKeyCredentialCreationOptionsJSON,
) {
  return err.catch('attest_failed', errCode, startRegistration(options))
}
