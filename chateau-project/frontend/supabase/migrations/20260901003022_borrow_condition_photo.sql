-- Photo the resident submits when borrowing an Amenity Item, showing its
-- condition at pickup — protects both the resident and the HOA if there's
-- ever a dispute about damage on return. Submitted from the mobile app's
-- reservation form (reserve_page.dart); viewed by staff in Borrowers.jsx.

alter table public.reservations
  add column if not exists borrow_condition_photo_url text;

insert into storage.buckets (id, name, public)
values ('borrow-condition-photos', 'borrow-condition-photos', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload borrow condition photos"
  on storage.objects
  for insert
  to public
  with check (bucket_id = 'borrow-condition-photos' and auth.role() = 'authenticated');

create policy "Public can view borrow condition photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'borrow-condition-photos');
