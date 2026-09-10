-- Captures the requester's role/display name at request-creation time instead
-- of relying on a live cross-admin lookup at review time. That lookup is
-- blocked by the admins table's RLS policy ("Self or super_admin can read
-- admins") whenever the reviewer isn't the requester or a super_admin — e.g.
-- the President reviewing a Treasurer's request — silently returning nothing
-- instead of erroring.
alter table approval_requests
  add column if not exists requested_by_role text,
  add column if not exists requested_by_name text;

-- Backfill existing rows from admins (this runs with elevated access, so it
-- isn't subject to the same RLS restriction the client hits).
update approval_requests ar
set requested_by_role = a.role,
    requested_by_name = a.display_name
from admins a
where ar.requested_by = a.id
  and ar.requested_by_role is null;
