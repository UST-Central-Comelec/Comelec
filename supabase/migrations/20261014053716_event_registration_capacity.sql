begin;

alter table public.events
  add column minimum_registrants integer not null default 1 check (minimum_registrants >= 1),
  add column maximum_registrants integer check (maximum_registrants >= minimum_registrants),
  add column registered_count integer not null default 0 check (registered_count >= 0);

-- The counter and all admissions share the event row lock. A failed registration rolls both back.
lock table public.event_registrations in share row exclusive mode;
update public.events e set registered_count = (
  select count(*) from public.event_registrations r where r.event_id = e.id and r.status = 'registered'
);

create function public.event_capacity_status() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.registration_status = 'open' and new.maximum_registrants is not null
     and new.registered_count >= new.maximum_registrants then
    new.registration_status := 'waitlist';
  end if;
  return new;
end;
$$;
create trigger event_capacity_status before insert or update on public.events
for each row execute function public.event_capacity_status();

create function public.event_registration_capacity() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  target public.events%rowtype;
  old_event text;
  old_count integer := 0;
  new_count integer := 0;
begin
  if tg_op <> 'INSERT' then
    old_event := old.event_id;
    old_count := case when old.status = 'registered' then 1 else 0 end;
  end if;
  -- Lock both parents in a stable order when a registration moves between events.
  if tg_op = 'DELETE' then
    perform id from public.events where id = old_event for update;
    if old_count = 1 then update public.events set registered_count = registered_count - 1 where id = old_event; end if;
    return old;
  end if;
  perform id from public.events where id in (old_event, new.event_id) order by id for update;
  select * into target from public.events where id = new.event_id;
  if new.status = 'registered' and not (old_count = 1 and old_event = new.event_id) then
    if target.registration_status in ('closed', 'cancelled', 'rescheduled') or target.published = false then
      raise exception 'Event registration is closed' using errcode = 'P0001';
    end if;
    if target.registration_status = 'waitlist' or (target.maximum_registrants is not null and target.registered_count >= target.maximum_registrants) then
      new.status := 'waitlisted';
    end if;
  end if;
  new_count := case when new.status = 'registered' then 1 else 0 end;
  if old_event = new.event_id then
    if new_count <> old_count then update public.events set registered_count = registered_count + new_count - old_count where id = new.event_id; end if;
  else
    if old_count = 1 then update public.events set registered_count = registered_count - 1 where id = old_event; end if;
    if new_count = 1 then update public.events set registered_count = registered_count + 1 where id = new.event_id; end if;
  end if;
  return new;
end;
$$;
create trigger event_registration_capacity before insert or update or delete on public.event_registrations
for each row execute function public.event_registration_capacity();

revoke all on function public.event_capacity_status() from public, anon, authenticated;
revoke all on function public.event_registration_capacity() from public, anon, authenticated;
grant execute on function public.event_capacity_status(), public.event_registration_capacity() to service_role;
comment on column public.events.minimum_registrants is 'Minimum registration target; defaults to one.';
comment on column public.events.maximum_registrants is 'Confirmed registration limit; null means unlimited. Full events switch to waitlist.';
comment on column public.events.registered_count is 'Confirmed registrants, maintained transactionally by the registration capacity trigger.';
commit;
notify pgrst, 'reload schema';
