-- Expected return date for borrowed amenity items (chairs, tents, etc.) —
-- lets a resident borrow on one day and return on a later date (e.g. a
-- multi-day event) instead of being locked to a same-day return, which the
-- mobile Reserve page's booking sheet previously had no way to express.

alter table public.reservations
  add column if not exists return_date date;

comment on column public.reservations.return_date is
  'Expected return date for quantity-based (borrowed) items. Null means same-day as `date` — used by time-slot facilities and older rows.';
