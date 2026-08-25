-- Adds editable Name/Position overrides for Board of Directors members,
-- alongside the existing photo overrides in website_settings.
-- Keyed the same way as team_photos (by the member's original/default name),
-- so existing team_photos entries stay valid.

alter table public.website_settings
  add column if not exists team_roster jsonb not null default '{}'::jsonb;
