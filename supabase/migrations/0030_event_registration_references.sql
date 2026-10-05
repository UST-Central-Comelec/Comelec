-- Five-character public references; UUIDs remain internal identifiers.
-- Run after 0029. Existing registrations receive a code without changing their UUID.
begin;

alter table public.event_registrations add column if not exists reference_code text;

create or replace function public.new_event_registration_reference()
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  entropy bytea;
  byte_value integer;
begin
  <<allocate>>
  loop
    entropy := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    candidate := '';
    for i in 1..5 loop
      byte_value := get_byte(entropy, i - 1);
      -- Reject the leftover byte range to keep all 31 characters equally likely.
      if byte_value >= 248 then continue allocate; end if;
      candidate := candidate || substr(alphabet, 1 + byte_value % length(alphabet), 1);
    end loop;
    -- Hold the candidate until this transaction ends, including concurrent inserts.
    perform pg_advisory_xact_lock(73030, hashtext(candidate));
    if not exists (select 1 from public.event_registrations where reference_code = candidate) then
      return candidate;
    end if;
  end loop;
end;
$$;

alter table public.event_registrations alter column reference_code set default public.new_event_registration_reference();
update public.event_registrations set reference_code = public.new_event_registration_reference() where reference_code is null;
alter table public.event_registrations alter column reference_code set not null;

create unique index if not exists event_registrations_reference_code_key on public.event_registrations (reference_code);
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.event_registrations'::regclass and conname = 'event_registrations_reference_code_format') then
    alter table public.event_registrations add constraint event_registrations_reference_code_format check (reference_code ~ '^[A-Z0-9]{5}$');
  end if;
end;
$$;

-- Only the service role creates registrations and can allocate references.
revoke execute on function public.new_event_registration_reference() from public, anon, authenticated;
grant execute on function public.new_event_registration_reference() to service_role;
commit;
