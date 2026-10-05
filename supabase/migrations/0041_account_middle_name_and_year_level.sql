-- Full middle names and year levels for manually added commissioner accounts.
-- Existing initials remain available as a fallback; they are not expanded into names.
alter table public.portal_accounts add column if not exists middle_name text;
alter table public.portal_accounts add column if not exists year_level text;

alter table public.portal_accounts drop constraint if exists portal_accounts_middle_name_check;
alter table public.portal_accounts add constraint portal_accounts_middle_name_check
  check (middle_name is null or char_length(middle_name) <= 80);

alter table public.portal_accounts drop constraint if exists portal_accounts_year_level_check;
alter table public.portal_accounts add constraint portal_accounts_year_level_check
  check (year_level is null or year_level in ('1', '2', '3', '4', '5', 'swis'));

notify pgrst, 'reload schema';
