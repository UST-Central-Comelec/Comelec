-- UST Central Comelec — site-wide settings, set in the portal (Maintenance). A single row:
--   maintenance:            the public website shows the "under maintenance" page (the portal stays up);
--   maintenance_message:    an optional line shown on that page, in place of the usual wording;
--   maintenance_since:      when it was last switched on;
--   cookie_notice:          whether the public website shows the cookie notice;
--   cookie_notice_reset_at: when "Show again to everyone" was last pressed; visitors who dismissed
--                           the notice before then see it once more.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Safe to re-run.

create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  maintenance boolean not null default false,
  maintenance_message text check (char_length(maintenance_message) <= 300),
  maintenance_since timestamptz,
  cookie_notice boolean not null default true,
  cookie_notice_reset_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

insert into public.site_settings (id) values (true)
on conflict (id) do nothing;

-- Read and written only by the server with the secret key.
alter table public.site_settings enable row level security;
