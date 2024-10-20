import { composePods } from 'cofound/backend'
import { CF_EmailPod } from 'cofound/backend/pods/email'
import { CF_OtpPod } from 'cofound/backend/pods/otp'
import { CF_OtpAuthPod } from 'cofound/backend/pods/otp-auth'
import { CF_PasskeyPod } from 'cofound/backend/pods/passkey'
import { CF_SessionsPod } from 'cofound/backend/pods/sessions'

import { CreateUser } from '../actions/CreateUser'
import { getAppRuntime } from '../lib/app-runtime'
import { passkeysConfig } from '../lib/env'

//
// Recommended: Export each pod from here.
// This allows you other files to remain unchanged if you decide to eject a pod.
//
export const SessionsPod = CF_SessionsPod
export const EmailPod = CF_EmailPod
export const OtpPod = CF_OtpPod
export const OtpAuthPod = CF_OtpAuthPod
export const PasskeyPod = CF_PasskeyPod

//
// Configure pods here
//
// OtpPod.config.emailer = new PostmarkEmailer({
//   apiToken: POSTMARK_API_TOKEN
// })

OtpAuthPod.config.createUser = ({ email }) => {
  return getAppRuntime().get(CreateUser).run({ email })
}

PasskeyPod.config.passkeysConfig = passkeysConfig

//
// Compose for automatic schema and model initialization
//
export const allPods = composePods([SessionsPod, PasskeyPod, OtpPod, OtpAuthPod, EmailPod] as const)

export type PodsSessionData = ReturnType<(typeof allPods)['defaultSessionData']>
export type PodsAnonSessionData = ReturnType<(typeof allPods)['defaultAnonSessionData']>
