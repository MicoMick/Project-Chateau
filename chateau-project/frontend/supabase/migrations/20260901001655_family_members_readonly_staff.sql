-- Staff are view-only on family_members — only the resident themselves
-- (owner or tenant) decides who to add or remove from their own household.

drop policy if exists "Staff can insert family members" on public.family_members;
drop policy if exists "Staff can update family members" on public.family_members;
drop policy if exists "Staff can delete family members" on public.family_members;
