-- Adds admin-editable screenshot overrides for the Download page's app
-- preview carousel — one entry per app screen (Home Dashboard, Payments,
-- Notifications, Submit a Report, Reserve a Facility, Vote in Elections).
-- Keyed the same way as about_photos/team_photos: by the screen's display
-- name, matching APP_SCREENSHOTS in WebsiteSettings.jsx and the carousel
-- data in Downloadpage.jsx. Falls back to a bundled placeholder mockup
-- until an admin uploads the real screenshot for that screen.

alter table public.website_settings
  add column if not exists app_screenshots jsonb not null default '{}'::jsonb;
