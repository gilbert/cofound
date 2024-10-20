import { cc } from 'cofound/frontend'
import s from 'sin'

import { fetchBrowserSession, getBrowserSession } from './lib/browser-session'
import { HomePage } from './pages/HomePage'
import { ConnectPasskeyPage } from './pages/auth/ConnectPasskeyPage'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { SettingsPages } from './pages/settings/SettingsPages'

export const App = cc(function () {
  return () =>
    this.ctx.route({
      '/': () => <HomePage title="My App" />,
      '/auth/login': () => <LoginPage />,
      '/auth/signup': () => <SignupPage />,
      '/auth/connect': () => signedIn(<ConnectPasskeyPage />),

      '/dashboard': () => signedIn(<DashboardPage />),

      '/settings': () => signedIn(<SettingsPages />),

      '/*': () => (
        <div class="p-4">
          Page not found.{' '}
          <a href="/" class="underline">
            Go home
          </a>
        </div>
      ),
    })
})

function signedIn(content: any) {
  // Kick off session fetching (idempotent)
  fetchBrowserSession()
  //
  // Don't load inner content until session is loaded.
  // This guarantees the component can call getBrowserSession() safely
  //
  const sess = getBrowserSession()
  return sess && content
}
