-- Recruitment listings can offer an on-site venue and an online option together.
begin;

alter table public.unit_periods drop constraint if exists unit_periods_venue_mode_check;
alter table public.unit_periods add constraint unit_periods_venue_mode_check
  check (venue_mode in ('onsite', 'online') or (venue_mode = 'both' and kind = 'recruitment'));

commit;
notify pgrst, 'reload schema';
