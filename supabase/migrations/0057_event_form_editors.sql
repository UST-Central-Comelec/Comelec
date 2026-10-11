-- Event-specific questionnaire content, independent from deployment settings.
alter table public.event_rsvp_forms add column if not exists definition jsonb;
alter table public.event_evaluation_forms add column if not exists steps jsonb;
alter table public.event_evaluation_responses add column if not exists steps jsonb;
notify pgrst, 'reload schema';
