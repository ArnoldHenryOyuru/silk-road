// One-time setup: registers your IPN URL with Pesapal and prints the IPN id to
// put in PESAPAL_IPN_ID. Run it again only if the URL or environment changes
// (sandbox and live have separate ids).
//
//   node --env-file=.env.local scripts/register-ipn.mjs https://silkroadug.vercel.app/api/pesapal/ipn
//
// Needs Node 20.6+ for --env-file (check with: node -v).

const ipnUrl = process.argv[2]
const key = process.env.PESAPAL_CONSUMER_KEY
const secret = process.env.PESAPAL_CONSUMER_SECRET
const base = (process.env.PESAPAL_BASE_URL || '').replace(/\/+$/, '')

if (!ipnUrl || !key || !secret || !base) {
  console.error('Usage: node --env-file=.env.local scripts/register-ipn.mjs <ipn-url>')
  console.error('Needs PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET and PESAPAL_BASE_URL in .env.local')
  process.exit(1)
}

const headers = { Accept: 'application/json', 'Content-Type': 'application/json' }

const authRes = await fetch(`${base}/api/Auth/RequestToken`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
})
const auth = await authRes.json().catch(() => null)
if (!authRes.ok || !auth?.token) {
  console.error('Pesapal login failed. Check your key, secret and PESAPAL_BASE_URL.')
  process.exit(1)
}

const res = await fetch(`${base}/api/URLSetup/RegisterIPN`, {
  method: 'POST',
  headers: { ...headers, Authorization: `Bearer ${auth.token}` },
  body: JSON.stringify({ url: ipnUrl, ipn_notification_type: 'GET' }),
})
const data = await res.json().catch(() => null)

if (!res.ok || !data?.ipn_id) {
  console.error('Registering the IPN failed:', data?.error?.message ?? res.status)
  process.exit(1)
}

console.log('IPN registered for:', ipnUrl)
console.log('Put this in .env.local and in Vercel:')
console.log(`PESAPAL_IPN_ID=${data.ipn_id}`)
