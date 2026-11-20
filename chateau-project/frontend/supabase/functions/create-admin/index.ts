// supabase/functions/create-admin/index.ts
// Creates a new HOA admin account. Runs server-side so the service role key
// never has to live in the browser (the new sb_secret_ key format actively
// refuses browser-origin requests, and even the legacy key shouldn't be
// shipped to the client).
//
// Caller must be an authenticated, existing super_admin — verified below via
// their JWT before any privileged action runs.

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

    const { displayName, email, password, role } = await req.json()
    if (!displayName || !email || !password || !role) {
      return json({ error: 'Missing required fields' }, 400)
    }

    // ProfileManage.jsx, Sidebar.jsx and SuperAdProfile.jsx all read the
    // signed-in user's name from user_metadata.first_name/last_name — split
    // the single Display Name field into those so a new officer's name shows
    // up correctly everywhere from their first login, instead of falling
    // back to a placeholder.
    const [firstName, ...rest] = displayName.trim().split(/\s+/)
    const lastName = rest.join(' ')

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName, first_name: firstName, last_name: lastName, role },
    })
    if (createErr) return json({ error: createErr.message }, 400)

    const newId = created.user?.id

    const { error: insertErr } = await admin.from('admins').insert([{
      id: newId,
      display_name: displayName,
      email,
      role,
      created_at: new Date().toISOString(),
    }])

    if (insertErr) {
      // Roll back the auth user so retrying with the same email doesn't hit
      // "User already registered" from a half-created admin.
      await admin.auth.admin.deleteUser(newId!)
      return json({ error: insertErr.message }, 400)
    }

    // A DB trigger auto-creates a 'profiles' row on signup. Remove it so this
    // account only exists in 'admins'.
    const { error: profileDeleteErr } = await admin.from('profiles').delete().eq('id', newId)
    if (profileDeleteErr) {
      console.warn('Could not delete auto-generated profile:', profileDeleteErr.message)
    }

    return json({ id: newId }, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500)
  }
})
