-- Apply after 0067_minutes_tracker_and_control_year.sql.
-- Secretariat → Settings: letter and minutes types, their control number formats, labels, statuses,
-- remark presets and destination office suggestions. Types, statuses, labels and presets are no
-- longer fixed lists in the database; the server checks them against the saved settings.
--
-- Control numbers now come in three kinds, chosen per type:
--   automatic: control_format is set, and the trigger appends -001, -002, … from a counter kept per
--              format. Formats may contain {YYY} (026 for 2026) or {YYYY} (2026), in Manila time.
--   university-issued: a fixed number such as UST:S030-00-FO120, the same on every record.
--   typed by hand: when automatic numbering is switched off.
-- The last two leave control_format and control_sequence empty.
begin;
lock table public.secretariat_letters, public.secretariat_minutes in access exclusive mode;

create table if not exists public.secretariat_settings (
  id boolean primary key default true check (id),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by text not null
);
alter table public.secretariat_settings enable row level security;
revoke all on public.secretariat_settings from anon, authenticated;
grant all on public.secretariat_settings to service_role;

create table if not exists public.secretariat_control_counters (
  format text primary key check (length(btrim(format)) between 1 and 100),
  last_value bigint not null check (last_value >= 0)
);
alter table public.secretariat_control_counters enable row level security;
revoke all on public.secretariat_control_counters from anon, authenticated;
grant all on public.secretariat_control_counters to service_role;

-- The old fixed-list checks. Values are now validated against the saved settings.
alter table public.secretariat_letters
  drop constraint if exists secretariat_letters_type_check,
  drop constraint if exists secretariat_letters_status_check,
  drop constraint if exists secretariat_letters_label_check,
  drop constraint if exists secretariat_letters_remark_presets_check,
  add column if not exists control_format text check (control_format is null or length(btrim(control_format)) between 1 and 100),
  alter column control_sequence drop not null,
  add constraint secretariat_letters_type_check check (length(btrim(type)) between 1 and 100),
  add constraint secretariat_letters_status_check check (length(btrim(status)) between 1 and 100),
  add constraint secretariat_letters_label_check check (label is null or length(btrim(label)) between 1 and 100),
  add constraint secretariat_letters_remark_presets_check check (array_position(remark_presets, null) is null);
alter table public.secretariat_minutes
  drop constraint if exists secretariat_minutes_type_check,
  drop constraint if exists secretariat_minutes_status_check,
  drop constraint if exists secretariat_minutes_label_check,
  drop constraint if exists secretariat_minutes_remark_presets_check,
  drop constraint if exists secretariat_minutes_control_sequence_key,
  add column if not exists control_format text check (control_format is null or length(btrim(control_format)) between 1 and 100),
  alter column control_sequence drop not null,
  add constraint secretariat_minutes_control_number_check check (length(btrim(control_number)) between 1 and 100),
  add constraint secretariat_minutes_type_check check (length(btrim(type)) between 1 and 100),
  add constraint secretariat_minutes_status_check check (length(btrim(status)) between 1 and 100),
  add constraint secretariat_minutes_label_check check (label is null or length(btrim(label)) between 1 and 100),
  add constraint secretariat_minutes_remark_presets_check check (array_position(remark_presets, null) is null);
alter table public.secretariat_minutes alter column type drop default;

-- University-issued numbers repeat on every record of their type, so numbers are no longer unique.
-- Automatic numbers stay unique within their format.
drop index if exists public.secretariat_letters_control_number;
drop index if exists public.secretariat_letters_sequence;
drop index if exists public.secretariat_minutes_control_number;

drop trigger if exists secretariat_letter_control_number on public.secretariat_letters;
drop trigger if exists secretariat_minute_control_number on public.secretariat_minutes;

update public.secretariat_letters set control_format = 'UST:CC-{YYY}-LTR' where control_format is null and control_sequence is not null;
update public.secretariat_minutes set control_format = 'UST:CC-{YYY}-MIN' where control_format is null and control_sequence is not null;
create unique index if not exists secretariat_letters_numbering on public.secretariat_letters (control_format, control_sequence) where control_sequence is not null;
create unique index if not exists secretariat_minutes_numbering on public.secretariat_minutes (control_format, control_sequence) where control_sequence is not null;

-- Carry both sequences into the counters, so numbering continues and deleted numbers stay unused.
insert into public.secretariat_control_counters (format, last_value)
select 'UST:CC-{YYY}-LTR', greatest(
  coalesce((select max(control_sequence) from public.secretariat_letters), 0),
  (select case when is_called then last_value else last_value - 1 end from public.secretariat_letter_numbers))
on conflict (format) do nothing;
insert into public.secretariat_control_counters (format, last_value)
select 'UST:CC-{YYY}-MIN', greatest(
  coalesce((select max(control_sequence) from public.secretariat_minutes), 0),
  (select case when is_called then last_value else last_value - 1 end from public.secretariat_minute_numbers))
on conflict (format) do nothing;

drop function if exists public.assign_letter_control_number();
drop function if exists public.assign_minute_control_number();
drop function if exists public.preview_letter_control_number();
drop function if exists public.preview_minute_control_number();
drop sequence if exists public.secretariat_letter_numbers;
drop sequence if exists public.secretariat_minute_numbers;

create or replace function public.render_secretariat_control_format(p_format text, p_at timestamptz)
returns text language sql stable set search_path = public as $$
  select replace(replace(p_format,
    '{YYYY}', to_char(p_at at time zone 'Asia/Manila', 'YYYY')),
    '{YYY}', to_char(p_at at time zone 'Asia/Manila', 'YYY'));
$$;

create or replace function public.format_secretariat_control_number(p_format text, p_sequence bigint, p_at timestamptz)
returns text language sql stable set search_path = public as $$
  select public.render_secretariat_control_format(p_format, p_at) || '-' || lpad(p_sequence::text, greatest(3, length(p_sequence::text)), '0');
$$;

-- Each format counts on its own. Types that share a format share its numbers.
create or replace function public.next_secretariat_control_sequence(p_format text)
returns bigint language sql volatile set search_path = public as $$
  insert into public.secretariat_control_counters as counter (format, last_value) values (p_format, 1)
  on conflict (format) do update set last_value = counter.last_value + 1
  returning last_value;
$$;

-- Read the next possible number without consuming or reserving it.
create or replace function public.preview_secretariat_control_number(p_format text)
returns text language sql stable set search_path = public as $$
  select public.format_secretariat_control_number(p_format,
    coalesce((select last_value from public.secretariat_control_counters where format = btrim(p_format)), 0) + 1, now());
$$;

create or replace function public.assign_secretariat_control_number()
returns trigger language plpgsql set search_path = public as $$
begin
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
create trigger secretariat_letter_control_number before insert or update on public.secretariat_letters
for each row execute function public.assign_secretariat_control_number();
create trigger secretariat_minute_control_number before insert or update on public.secretariat_minutes
for each row execute function public.assign_secretariat_control_number();

-- Renaming a status in Settings changes stored values, which isn't a status update to announce.
create or replace function public.notify_letter_status_update()
returns trigger language plpgsql set search_path = public as $$
declare
  recipients text[];
  unit_label text;
begin
  if not NEW.notify_status_updates or NEW.status is not distinct from OLD.status
     or current_setting('secretariat.renaming', true) = 'on' then
    return NEW;
  end if;

  select coalesce(array_agg(id), '{}'::text[]) into recipients
  from public.portal_accounts
  where active and (
    (NEW.college is null and affiliation = 'central')
    or (NEW.college is not null and affiliation = 'local' and college = NEW.college)
  );

  -- The reserved executive identity can exist without a portal_accounts row.
  -- A stored executive profile is already included among Central accounts above.
  if NEW.college is null then
    recipients := array_append(recipients, 'built-in');
    unit_label := 'Central Comelec';
  else
    unit_label := NEW.college || ' Comelec';
  end if;

  if cardinality(recipients) > 0 then
    insert into public.portal_messages (
      kind, title, body, sender_name, audience_label, recipient_ids,
      sender_affiliation, sender_college, recipient_mention
    ) values (
      'activity', NEW.control_number || ' - Status updated to ' || NEW.status,
      NEW.title || E'\nStatus: ' || OLD.status || ' → ' || NEW.status
        || E'\nOpen Secretariat → Letters Tracker to view this letter.',
      'Secretariat', unit_label, recipients,
      case when NEW.college is null then 'central' else 'local' end,
      NEW.college, 'All members of ' || unit_label
    );
  end if;
  return NEW;
end $$;

create or replace function public.notify_minute_status_update()
returns trigger language plpgsql set search_path = public as $$
declare
  recipients text[];
  unit_label text;
begin
  if not NEW.notify_status_updates or NEW.status is not distinct from OLD.status
     or current_setting('secretariat.renaming', true) = 'on' then
    return NEW;
  end if;

  select coalesce(array_agg(id), '{}'::text[]) into recipients
  from public.portal_accounts
  where active and (
    (NEW.college is null and affiliation = 'central')
    or (NEW.college is not null and affiliation = 'local' and college = NEW.college)
  );

  -- The reserved executive identity can exist without a portal_accounts row.
  -- A stored executive profile is already included among Central accounts above.
  if NEW.college is null then
    recipients := array_append(recipients, 'built-in');
    unit_label := 'Central Comelec';
  else
    unit_label := NEW.college || ' Comelec';
  end if;

  if cardinality(recipients) > 0 then
    insert into public.portal_messages (
      kind, title, body, sender_name, audience_label, recipient_ids,
      sender_affiliation, sender_college, recipient_mention
    ) values (
      'activity', NEW.control_number || ' - Status updated to ' || NEW.status,
      NEW.title || E'\nStatus: ' || OLD.status || ' → ' || NEW.status
        || E'\nOpen Secretariat → Minutes of the Meetings to view these meeting minutes.',
      'Secretariat', unit_label, recipients,
      case when NEW.college is null then 'central' else 'local' end,
      NEW.college, 'All members of ' || unit_label
    );
  end if;
  return NEW;
end $$;

-- Saves the settings and carries renames into the records, in one transaction.
-- p_changes: { "renamed": [{ "kind", "from", "to" }], "removed": [{ "kind", "name" }] }, where kind
-- is letterType, minuteType, status, label, remark or office. A type or status still in use can't
-- be removed; removed labels and presets are cleared from records; offices are only suggestions.
-- Returns { "ok": true }, { "conflict": true } when someone else saved first, or
-- { "blocked": [{ "kind", "name", "count" }] } without saving anything.
create or replace function public.save_secretariat_settings(p_value jsonb, p_changes jsonb, p_expected timestamptz, p_actor text)
returns jsonb language plpgsql set search_path = public as $$
declare
  saved timestamptz;
  found_row boolean;
  change jsonb;
  used bigint;
  blocked jsonb := '[]'::jsonb;
  step int := 0;
begin
  select updated_at into saved from public.secretariat_settings where id for update;
  found_row := found;
  if (found_row and saved is distinct from p_expected) or (not found_row and p_expected is not null) then
    return jsonb_build_object('conflict', true);
  end if;

  for change in select value from jsonb_array_elements(coalesce(p_changes -> 'removed', '[]'::jsonb)) loop
    used := case change ->> 'kind'
      when 'letterType' then (select count(*) from public.secretariat_letters where type = change ->> 'name')
      when 'minuteType' then (select count(*) from public.secretariat_minutes where type = change ->> 'name')
      when 'status' then (select count(*) from public.secretariat_letters where status = change ->> 'name')
        + (select count(*) from public.secretariat_minutes where status = change ->> 'name')
      else 0 end;
    if used > 0 then
      blocked := blocked || jsonb_build_array(jsonb_build_object('kind', change ->> 'kind', 'name', change ->> 'name', 'count', used));
    end if;
  end loop;
  if jsonb_array_length(blocked) > 0 then
    return jsonb_build_object('blocked', blocked);
  end if;

  perform set_config('secretariat.renaming', 'on', true);
  for change in select value from jsonb_array_elements(coalesce(p_changes -> 'removed', '[]'::jsonb)) loop
    if change ->> 'kind' = 'label' then
      update public.secretariat_letters set label = null where label = change ->> 'name';
      update public.secretariat_minutes set label = null where label = change ->> 'name';
    elsif change ->> 'kind' = 'remark' then
      update public.secretariat_letters set remark_presets = array_remove(remark_presets, change ->> 'name') where (change ->> 'name') = any(remark_presets);
      update public.secretariat_minutes set remark_presets = array_remove(remark_presets, change ->> 'name') where (change ->> 'name') = any(remark_presets);
    end if;
  end loop;

  -- Two passes through placeholder values, so swapping two names doesn't merge them.
  for change in select value from jsonb_array_elements(coalesce(p_changes -> 'renamed', '[]'::jsonb)) loop
    step := step + 1;
    perform public.rename_secretariat_value(change ->> 'kind', change ->> 'from', E'\x01' || step);
  end loop;
  step := 0;
  for change in select value from jsonb_array_elements(coalesce(p_changes -> 'renamed', '[]'::jsonb)) loop
    step := step + 1;
    perform public.rename_secretariat_value(change ->> 'kind', E'\x01' || step, change ->> 'to');
  end loop;
  perform set_config('secretariat.renaming', 'off', true);

  insert into public.secretariat_settings (id, value, updated_at, updated_by) values (true, p_value, now(), p_actor)
  on conflict (id) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.rename_secretariat_value(p_kind text, p_from text, p_to text)
returns void language plpgsql set search_path = public as $$
begin
  if p_kind = 'letterType' then
    update public.secretariat_letters set type = p_to where type = p_from;
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

revoke all on function public.render_secretariat_control_format(text, timestamptz) from public, anon, authenticated;
revoke all on function public.format_secretariat_control_number(text, bigint, timestamptz) from public, anon, authenticated;
revoke all on function public.next_secretariat_control_sequence(text) from public, anon, authenticated;
revoke all on function public.preview_secretariat_control_number(text) from public, anon, authenticated;
revoke all on function public.assign_secretariat_control_number() from public, anon, authenticated;
revoke all on function public.notify_letter_status_update() from public, anon, authenticated;
revoke all on function public.notify_minute_status_update() from public, anon, authenticated;
revoke all on function public.save_secretariat_settings(jsonb, jsonb, timestamptz, text) from public, anon, authenticated;
revoke all on function public.rename_secretariat_value(text, text, text) from public, anon, authenticated;
grant execute on function public.render_secretariat_control_format(text, timestamptz), public.format_secretariat_control_number(text, bigint, timestamptz),
  public.next_secretariat_control_sequence(text), public.preview_secretariat_control_number(text),
  public.save_secretariat_settings(jsonb, jsonb, timestamptz, text), public.rename_secretariat_value(text, text, text) to service_role;

notify pgrst, 'reload schema';
commit;
