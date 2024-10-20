import { cc } from 'cofound/frontend'
import s from 'sin'

import { Layout } from '../../Layout'

type Attrs = {}
export const DashboardPage = cc<Attrs>(function () {
  return () => (
    <Layout>
      <h1>Dashboard</h1>
      <p>Welcome, user! 🤓</p>
    </Layout>
  )
})
