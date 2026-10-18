-- Keep birthdays as dates. Older registrations retain their recorded age, with no invented birthday.
alter table public.event_registrations
  add column if not exists date_of_birth date;

alter table public.event_registrations
  add constraint event_registrations_birthday_not_future
  check (date_of_birth is null or date_of_birth <= (now() at time zone 'Asia/Manila')::date);

comment on column public.event_registrations.date_of_birth is
  'Birthday supplied by the registrant. Age is calculated at registration for existing reports.';
