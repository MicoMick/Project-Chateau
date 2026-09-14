// supabase/functions/send-push-notification/index.ts
//
// Triggered by a Postgres trigger on `public.notifications` (AFTER INSERT),
// using Supabase's supabase_functions.http_request helper — see the
// `notifications_push_trigger` migration. Not called by a logged-in user, so
// (mirroring generate-monthly-dues/index.ts) it checks a shared secret in
// the "apikey" header instead of relying on Supabase's platform JWT check.
//
// Looks up device_tokens for the notification's target (a specific resident
// if user_id is set, or every registered device for a broadcast) and sends
// each one a push via Firebase Cloud Messaging's HTTP v1 API, authenticated
// with the Firebase service account key (FIREBASE_SERVICE_ACCOUNT secret).

import { createClient } from 'npm:@supabase/supabase-js@2'

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
  token_uri: string
}

interface NotificationRecord {
  id: string
  user_id: string | null
  title: string | null
  message: string | null
}

// ── PEM → CryptoKey ──────────────────────────────────────────────────────────

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '')
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

function base64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input)
  } else {
    bytes = new Uint8Array(input)
  }
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ── Exchange the service account for a short-lived FCM access token ─────────
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${base64url(signature)}`

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`)
  return data.access_token as string
}

Deno.serve(async (req: Request) => {
  const PUSH_SECRET = Deno.env.get('PUSH_TRIGGER_SECRET')
  const providedKey = req.headers.get('apikey') ?? ''
  if (PUSH_SECRET && providedKey !== PUSH_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const payload = await req.json()
    const record = payload?.record as NotificationRecord | undefined
    if (!record) {
      return new Response(JSON.stringify({ skipped: true, reason: 'No record in payload' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const serviceAccountRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!serviceAccountRaw) throw new Error('FIREBASE_SERVICE_ACCOUNT secret is not set')
    const serviceAccount = JSON.parse(serviceAccountRaw) as ServiceAccount

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Personal notification (user_id set) → only that resident's devices.
    // Broadcast (user_id null) → every registered device.
    let tokensQuery = supabase.from('device_tokens').select('id, token')
    if (record.user_id) {
      tokensQuery = tokensQuery.eq('user_id', record.user_id)
    }
    const { data: tokenRows, error: tokensErr } = await tokensQuery
    if (tokensErr) throw tokensErr
    if (!tokenRows?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'No registered devices' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const accessToken = await getAccessToken(serviceAccount)
    const title = record.title || 'Chateau HOA'
    const body = record.message || ''

    let sent = 0
    const staleTokenIds: string[] = []

    await Promise.all(
      tokenRows.map(async (row: { id: string; token: string }) => {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token: row.token,
                notification: { title, body },
                android: { priority: 'high' },
              },
            }),
          },
        )
        if (res.ok) {
          sent++
        } else {
          const errBody = await res.json().catch(() => ({}))
          const status = errBody?.error?.status
          if (status === 'UNREGISTERED' || status === 'NOT_FOUND' || status === 'INVALID_ARGUMENT') {
            staleTokenIds.push(row.id)
          }
        }
      }),
    )

    if (staleTokenIds.length) {
      await supabase.from('device_tokens').delete().in('id', staleTokenIds)
    }

    return new Response(
      JSON.stringify({ sent, total: tokenRows.length, removedStale: staleTokenIds.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
