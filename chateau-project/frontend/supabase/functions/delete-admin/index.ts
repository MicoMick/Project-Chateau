// supabase/functions/delete-admin/index.ts
// Deletes an HOA admin account. Runs server-side so the service role key
// never has to live in the browser.
//
// Caller must be an authenticated, existing super_admin — verified below via
// their JWT before any privileged action runs. Deleting the Supabase Auth
// user also revokes that user's existing sessions, so this is what actually
// removes an outgoing officer's access (not just their admins table row).

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
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!jwt) return json({ error: 'Missing authorization' }, 401)

    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(jwt)
    if (callerErr || !caller) return json({ error: 'Invalid session' }, 401)

    const { data: callerAdmin } = await admin
      .from('admins')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()

    if (callerAdmin?.role !== 'super_admin') {
      return json({ error: 'Forbidden: super admin access required' }, 403)
    }

    const { id } = await req.json()
    if (!id) return json({ error: 'Missing required field: id' }, 400)

    const { data: target, error: targetErr } = await admin
      .from('admins')
      .select('role')
      .eq('id', id)
      .maybeSingle()

    if (targetErr) return json({ error: targetErr.message }, 400)
    if (!target) return json({ error: 'Admin not found' }, 404)
    if (target.role === 'super_admin') {
      return json({ error: 'Forbidden: cannot delete a super admin account' }, 403)
    }

    // Delete the Auth user first — this revokes the account's ability to log
    // in and invalidates its existing sessions immediately, which is the
    // actual security boundary. The admins row is just bookkeeping on top.
    const { error: authDeleteErr } = await admin.auth.admin.deleteUser(id)
    if (authDeleteErr) return json({ error: authDeleteErr.message }, 400)

    const { error: dbDeleteErr } = await admin.from('admins').delete().eq('id', id)
    if (dbDeleteErr) {
      // The Auth account is already gone (access is revoked); log and move on
      // rather than failing the request over a now-stale admins row.
      console.warn('Auth user deleted but admins row delete failed:', dbDeleteErr.message)
    }

    return json({ success: true }, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
})
