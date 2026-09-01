-- Family members living with a resident (owner or tenant) — shown in the
-- "Family Members" tab of ResidentDetailModal.jsx. Every profile (owner or
-- tenant) can have its own list, keyed by resident_id.

create table if not exists public.family_members (
  id             uuid primary key default gen_random_uuid(),
  resident_id    uuid not null references public.profiles(id) on delete cascade,
  full_name      text not null,
  relationship   text,
  birth_date     date,
  contact_number text,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null
);

create index if not exists family_members_resident_id_idx
  on public.family_members (resident_id);

alter table public.family_members enable row level security;

-- Residents can manage their own family members (self-service — e.g. from a
-- future mobile "My Household" screen).
create policy "Residents can view own family members"
  on public.family_members for select to authenticated
  using (resident_id = auth.uid());

create policy "Residents can insert own family members"
  on public.family_members for insert to authenticated
  with check (resident_id = auth.uid());

create policy "Residents can update own family members"
  on public.family_members for update to authenticated
  using (resident_id = auth.uid())
  with check (resident_id = auth.uid());

create policy "Residents can delete own family members"
  on public.family_members for delete to authenticated
  using (resident_id = auth.uid());

-- HOA staff can view/manage everyone's family members from Resident Management.
create policy "Staff can view all family members"
  on public.family_members for select to authenticated
  using (exists (select 1 from public.admins where admins.id = auth.uid()));

create policy "Staff can insert family members"
  on public.family_members for insert to authenticated
  with check (exists (select 1 from public.admins where admins.id = auth.uid()));

create policy "Staff can update family members"
  on public.family_members for update to authenticated
  using (exists (select 1 from public.admins where admins.id = auth.uid()))
  with check (exists (select 1 from public.admins where admins.id = auth.uid()));

create policy "Staff can delete family members"
  on public.family_members for delete to authenticated
  using (exists (select 1 from public.admins where admins.id = auth.uid()));
