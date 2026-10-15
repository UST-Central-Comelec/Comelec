-- Filing of Candidacy, like Recruitment, can be held on-site and online together.
begin;

alter table public.unit_periods drop constraint if exists unit_periods_venue_mode_check;
alter table public.unit_periods add constraint unit_periods_venue_mode_check
  check (venue_mode in ('onsite', 'online') or (venue_mode = 'both' and kind in ('recruitment', 'candidacy')));

commit;
notify pgrst, 'reload schema';
