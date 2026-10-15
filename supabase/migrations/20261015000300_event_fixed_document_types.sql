-- Four mandatory fixed university forms; ordinary event letters start at 05.
-- Run after 20261015000200_event_control_numbers.sql. General Letters keep their settings.
begin;
lock table public.secretariat_letters, public.event_document_counters in access exclusive mode;

create or replace function public.event_document_form_type(p_type text)
returns text language plpgsql stable set search_path = public as $$
declare item jsonb; name text := lower(btrim(p_type));
begin
  if name in ('project proposal', 'project proposal form', 'project proposal form (ppf)', 'ppf') then
    return 'Project Proposal Form (PPF)';
  elsif name in ('community development project proposal form (simbahayan)', 'community development project proposal form', 'simbahayan') then
    return 'Community Development Project Proposal Form (Simbahayan)';
  elsif name in ('vehicle reservation form', 'vehicle reservation') then return 'Vehicle Reservation Form';
  elsif name in ('budget proposal', 'budget proposal form', 'budget proposal form (bpf)', 'bpf') then return 'Budget Proposal';
  end if;
  select entry into item from public.secretariat_settings,
    lateral jsonb_array_elements(value #> '{letters,types}') as entry
    where lower(entry ->> 'name') = name limit 1;
  if item ->> 'id' = 'project-proposal' or item ->> 'format' like 'UST:S030-00-FO120%' then
    return 'Project Proposal Form (PPF)';
  elsif item ->> 'id' = 'community-development-project-proposal' or item ->> 'format' like 'UST:S040-00-FO21%' then
    return 'Community Development Project Proposal Form (Simbahayan)';
  elsif item ->> 'id' = 'vehicle-reservation' or item ->> 'format' like 'UST:S040-00-FO25%' then return 'Vehicle Reservation Form';
  elsif item ->> 'id' = 'budget-proposal' or item ->> 'format' like 'UST:S030-00-FO130%' then return 'Budget Proposal';
  end if;
  return null;
end $$;

create or replace function public.event_document_form_number(p_type text)
returns text language sql stable set search_path = public as $$
  select case public.event_document_form_type(p_type)
    when 'Project Proposal Form (PPF)' then 'UST:S030-00-FO130'
    when 'Community Development Project Proposal Form (Simbahayan)' then 'UST:S040-00-FO21'
    when 'Vehicle Reservation Form' then 'UST:S040-00-FO25'
    when 'Budget Proposal' then 'UST:S030-00-FO130' else null end;
$$;

-- The marker prevents shifting existing numbers twice if this migration is rerun.
alter table public.event_document_counters add column if not exists reserved_forms smallint not null default 0;

create or replace function public.next_event_document_sequence(p_event_id text)
returns bigint language sql volatile set search_path = public as $$
  insert into public.event_document_counters as counter (event_id, last_value, reserved_forms) values (p_event_id, 5, 4)
  on conflict (event_id) do update set last_value = greatest(counter.last_value, 4) + 1, reserved_forms = 4
  returning last_value;
$$;

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
  select greatest(coalesce((select last_value from public.event_document_counters where event_id = p_event_id), 4), 4) + 1 into number;
  return parent.control_number || '-' || lpad(number::text, greatest(2, length(number::text)), '0');
end $$;

select set_config('secretariat.renaming', 'on', true);
-- Normalize the four event types and update fixed numbers without changing General Letters.
update public.secretariat_letters as letter set
  type = public.event_document_form_type(letter.type),
  control_format = null, control_sequence = null,
  control_number = public.event_document_form_number(letter.type) || ' (SA'
    || lpad(event.activity_sequence::text, greatest(2, length(event.activity_sequence::text)), '0') || ')'
from public.events event where letter.event_id = event.id and public.event_document_form_type(letter.type) is not null;

insert into public.event_document_counters as counter(event_id, last_value)
select event_id, max(control_sequence) from public.secretariat_letters
where event_id is not null and control_sequence is not null group by event_id
on conflict (event_id) do update set last_value = greatest(counter.last_value, excluded.last_value);

-- Descending order avoids colliding with an existing number four places ahead.
do $$
declare item record;
begin
  for item in select letter.id, letter.control_sequence, event.control_number
    from public.secretariat_letters letter
    join public.event_document_counters counter on counter.event_id = letter.event_id
    join public.events event on event.id = letter.event_id
    where letter.control_sequence is not null and counter.reserved_forms < 4
    order by letter.control_sequence desc, letter.id loop
    update public.secretariat_letters set control_sequence = item.control_sequence + 4,
      control_number = item.control_number || '-' || lpad((item.control_sequence + 4)::text, greatest(2, length((item.control_sequence + 4)::text)), '0')
      where id = item.id;
  end loop;
end $$;
update public.event_document_counters set last_value = last_value + 4, reserved_forms = 4 where reserved_forms < 4;
select set_config('secretariat.renaming', 'off', true);

-- Fixed event form names are independent of the General Letters type names.
create or replace function public.rename_secretariat_value(p_kind text, p_from text, p_to text)
returns void language plpgsql set search_path = public as $$
begin
  if p_kind = 'letterType' then
    update public.secretariat_letters set type = p_to where type = p_from
      and (event_id is null or public.event_document_form_type(type) is null);
  elsif p_kind = 'minuteType' then
    update public.secretariat_minutes set type = p_to where type = p_from;
  elsif p_kind = 'status' then
    update public.secretariat_letters set status = p_to where status = p_from;
    update public.secretariat_minutes set status = p_to where status = p_from;
  elsif p_kind = 'label' then
    update public.secretariat_letters set label = p_to where label = p_from;
    update public.secretariat_minutes set label = p_to where label = p_from;
  elsif p_kind = 'remark' then
    update public.secretariat_letters set remark_presets = array_replace(remark_presets, p_from, p_to) where p_from = any(remark_presets);
    update public.secretariat_minutes set remark_presets = array_replace(remark_presets, p_from, p_to) where p_from = any(remark_presets);
  elsif p_kind = 'office' then
    update public.secretariat_letters set destination_office = p_to where destination_office = p_from;
    update public.secretariat_minutes set destination_office = p_to where destination_office = p_from;
  end if;
end $$;

revoke all on function public.event_document_form_type(text) from public, anon, authenticated;
grant execute on function public.event_document_form_type(text) to service_role;
notify pgrst, 'reload schema';
commit;
