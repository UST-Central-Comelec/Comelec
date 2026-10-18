-- An accepted edit request gives the registrant or collaborator a private link to their own
-- response, prefilled, to change and send again under the same reference. The link works while the
-- request is accepted and not yet used.
alter table public.event_response_edit_requests
  add column if not exists edit_token uuid,
  add column if not exists edited_at timestamptz;
create unique index if not exists event_response_edit_requests_token
  on public.event_response_edit_requests(edit_token) where edit_token is not null;
-- Requests accepted before this migration get their link now.
update public.event_response_edit_requests
  set edit_token = gen_random_uuid()
  where status = 'accepted' and edit_token is null;
notify pgrst, 'reload schema';
