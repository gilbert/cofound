import { route } from 'cofound/frontend'
import { connect } from 'http2'

export const routes = {
  home: route('/'),

  auth: route('/auth', undefined, {
    signup: route('/signup', undefined, {
      verify: route('/verify'),
    }),
    login: route('/login', undefined, {
      verify: route('/verify'),
    }),
    connect: route('/connect', undefined, {
      success: route('/success'),
    }),
  }),

  dashboard: route('/dashboard'),

  settings: route('/settings', undefined, {
    passkeys: route('/passkeys'),
  }),
}
