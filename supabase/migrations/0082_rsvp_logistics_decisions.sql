-- Organizers’ logistical decisions are separate from submitted RSVP answers.
alter table public.event_rsvp_responses
  add column if not exists logistics_decisions jsonb not null default '{}'::jsonb
  check (jsonb_typeof(logistics_decisions) = 'object');
notify pgrst, 'reload schema';
