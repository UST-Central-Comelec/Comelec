-- Required for new recruitment applications; older records did not collect this document.
alter table public.applications
  add column if not exists registration_form_url text
  check (registration_form_url is null or char_length(registration_form_url) between 1 and 500);
