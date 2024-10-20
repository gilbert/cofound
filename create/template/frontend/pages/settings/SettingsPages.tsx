import { cc } from 'cofound/frontend'
import s from 'sin'

import { routes } from '../../routes'
import { PasskeySettingsPage } from './PasskeySettingsPage'

export const SettingsPages = cc(function () {
  return () =>
    this.ctx.route({
      '/': () => {
        // Redirect to default settings page
        routes.settings.passkeys.visit()
        return null
      },

      '/passkeys': () => <PasskeySettingsPage />,
    })
})
