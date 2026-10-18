-- Apply once in Supabase SQL Editor before deploying mobile 3.0.5 and the admin app.
-- Existing overlapping approved facility reservations must be resolved by an
-- Admin first; this migration deliberately fails rather than changing them.
begin;

create extension if not exists btree_gist;

-- Pending requests compete for approval; only approved slots are exclusive.
-- Quantity-based Amenity items retain their stock/return workflow.
alter table public.reservations
  add constraint reservations_approved_slot_exclusive
  exclude using gist (
    facility_id with =,
    tsrange(date + start_time, date + end_time, '[)') with &&
  ) where (quantity is null and lower(status) in ('approved', 'approved and paid'));

create or replace function public.guard_reservation_payment_flow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  -- RLS continues to decide which rows each caller may access.
  select exists (
    select 1 from public.admins
    where id = auth.uid() and role in (
      'super_admin', 'president', 'vice_president', 'secretary',
      'treasurer', 'board_member'
    )
  ) into is_admin;

  if auth.role() = 'service_role' then return new; end if;

  if not is_admin then
    if new.user_id is distinct from auth.uid() then
      raise exception 'You can only change your own reservation';
    end if;
    if tg_op = 'INSERT' then
      if new.status <> 'Pending' or new.proof_url is not null
          or new.reference_no is not null or new.paid_at is not null
          or coalesce(lower(new.payment_status), 'unpaid') <> 'unpaid' then
        raise exception 'Submit a pending request first; payment follows Admin approval';
      end if;
    else
      -- Residents cannot approve, mark paid, or alter a decided request's slot/fee.
      if (to_jsonb(new) - array['status', 'payment_status',
          'reference_no', 'proof_url', 'updated_at', 'returned_at',
          'return_condition', 'return_missing_qty', 'return_notes', 'return_condition_photo_url'])
        is distinct from
        (to_jsonb(old) - array['status', 'payment_status',
          'reference_no', 'proof_url', 'updated_at', 'returned_at',
          'return_condition', 'return_missing_qty', 'return_notes', 'return_condition_photo_url']) then
        raise exception 'Reservation details can only be changed by an Admin';
      end if;
      if new.status is distinct from old.status and not (
        (new.status = 'Cancelled' and old.status in ('Pending', 'Approved')) or
        (new.status = 'Return Pending' and old.status = 'Approved' and old.quantity is not null)
      ) then
        raise exception 'Only an Admin may approve a reservation or confirm payment';
      end if;
      if row(new.payment_status, new.reference_no, new.proof_url)
          is distinct from row(old.payment_status, old.reference_no, old.proof_url) then
        if old.status <> 'Approved' or new.status <> 'Approved'
            or coalesce(old.fee, 0) <= 0
            or lower(coalesce(old.payment_status, '')) in ('pending', 'pending_verification', 'paid')
            or new.payment_status is distinct from 'Pending' then
          raise exception 'Payment requires an approved, unpaid reservation';
        end if;
        if
            (coalesce(trim(new.reference_no), '') = '' or coalesce(new.proof_url, '') = '') then
          raise exception 'GCash requires proof of payment and a reference number';
        end if;
      end if;
    end if;
  end if;

  -- Payment verification never silently approves a pending request.
  if (lower(coalesce(new.payment_status, '')) = 'paid' or new.status = 'Approved and Paid')
      and (tg_op = 'INSERT' or old.status not in ('Approved', 'Approved and Paid', 'Completed')) then
    raise exception 'Approve the reservation before confirming payment';
  end if;
  return new;
end;
$$;

create trigger reservation_payment_flow
before insert or update on public.reservations
for each row execute function public.guard_reservation_payment_flow();

commit;
