alter table public.event_rsvp_responses add column if not exists updated_at timestamptz not null default now();
create or replace function public.touch_rsvp_response_updated_at() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
drop trigger if exists touch_rsvp_response_updated_at on public.event_rsvp_responses;
create trigger touch_rsvp_response_updated_at before update on public.event_rsvp_responses
for each row execute function public.touch_rsvp_response_updated_at();
notify pgrst, 'reload schema';
