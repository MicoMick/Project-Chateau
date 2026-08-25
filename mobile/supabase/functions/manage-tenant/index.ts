// Tenant account management, called as:
//   supabase.functions.invoke('manage-tenant', body: { action: '...', ... })
// The owner's session JWT identifies the caller (`ownerId`).
//
// Actions:
//   create      { email, password, first_name, last_name, middle_initial?, phone?,
//                 move_in_date, contract_copy_url?, barangay_clearance_url? }
//   deactivate  { tenant_id }
//   activate    { tenant_id }
//   delete      { tenant_id }
//
// New tenants start account_status 'pending' with a move_in_clearances row
// (resident_type 'tenant'), reviewed the same way as owner move-ins.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Admin client — bypasses RLS, used for the actual mutation.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // ── Identify the calling homeowner from their JWT ──────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return json({ error: 'Missing Authorization header' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return json({ error: 'Invalid session' }, 401);
    }
    const ownerId = userData.user.id;

    // Confirm the caller is an active owner.
    const { data: ownerProfile, error: ownerErr } = await admin
      .from('profiles')
      .select('id, resident_type, account_status, block, lot, street, address')
      .eq('id', ownerId)
      .maybeSingle();

    if (ownerErr || !ownerProfile) {
      return json({ error: 'Owner profile not found' }, 403);
    }
    if (ownerProfile.resident_type !== 'owner' || ownerProfile.account_status !== 'active') {
      return json({ error: 'Only active homeowners can manage tenants' }, 403);
    }

    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'create':
        return await createTenant(ownerProfile, body);
      case 'deactivate':
        return await setTenantStatus(ownerId, body.tenant_id, 'inactive');
      case 'activate':
        return await setTenantStatus(ownerId, body.tenant_id, 'active');
      case 'delete':
        return await deleteTenant(ownerId, body.tenant_id);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// ── Actions ──────────────────────────────────────────────────────────────────

async function createTenant(
  ownerProfile: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const {
    email, password, first_name, last_name, middle_initial, phone,
    move_in_date, contract_copy_url, barangay_clearance_url,
  } = body;
  if (!email || !password || !first_name || !last_name) {
    return json({ error: 'email, password, first_name and last_name are required' }, 400);
  }
  if (!move_in_date) {
    return json({ error: 'move_in_date is required' }, 400);
  }

  // Reject duplicate email up front for a clearer error than the auth API gives.
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existing) return json({ error: 'An account with this email already exists.' }, 409);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: email as string,
    password: password as string,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    return json({ error: createErr?.message ?? 'Failed to create tenant auth account' }, 400);
  }

  const tenantId = created.user.id;
  const mi = ((middle_initial as string) ?? '').trim().toUpperCase();
  const fullName = buildFullName(first_name as string, last_name as string, mi);

  const { error: profileErr } = await admin.from('profiles').upsert({
    id: tenantId,
    email,
    full_name: fullName,
    first_name,
    last_name,
    middle_initial: mi,
    phone: phone ?? null,
    block: ownerProfile.block,
    lot: ownerProfile.lot,
    street: ownerProfile.street,
    address: ownerProfile.address,
    resident_type: 'tenant',
    // Pending, not active — this tenant still needs HOA admin review of the
    // move-in clearance below, same as a self-registering homeowner.
    account_status: 'pending',
    owner_id: ownerProfile.id,
  }, { onConflict: 'id' });

  if (profileErr) {
    // Roll back the orphaned auth user so retries don't collide on email.
    await admin.auth.admin.deleteUser(tenantId);
    return json({ error: profileErr.message }, 400);
  }

  const { error: clearanceErr } = await admin.from('move_in_clearances').insert({
    user_id: tenantId,
    move_in_date,
    resident_type: 'tenant',
    contract_copy_url: contract_copy_url ?? null,
    barangay_clearance_url: barangay_clearance_url ?? null,
    status: 'pending',
  });

  if (clearanceErr) {
    // Without a clearance row this tenant would be stuck pending forever
    // with nothing for an admin to review — roll the whole creation back.
    await admin.from('profiles').delete().eq('id', tenantId);
    await admin.auth.admin.deleteUser(tenantId);
    return json({ error: clearanceErr.message }, 400);
  }

  return json({ tenant_id: tenantId });
}

async function setTenantStatus(ownerId: string, tenantId: string, status: 'active' | 'inactive') {
  if (!tenantId) return json({ error: 'tenant_id is required' }, 400);
  if (!(await ownsTenant(ownerId, tenantId))) return json({ error: 'Not your tenant' }, 403);

  if (status === 'active') {
    const { data: current } = await admin
      .from('profiles')
      .select('account_status')
      .eq('id', tenantId)
      .maybeSingle();
    if (current?.account_status === 'pending') {
      return json({
        error: 'This tenant is still awaiting HOA admin approval of their move-in clearance.',
      }, 400);
    }
  }

  const { error } = await admin
    .from('profiles')
    .update({ account_status: status })
    .eq('id', tenantId);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
}

async function deleteTenant(ownerId: string, tenantId: string) {
  if (!tenantId) return json({ error: 'tenant_id is required' }, 400);
  if (!(await ownsTenant(ownerId, tenantId))) return json({ error: 'Not your tenant' }, 403);

  await admin.from('profiles').delete().eq('id', tenantId);
  const { error } = await admin.auth.admin.deleteUser(tenantId);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
}

async function ownsTenant(ownerId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin
    .from('profiles')
    .select('owner_id')
    .eq('id', tenantId)
    .maybeSingle();
  return data?.owner_id === ownerId;
}

// Must stay in sync with the equivalent full-name formatting in signup_page.dart.
function buildFullName(first: string, last: string, middleInitial: string): string {
  return `${first}${middleInitial ? ' ' + middleInitial + '.' : ''} ${last}`.trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
