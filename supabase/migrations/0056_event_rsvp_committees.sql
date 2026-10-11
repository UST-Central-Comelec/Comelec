-- Ordered committee preferences and resources are stored in RSVP answers JSON.
-- The preference limit is configured per event and enforced on submission.
alter table public.event_rsvp_forms
  add column if not exists committee_limit integer not null default 2
  check (committee_limit between 1 and 8);
notify pgrst, 'reload schema';
