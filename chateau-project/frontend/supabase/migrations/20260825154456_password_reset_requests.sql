-- Forgot-password requests submitted from the mobile app. Residents aren't
-- authenticated when they hit "Forgot password?", so rows are only ever
-- written by the request-password-reset Edge Function (service role) —
-- there is deliberately no INSERT policy for anon/authenticated clients.
-- Super Admins read/act on these via the notification bell in the web app.

create table if not exists public.password_reset_requests (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  full_name   text,
  resident_id uuid references public.profiles(id) on delete set null,
  status      text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists password_reset_requests_status_idx
  on public.password_reset_requests (status, created_at desc);

alter table public.password_reset_requests enable row level security;

create policy "Super admins can read password reset requests"
  on public.password_reset_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.admins
      where admins.id = auth.uid() and admins.role = 'super_admin'
    )
  );

create policy "Super admins can update password reset requests"
  on public.password_reset_requests
  for update
  to authenticated
  using (
    exists (
      select 1 from public.admins
      where admins.id = auth.uid() and admins.role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from public.admins
      where admins.id = auth.uid() and admins.role = 'super_admin'
    )
  );

-- Live updates for the Super Admin notification bell.
alter publication supabase_realtime add table public.password_reset_requests;
