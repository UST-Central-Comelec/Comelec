-- Grade options used by applications, registrations, access requests and portal accounts.
-- Apply after 0041. Existing records are preserved.
alter table public.applications drop constraint if exists applications_year_level_check;
alter table public.applications add constraint applications_year_level_check
  check (year_level in ('1', '2', '3', '4', '5', 'swis', '7', '8', '9', '10', '11', '12'));

alter table public.access_requests drop constraint if exists access_requests_year_level_check;
alter table public.access_requests add constraint access_requests_year_level_check
  check (year_level in ('1', '2', '3', '4', '5', 'swis', '7', '8', '9', '10', '11', '12'));

alter table public.event_registrations drop constraint if exists event_registrations_year_level_check;
alter table public.event_registrations add constraint event_registrations_year_level_check
  check (year_level is null or year_level in ('1', '2', '3', '4', '5', 'swis', '7', '8', '9', '10', '11', '12'));

alter table public.portal_accounts drop constraint if exists portal_accounts_year_level_check;
alter table public.portal_accounts add constraint portal_accounts_year_level_check
  check (year_level is null or year_level in ('1', '2', '3', '4', '5', 'swis', '7', '8', '9', '10', '11', '12'));

notify pgrst, 'reload schema';
