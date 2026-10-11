-- Standalone events may be held on-site, online, or both.
begin;
alter table public.events drop constraint if exists events_venue_mode_check;
alter table public.events add constraint events_venue_mode_check
  check (venue_mode in ('onsite', 'online', 'both'));
commit;
notify pgrst, 'reload schema';
