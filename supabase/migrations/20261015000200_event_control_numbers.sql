-- Stable activity numbers and document counters for event documentation.
-- Run after 20261015000100_event_documentations.sql. General Letters and Minutes keep their numbering.
begin;
lock table public.events, public.secretariat_letters in access exclusive mode;

create sequence if not exists public.event_activity_numbers;
alter table public.events
  add column if not exists activity_sequence bigint,
  add column if not exists control_year smallint,
  add column if not exists control_number text;
drop trigger if exists event_activity_control_number on public.events;

-- Keep numbers consumed by deleted events; existing events are assigned in creation order.
select setval('public.event_activity_numbers', greatest(
  coalesce((select max(activity_sequence) from public.events), 0),
  (select case when is_called then last_value else last_value - 1 end from public.event_activity_numbers)
) + 1, false);

do $$
declare item record; activity bigint; year_number integer;
begin
  for item in select id, created_at from public.events where activity_sequence is null order by created_at, id loop
    activity := nextval('public.event_activity_numbers');
    year_number := extract(year from item.created_at at time zone 'Asia/Manila');
    update public.events set activity_sequence = activity, control_year = year_number,
      control_number = 'UST:CC-' || lpad((year_number % 1000)::text, 3, '0')
        || '-SA' || lpad(activity::text, greatest(2, length(activity::text)), '0') where id = item.id;
  end loop;
end $$;

alter table public.events alter column activity_sequence set not null,
  alter column control_year set not null, alter column control_number set not null;
create unique index if not exists events_activity_sequence on public.events(activity_sequence);
create unique index if not exists events_control_number on public.events(control_number);

create or replace function public.assign_event_activity_control_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    NEW.activity_sequence := nextval('public.event_activity_numbers');
    NEW.control_year := extract(year from now() at time zone 'Asia/Manila');
    NEW.control_number := 'UST:CC-' || lpad((NEW.control_year % 1000)::text, 3, '0')
      || '-SA' || lpad(NEW.activity_sequence::text, greatest(2, length(NEW.activity_sequence::text)), '0');
  elsif NEW.activity_sequence is distinct from OLD.activity_sequence
    or NEW.control_year is distinct from OLD.control_year or NEW.control_number is distinct from OLD.control_number then
    raise exception 'An event’s activity number and control year are fixed.';
  end if;
  return NEW;
end $$;
create trigger event_activity_control_number before insert or update on public.events
  for each row execute function public.assign_event_activity_control_number();

create table if not exists public.event_document_counters (
  event_id text primary key references public.events(id) on delete cascade,
  last_value bigint not null check (last_value >= 0)
);
alter table public.event_document_counters enable row level security;
revoke all on public.event_document_counters from public, anon, authenticated;
grant all on public.event_document_counters to service_role;

create or replace function public.next_event_document_sequence(p_event_id text)
returns bigint language sql volatile set search_path = public as $$
  insert into public.event_document_counters as counter (event_id, last_value) values (p_event_id, 1)
  on conflict (event_id) do update set last_value = counter.last_value + 1 returning last_value;
$$;

-- Settings retain their renameable display names; the university form codes stay fixed.
create or replace function public.event_document_form_number(p_type text)
returns text language plpgsql stable set search_path = public as $$
declare item jsonb;
begin
  select entry into item from public.secretariat_settings,
    lateral jsonb_array_elements(value #> '{letters,types}') as entry
    where lower(entry ->> 'name') = lower(btrim(p_type)) limit 1;
  if item ->> 'id' = 'project-proposal' or item ->> 'format' = 'UST:S030-00-FO120' or item ->> 'format' like 'UST:S030-00-FO120 (%' then
    return 'UST:S030-00-FO120';
  elsif item ->> 'id' = 'budget-proposal' or item ->> 'format' = 'UST:S030-00-FO130' or item ->> 'format' like 'UST:S030-00-FO130 (%' then
    return 'UST:S030-00-FO130';
  end if;
  return case lower(btrim(p_type))
    when 'project proposal' then 'UST:S030-00-FO120'
    when 'project proposal form' then 'UST:S030-00-FO120'
    when 'project proposal form (ppf)' then 'UST:S030-00-FO120'
    when 'ppf' then 'UST:S030-00-FO120'
    when 'budget proposal' then 'UST:S030-00-FO130'
    when 'budget proposal form' then 'UST:S030-00-FO130'
    when 'budget proposal form (bpf)' then 'UST:S030-00-FO130'
    when 'bpf' then 'UST:S030-00-FO130' else null end;
end $$;

create or replace function public.preview_event_document_control_number(p_event_id text, p_type text)
returns text language plpgsql stable set search_path = public as $$
declare parent record; fixed text; number bigint;
begin
  select control_number, activity_sequence into parent from public.events where id = p_event_id;
  if not found then raise exception 'This event is unavailable.'; end if;
  fixed := public.event_document_form_number(p_type);
  if fixed is not null then
    return fixed || ' (SA' || lpad(parent.activity_sequence::text, greatest(2, length(parent.activity_sequence::text)), '0') || ')';
  end if;
  select coalesce((select last_value from public.event_document_counters where event_id = p_event_id), 0) + 1 into number;
  return parent.control_number || '-' || lpad(number::text, greatest(2, length(number::text)), '0');
end $$;

-- General Letters/Minutes keep the original implementation. Event documents have their own trigger.
create or replace function public.assign_secretariat_control_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_TABLE_NAME = 'secretariat_letters' then
    if TG_OP = 'UPDATE' and NEW.event_id is distinct from OLD.event_id then
      raise exception 'A document’s parent event is fixed.';
    end if;
    if NEW.event_id is not null then return NEW; end if;
  end if;
  if TG_OP = 'INSERT' then
    NEW.created_at := now();
  elsif NEW.prepared_by is distinct from OLD.prepared_by
     or NEW.created_by is distinct from OLD.created_by
     or NEW.created_at is distinct from OLD.created_at then
    raise exception 'The preparer and date added are fixed.';
  end if;
  NEW.control_format := nullif(btrim(NEW.control_format), '');
  if NEW.control_format is not null then
    -- A new record, or a type change to another automatic format, takes the next number.
    if TG_OP = 'INSERT' or NEW.control_format is distinct from OLD.control_format then
      NEW.control_sequence := public.next_secretariat_control_sequence(NEW.control_format);
      NEW.control_number := public.format_secretariat_control_number(NEW.control_format, NEW.control_sequence, now());
    elsif NEW.control_number is distinct from OLD.control_number
       or NEW.control_sequence is distinct from OLD.control_sequence then
      raise exception 'Automatically assigned control numbers are fixed.';
    end if;
  else
    NEW.control_sequence := null;
    NEW.control_number := btrim(coalesce(NEW.control_number, ''));
    if length(NEW.control_number) not between 1 and 100 then
      raise exception 'Enter a control number of up to 100 characters.';
    end if;
  end if;
  return NEW;
end $$;

create or replace function public.assign_event_document_control_number()
returns trigger language plpgsql set search_path = public as $$
declare parent record; fixed text; number bigint;
begin
  if TG_OP = 'INSERT' then
    NEW.created_at := now();
  else
    if NEW.event_id is distinct from OLD.event_id then raise exception 'A document’s parent event is fixed.'; end if;
    if NEW.prepared_by is distinct from OLD.prepared_by or NEW.created_by is distinct from OLD.created_by
      or NEW.created_at is distinct from OLD.created_at then raise exception 'The preparer and date added are fixed.'; end if;
    -- Settings renames change labels/types, not the assigned document identity.
    if current_setting('secretariat.renaming', true) = 'on' then return NEW; end if;
  end if;
  select control_number, activity_sequence into parent from public.events where id = NEW.event_id;
  if not found then raise exception 'This event is unavailable.'; end if;
  fixed := public.event_document_form_number(NEW.type);
  if fixed is not null then
    NEW.control_format := null;
    NEW.control_sequence := null;
    NEW.control_number := fixed || ' (SA' || lpad(parent.activity_sequence::text, greatest(2, length(parent.activity_sequence::text)), '0') || ')';
  else
    if TG_OP = 'INSERT' or OLD.control_format is distinct from parent.control_number or OLD.control_sequence is null then
      NEW.control_sequence := public.next_event_document_sequence(NEW.event_id);
      NEW.control_number := parent.control_number || '-' || lpad(NEW.control_sequence::text, greatest(2, length(NEW.control_sequence::text)), '0');
    elsif NEW.control_number is distinct from OLD.control_number or NEW.control_sequence is distinct from OLD.control_sequence then
      raise exception 'Automatically assigned event document numbers are fixed.';
    end if;
    NEW.control_format := parent.control_number;
  end if;
  return NEW;
end $$;

-- Re-number existing event documents once; rerunning keeps assigned numbers and consumed counters.
drop trigger if exists secretariat_event_document_control_number on public.secretariat_letters;
do $$
declare item record; fixed text; number bigint; activity text;
begin
  for item in select letter.*, event.control_number as event_number, event.activity_sequence
    from public.secretariat_letters letter join public.events event on event.id = letter.event_id
    order by letter.event_id, letter.created_at, letter.id loop
    activity := 'SA' || lpad(item.activity_sequence::text, greatest(2, length(item.activity_sequence::text)), '0');
    fixed := public.event_document_form_number(item.type);
    if fixed is not null then
      update public.secretariat_letters set control_format = null, control_sequence = null,
        control_number = fixed || ' (' || activity || ')' where id = item.id;
    elsif item.control_format is distinct from item.event_number or item.control_sequence is null then
      number := public.next_event_document_sequence(item.event_id);
      update public.secretariat_letters set control_format = item.event_number, control_sequence = number,
        control_number = item.event_number || '-' || lpad(number::text, greatest(2, length(number::text)), '0') where id = item.id;
    end if;
  end loop;
end $$;
create trigger secretariat_event_document_control_number before insert or update on public.secretariat_letters
  for each row when (NEW.event_id is not null) execute function public.assign_event_document_control_number();

revoke all on sequence public.event_activity_numbers from public, anon, authenticated;
grant usage, select on sequence public.event_activity_numbers to service_role;
revoke all on function public.assign_event_activity_control_number(), public.next_event_document_sequence(text),
  public.event_document_form_number(text), public.preview_event_document_control_number(text, text),
  public.assign_event_document_control_number() from public, anon, authenticated;
grant execute on function public.assign_event_activity_control_number(), public.next_event_document_sequence(text),
  public.event_document_form_number(text), public.preview_event_document_control_number(text, text),
  public.assign_event_document_control_number() to service_role;
notify pgrst, 'reload schema';
commit;
