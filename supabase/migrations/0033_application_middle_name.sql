-- Recruitment applicants now provide their full middle name. Keep the original initial for
-- older records and compatibility; a missing middle_name means it was never collected.
alter table public.applications
  add column if not exists middle_name text
  check (middle_name is null or char_length(trim(middle_name)) between 1 and 80);
