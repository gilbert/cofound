import { Selects } from '../schema'
import { BaseModel, schema } from './base-model'

export class User extends BaseModel<typeof schema.users> {
  protected tablename = 'users'
  protected table = schema.users

  clean = this.makePick(['uid', 'name'])

  create(attrs: { name: string }) {
    return this.insert({
      ...attrs,
      uid: `usr-${this.generateUid(8, { alphabet: 'domainFriendly' })}`,
    })
  }

  update = this._updateWhere

  findByEmailOptional(email: string) {
    return this.db
      .prepare<string, Selects['users']>(
        `
          SELECT users.* FROM users
          JOIN emails ON emails.user_id = users.id
          WHERE emails.email = ?
        `,
      )
      .get(email)
  }
}
