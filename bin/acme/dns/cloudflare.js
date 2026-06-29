export const timeout = 60000

export const auth = {
  zone: 'CF_ZONE',
  token: 'CF_TOKEN'
}

export async function add(name, content, domain, { zone, token }) {
  const x = await fetch('https://api.cloudflare.com/client/v4/zones/' + zone + '/dns_records', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      content,
      type: 'TXT',
      comment: 'Cofound ACME challenge for ' + domain,
      ttl: 120
    })
  })

  if (!x.ok)
    throw new Error('Bad cloudflare response ' + x.status + ': ' + (await x.text()))

  return (await x.json()).result.id
}

export async function remove(id, { zone, token }) {
  await fetch('https://api.cloudflare.com/client/v4/zones/' + zone + '/dns_records/' + id, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Auth-Email': ''
    }
  })
}
