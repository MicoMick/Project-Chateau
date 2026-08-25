-- Editable QR code + APK download for the landing page's Download section
-- (DownloadPage.jsx), managed from HOA Page > Website Settings.

alter table public.website_settings
  add column if not exists download_qr_url   text,
  add column if not exists app_apk_url        text,
  add column if not exists app_apk_filename   text;

-- Public storage bucket for the uploaded APK file(s).
insert into storage.buckets (id, name, public)
values ('app-releases', 'app-releases', true)
on conflict (id) do nothing;

create policy "Public can view app releases"
  on storage.objects
  for select
  to public
  using (bucket_id = 'app-releases');

create policy "Staff can upload app releases"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'app-releases'
    and exists (
      select 1 from public.admins
      where admins.id = auth.uid()
        and admins.role in ('president', 'vice_president', 'secretary', 'board_member', 'super_admin')
    )
  );

create policy "Staff can update app releases"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'app-releases'
    and exists (
      select 1 from public.admins
      where admins.id = auth.uid()
        and admins.role in ('president', 'vice_president', 'secretary', 'board_member', 'super_admin')
    )
  );
