-- Landing-page photo overrides for Team.jsx and AboutUs.jsx, managed from
-- HOA Page > Website Settings. Single row (id = 1), upserted from the app.

create table if not exists public.website_settings (
  id           integer primary key,
  team_photos  jsonb not null default '{}'::jsonb,
  about_photos jsonb not null default '{}'::jsonb,
  updated_at   timestamptz,
  updated_by   uuid references auth.users(id) on delete set null
);

alter table public.website_settings enable row level security;

-- Landing page is public — anyone can read the current photo overrides.
create policy "Public can read website settings"
  on public.website_settings
  for select
  to anon, authenticated
  using (true);

-- Only President, Vice President, Secretary, Board Member (or Super Admin)
-- may create/update the settings row.
create policy "Staff can insert website settings"
  on public.website_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.admins
      where admins.id = auth.uid()
        and admins.role in ('president', 'vice_president', 'secretary', 'board_member', 'super_admin')
    )
  );

create policy "Staff can update website settings"
  on public.website_settings
  for update
  to authenticated
  using (
    exists (
      select 1 from public.admins
      where admins.id = auth.uid()
        and admins.role in ('president', 'vice_president', 'secretary', 'board_member', 'super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.admins
      where admins.id = auth.uid()
        and admins.role in ('president', 'vice_president', 'secretary', 'board_member', 'super_admin')
    )
  );

-- Public storage bucket for the uploaded team/about photos.
insert into storage.buckets (id, name, public)
values ('website-photos', 'website-photos', true)
on conflict (id) do nothing;

create policy "Public can view website photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'website-photos');

create policy "Staff can upload website photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'website-photos'
    and exists (
      select 1 from public.admins
      where admins.id = auth.uid()
        and admins.role in ('president', 'vice_president', 'secretary', 'board_member', 'super_admin')
    )
  );

create policy "Staff can update website photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'website-photos'
    and exists (
      select 1 from public.admins
      where admins.id = auth.uid()
        and admins.role in ('president', 'vice_president', 'secretary', 'board_member', 'super_admin')
    )
  );
