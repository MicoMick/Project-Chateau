// supabase/functions/request-password-reset/index.ts
// Called by the mobile app's "Forgot password?" flow. The resident isn't
// authenticated at this point, so this runs unauthenticated (verify_jwt
// disabled on deploy) and uses the service role to look up their profile
// and log a request that Super Admins see via the notification bell.
//
// Always returns a generic success response — never reveals whether the
// email matched an account.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return json({ error: 'Email is required.' }, 400)
    }

    const normalizedEmail = email.trim().toLowerCase()

    const { data: profile } = await admin
      .from('profiles')
      .select('id, full_name')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    const { error: insertErr } = await admin.from('password_reset_requests').insert({
      email: normalizedEmail,
      full_name: profile?.full_name ?? null,
      resident_id: profile?.id ?? null,
    })
    if (insertErr) throw insertErr

    return json({ success: true }, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
})
