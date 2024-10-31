import { ok } from 'cofound/result'

import { rpc, z } from '../lib/rpc-context'

export const rpc_getSessionData = rpc(z.object({}), async function execute() {
  const { User, Email, Passkey } = this.models
  const user = User.findBy({ id: this.session.user_id })
  const email = Email.findBy({ user_id: user.id, primary: true })
  return ok({
    user: {
      uid: user.uid,
      name: user.name,
      email: email.email,
      emailVerified: !!email.verified_at,
      hasPasskey: !!Passkey.findByOptional({ user_id: user.id }),
    },
  })
})

export const rpc_signout = rpc(z.object({}), async function execute() {
  this.httpSession.clear('user')
  this.httpSession.clear('anon')
  return ok({})
})
