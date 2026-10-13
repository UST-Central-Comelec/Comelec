-- Keep organizers’ acceptance and decline decisions for submission edit requests.
alter table public.event_response_edit_requests
  drop constraint if exists event_response_edit_requests_status_check;
alter table public.event_response_edit_requests
  add constraint event_response_edit_requests_status_check
  check (status in ('pending', 'addressed', 'accepted', 'declined'));
notify pgrst, 'reload schema';
