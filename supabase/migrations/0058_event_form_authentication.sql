-- Independent student verification settings for RSVP and evaluation deployment.
alter table public.event_rsvp_forms add column if not exists require_google boolean not null default false;
alter table public.event_evaluation_forms add column if not exists require_google boolean not null default false;
notify pgrst, 'reload schema';
