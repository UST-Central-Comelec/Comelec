-- Preserve sender identity and recipient labels independently of account/name changes.
-- Rich announcement bodies use the same serialized text format as Documents.
alter table public.portal_messages add column if not exists sender_affiliation text
  check (sender_affiliation in ('central', 'local', 'osa'));
alter table public.portal_messages add column if not exists sender_college text;
alter table public.portal_messages add column if not exists recipient_mention text;
notify pgrst, 'reload schema';
