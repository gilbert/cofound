import { cc } from 'cofound/frontend'
import s from 'sin'

import { Layout } from '../Layout'
import { client } from '../lib/rpc-client'

type Attrs = {
  title: string
}
export const HomePage = cc<Attrs>(async function () {
  const version = (await client.public_rpc_getAppVersion({})).unwrapMaybe()
  return ({ title }) => (
    <Layout>
      <h1>
        {title} Home Page ({version?.slice(0, 6) || 'Version load failed'})
      </h1>
    </Layout>
  )
})
