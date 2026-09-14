// supabase/functions/request-password-reset/index.ts
// Called by the mobile app's "Forgot password?" flow (residents/tenants) and
// the web login page's "Forgot password?" flow (admins). The caller isn't
// authenticated at this point, so this runs unauthenticated (verify_jwt
// disabled on deploy) and uses the service role to look up the account and
// log a request that Super Admins see via the notification bell.
//
// Checks residents first, then admins. Super Admin accounts are excluded on
// purpose — there is no self-service recovery for the Super Admin account;
// it must be reset directly in the database.
//
// Always returns a generic success response — never reveals whether the
// email matched an account, or which kind.

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

    let adminMatch: { id: string; display_name: string | null } | null = null
    if (!profile) {
      const { data: adminRow } = await admin
        .from('admins')
        .select('id, display_name, role')
        .ilike('email', normalizedEmail)
        .neq('role', 'super_admin')
        .maybeSingle()
      adminMatch = adminRow
    }

    const { error: insertErr } = await admin.from('password_reset_requests').insert({
      email: normalizedEmail,
      full_name: profile?.full_name ?? adminMatch?.display_name ?? null,
      resident_id: profile?.id ?? null,
      admin_id: adminMatch?.id ?? null,
    })
    if (insertErr) throw insertErr

    return json({ success: true }, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
})
