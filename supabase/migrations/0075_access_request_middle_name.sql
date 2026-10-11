-- Full middle names for new access requests. Older requests keep their saved initials.
begin;

alter table public.access_requests add column if not exists middle_name text;
alter table public.access_requests drop constraint if exists access_requests_middle_name_check;
alter table public.access_requests add constraint access_requests_middle_name_check
  check (middle_name is null or (char_length(trim(middle_name)) between 1 and 80));

comment on column public.access_requests.middle_name is
  'Full middle name entered on Request access; null on older requests that collected only an initial.';

commit;
notify pgrst, 'reload schema';
