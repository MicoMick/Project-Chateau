-- Extends password_reset_requests to also track Admin (non-super-admin
-- staff: president, vice president, secretary, treasurer, auditor, board
-- member) forgot-password requests submitted from the web login page,
-- alongside the existing resident/tenant requests from the mobile app.
--
-- A row now points at exactly one of resident_id / admin_id (or neither, if
-- the submitted email didn't match any account) — never both. Super Admin
-- accounts are deliberately excluded from this flow at the application
-- layer (see request-password-reset); there is no self-service recovery
-- for the Super Admin account by design.

alter table public.password_reset_requests
  add column if not exists admin_id uuid references public.admins(id) on delete set null;

create index if not exists password_reset_requests_admin_id_idx
  on public.password_reset_requests (admin_id);
