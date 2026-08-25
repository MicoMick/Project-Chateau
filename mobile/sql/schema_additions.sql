-- ═══════════════════════════════════════════════════════════════════════════
-- Schema additions for:
--   1. Tenant Management module
--   2. GCash payment submission (proof + reference number)
--   3. Facility reservation fee (Court pricing)
--
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Review the RLS policies against your existing policies before running —
-- they assume `profiles.id = auth.uid()` is how residents already see their
-- own row (matches the pattern used elsewhere in this app).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tenant Management ─────────────────────────────────────────────────────
-- A tenant is a normal row in `profiles` (resident_type = 'tenant') that is
-- linked back to the homeowner who created it via `owner_id`. The tenant's
-- auth user is created by the `manage-tenant` Edge Function (service role),
-- so client code never needs to sign the tenant in to create the account.

alter table profiles
  add column if not exists owner_id uuid references profiles(id) on delete cascade;

create index if not exists idx_profiles_owner_id on profiles(owner_id);

-- Postgres has no `CREATE POLICY IF NOT EXISTS`, so drop-then-create.
-- Safe to re-run.

drop policy if exists "Owners can view own tenants" on profiles;
create policy "Owners can view own tenants"
  on profiles for select
  using (owner_id = auth.uid());

-- Homeowners may edit (name/phone/status) the tenant rows they created.
-- NOTE: this does not restrict *which* columns can change — if you need
-- column-level restriction, use a security-definer RPC instead.
drop policy if exists "Owners can update own tenants" on profiles;
create policy "Owners can update own tenants"
  on profiles for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());


-- ── 2. GCash payment submission ──────────────────────────────────────────────

alter table payments
  add column if not exists proof_url    text,
  add column if not exists reference_no text,
  add column if not exists submitted_at timestamptz;

-- Residents may submit (update) their own unpaid/overdue payment with proof.
-- Adjust/remove if you already have an equivalent policy.
drop policy if exists "Residents can submit their own payment proof" on payments;
create policy "Residents can submit their own payment proof"
  on payments for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── 3. Facility reservation fee (Court pricing) ──────────────────────────────
-- Court pricing (enforced client-side in reserve_page.dart): ₱150 for the
-- first hour, +₱50 for each additional hour (partial hours round up).

alter table reservations
  add column if not exists fee            numeric,
  add column if not exists payment_status text,       -- 'pending_verification' | 'paid' | null (no fee)
  add column if not exists reference_no   text,
  add column if not exists proof_url      text,
  add column if not exists paid_at        timestamptz;

-- Residents may attach GCash payment proof to their own reservation at
-- creation time. Adjust/remove if you already have an equivalent policy.
drop policy if exists "Residents can submit their own reservation payment" on reservations;
create policy "Residents can submit their own reservation payment"
  on reservations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── 4. Pre-signup availability checks ────────────────────────────────────────
-- signup_page.dart checks (before the user has an account, i.e. as the
-- anonymous/anon-key client) whether a lot, email, or phone is already taken.
-- A plain `select ... from profiles` fails under RLS for an anon caller
-- (policies here are keyed on `auth.uid()`), and the app was silently
-- swallowing that error and letting duplicates through. These functions run
-- as the table owner (`security definer`) and only ever return a boolean —
-- they never expose profile rows to the anon caller.

create or replace function public.is_lot_available(p_block text, p_lot text, p_street text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from profiles
    where block = p_block
      and lot = p_lot
      and street = p_street
      and resident_type = 'owner'
      and account_status = 'active'
  );
$$;

grant execute on function public.is_lot_available(text, text, text) to anon, authenticated;

create or replace function public.is_email_available(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from profiles where email = p_email);
$$;

grant execute on function public.is_email_available(text) to anon, authenticated;

create or replace function public.is_phone_available(p_phone text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from profiles where phone = p_phone);
$$;

grant execute on function public.is_phone_available(text) to anon, authenticated;


-- ── Storage buckets ───────────────────────────────────────────────────────────
-- Create these buckets in Supabase Storage if they don't already exist:
--   • payment-proofs   (private or public, matching your `move-in-docs` bucket setup)
-- The app uploads to:
--   payment-proofs/<user_id>/<payment_id>/<timestamp>.<ext>            (HOA dues)
--   payment-proofs/<user_id>/reservations/<timestamp>.<ext>            (facility bookings)
