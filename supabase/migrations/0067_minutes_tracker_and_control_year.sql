-- Apply after 0066_letter_labels.sql. Both trackers use the creation year in Manila.
-- Sequences continue across years and deleted numbers are never reused.
begin;
lock table public.secretariat_letters in access exclusive mode;

-- Repair the year on historical records without changing their sequence or creation date.
alter table public.secretariat_letters disable trigger secretariat_letter_control_number;
update public.secretariat_letters
set control_number = 'UST:CC-' || to_char(created_at at time zone 'Asia/Manila', 'YYY')
  || '-LTR-' || lpad(control_sequence::text, greatest(3, length(control_sequence::text)), '0');
alter table public.secretariat_letters enable trigger secretariat_letter_control_number;

create or replace function public.assign_letter_control_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    NEW.control_sequence := nextval('public.secretariat_letter_numbers');
    NEW.created_at := now();
    NEW.control_number := 'UST:CC-' || to_char(NEW.created_at at time zone 'Asia/Manila', 'YYY') || '-LTR-' || lpad(NEW.control_sequence::text, greatest(3, length(NEW.control_sequence::text)), '0');
  elsif NEW.control_sequence is distinct from OLD.control_sequence
     or NEW.control_number is distinct from OLD.control_number
     or NEW.prepared_by is distinct from OLD.prepared_by
     or NEW.created_by is distinct from OLD.created_by
     or NEW.created_at is distinct from OLD.created_at then
    raise exception 'The control number, preparer and date added are fixed.';
  end if;
  return NEW;
end $$;

-- Read the next possible number without consuming or reserving it.
create or replace function public.preview_letter_control_number()
returns text language sql volatile set search_path = public as $$
  select 'UST:CC-' || to_char(now() at time zone 'Asia/Manila', 'YYY') || '-LTR-' || lpad(number::text, greatest(3, length(number::text)), '0')
  from (
    select case when is_called then last_value + 1 else last_value end as number
    from public.secretariat_letter_numbers
  ) as next_number;
$$;
revoke all on function public.preview_letter_control_number() from public, anon, authenticated;
grant execute on function public.preview_letter_control_number() to service_role;
notify pgrst, 'reload schema';

create table public.secretariat_minutes (
  id uuid primary key default gen_random_uuid(),
  control_number text not null,
  control_sequence bigint not null unique,
  title text not null check (length(btrim(title)) between 1 and 300),
  label text check (label in ('Priority', 'Print', 'Follow-up', 'Revise')),
  type text not null default 'Minutes of the Meeting' check (type = 'Minutes of the Meeting'),
  status text not null default 'Draft' check (status in ('Draft', 'For Signing', 'Signed', 'Approved', 'Discarded', 'Rejected')),
  destination_office text not null default '',
  working_document text not null default '',
  working_documents jsonb not null default '[]'::jsonb check (jsonb_typeof(working_documents) = 'array'),
  remarks text not null default '' check (length(remarks) <= 10000),
  notify_status_updates boolean not null default false,
  remark_presets text[] not null default '{}'::text[] check (remark_presets <@ array[
    'Print hard copy (Colored) - copy for recipient',
    'Print hard copy (Monochrome) - copy as receiving copy',
    'Signed in Person (Wet Signature)', 'Send to email'
  ]::text[] and array_position(remark_presets, null) is null),
  college text,
  prepared_by text not null,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index secretariat_minutes_control_number on public.secretariat_minutes (control_number);
create index secretariat_minutes_college_created on public.secretariat_minutes (college, created_at desc);
alter table public.secretariat_minutes enable row level security;
revoke all on public.secretariat_minutes from anon, authenticated;
grant all on public.secretariat_minutes to service_role;
create sequence public.secretariat_minute_numbers as bigint;
revoke all on sequence public.secretariat_minute_numbers from public, anon, authenticated;
grant usage, select on sequence public.secretariat_minute_numbers to service_role;

create or replace function public.assign_minute_control_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    NEW.control_sequence := nextval('public.secretariat_minute_numbers');
    NEW.created_at := now();
    NEW.control_number := 'UST:CC-' || to_char(NEW.created_at at time zone 'Asia/Manila', 'YYY') || '-MIN-' || lpad(NEW.control_sequence::text, greatest(3, length(NEW.control_sequence::text)), '0');
  elsif NEW.control_sequence is distinct from OLD.control_sequence
     or NEW.control_number is distinct from OLD.control_number
     or NEW.prepared_by is distinct from OLD.prepared_by
     or NEW.created_by is distinct from OLD.created_by
     or NEW.created_at is distinct from OLD.created_at then
    raise exception 'The control number, preparer and date added are fixed.';
  end if;
  return NEW;
end $$;
create trigger secretariat_minute_control_number before insert or update on public.secretariat_minutes
for each row execute function public.assign_minute_control_number();

-- Read the next possible number without consuming or reserving it.
create or replace function public.preview_minute_control_number()
returns text language sql volatile set search_path = public as $$
  select 'UST:CC-' || to_char(now() at time zone 'Asia/Manila', 'YYY') || '-MIN-' || lpad(number::text, greatest(3, length(number::text)), '0')
  from (
    select case when is_called then last_value + 1 else last_value end as number
    from public.secretariat_minute_numbers
  ) as next_number;
$$;
revoke all on function public.preview_minute_control_number() from public, anon, authenticated;
grant execute on function public.preview_minute_control_number() to service_role;
notify pgrst, 'reload schema';

create or replace function public.notify_minute_status_update()
returns trigger language plpgsql set search_path = public as $$
declare
  recipients text[];
  unit_label text;
begin
  if not NEW.notify_status_updates or NEW.status is not distinct from OLD.status then
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

revoke all on function public.notify_minute_status_update() from public, anon, authenticated;
drop trigger if exists secretariat_minute_status_notification on public.secretariat_minutes;
create trigger secretariat_minute_status_notification
after update of status on public.secretariat_minutes
for each row execute function public.notify_minute_status_update();


notify pgrst, 'reload schema';
commit;
