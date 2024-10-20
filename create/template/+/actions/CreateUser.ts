import { err, ok } from 'cofound/shared/result'

import { BaseAction } from './base-action'

type CreateUserParams = {
  name?: string
  email: string
}

export class CreateUser extends BaseAction {
  run({ name, email }: CreateUserParams) {
    const { User, Email } = this.models
    const existing = Email.findByOptional({ email })
    if (existing && existing.user_id) {
      return err('unexpected', 'e475375924', { status: 400 })
    }

    name ||= email.split('@')[0]!

    return this.models.doTransaction('e98552234', () => {
      const user_id = User.create({ name })
      if (existing) {
        Email.setUserId(existing.id, user_id)
      } else {
        Email.create({ email, user_id })
      }
      return ok(user_id)
    })
  }
}
