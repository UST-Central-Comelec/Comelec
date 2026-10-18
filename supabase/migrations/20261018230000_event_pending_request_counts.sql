-- The sidebar's Events badge: registrants waiting for a request decision, counted once each, per event.
-- Counted in the database so the portal doesn't download every registration to count them.
create or replace function public.event_pending_request_counts(p_kinds text[])
returns table(event_id text, pending integer) language sql stable security invoker set search_path = '' as $$
  select r.event_id, count(*)::integer
  from public.event_registrations r
  where jsonb_typeof(r.requests) = 'object' and exists (
    select 1 from jsonb_each(r.requests) as e(kind, entry)
    where e.kind = any(p_kinds) and jsonb_typeof(e.entry) = 'object' and e.entry->>'status' = 'pending'
  )
  group by r.event_id
$$;
revoke all on function public.event_pending_request_counts(text[]) from public, anon, authenticated;
grant execute on function public.event_pending_request_counts(text[]) to service_role;
