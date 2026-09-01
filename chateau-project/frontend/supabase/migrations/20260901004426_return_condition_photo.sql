-- Photo proof of an item's condition at RETURN time — mirrors
-- borrow_condition_photo_url, submitted either by the resident (mobile
-- self-report return flow) or by staff (web Verify Return step, optional).
-- Reuses the borrow-condition-photos bucket since it's the same purpose.

alter table public.reservations
  add column if not exists return_condition_photo_url text;
