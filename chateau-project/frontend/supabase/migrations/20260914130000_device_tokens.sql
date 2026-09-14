-- Firebase Cloud Messaging device tokens — one row per device a resident is
-- signed into, so the backend can push notifications (new announcements,
-- emergencies, etc.) to their phone even when the app is closed.
-- Registered from the mobile app (see lib/push_notifications.dart) and
-- consumed by whatever server-side process sends the actual pushes, using
-- the service role key (which bypasses RLS below entirely).

create table if not exists public.device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null unique,
  platform   text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_id_idx
  on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- Residents register/refresh/remove only their own device's token.
create policy "Residents can manage their own device tokens"
  on public.device_tokens for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
