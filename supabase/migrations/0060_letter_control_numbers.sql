-- Apply after 0059_letters_tracker.sql. Numbers share one sequence across all units.
begin;
lock table public.secretariat_letters in access exclusive mode;

create sequence if not exists public.secretariat_letter_numbers as bigint;
alter table public.secretariat_letters add column if not exists control_sequence bigint;
alter table public.secretariat_letters add column if not exists prepared_by text;

-- Keep numbers that already use the requested format. Other existing letters are numbered below.
update public.secretariat_letters
set control_sequence = substring(control_number from '([0-9]+)$')::bigint
where control_sequence is null and control_number ~ '^UST:CC-026-LTR-[0-9]{3,18}$'
  and substring(control_number from '([0-9]+)$')::bigint > 0;

-- Resume after existing numbers without reusing numbers consumed by earlier inserts.
do $$
declare
  highest bigint;
  previous bigint;
  used boolean;
begin
  select coalesce(max(control_sequence), 0) into highest from public.secretariat_letters;
  select last_value, is_called into previous, used from public.secretariat_letter_numbers;
  if highest = 0 and not used then
    perform setval('public.secretariat_letter_numbers', 1, false);
  else
    perform setval('public.secretariat_letter_numbers', greatest(highest, previous), true);
  end if;
end $$;

-- Backfill previously manual numbers in creation order; preserve the original creator and time.
do $$
declare
  letter record;
  number bigint;
begin
  for letter in select id from public.secretariat_letters where control_sequence is null order by created_at, id loop
    number := nextval('public.secretariat_letter_numbers');
    update public.secretariat_letters
    set control_sequence = number,
        control_number = 'UST:CC-026-LTR-' || lpad(number::text, greatest(3, length(number::text)), '0')
    where id = letter.id;
  end loop;
end $$;

-- Older records retain the creator's email when a name snapshot was not recorded.
update public.secretariat_letters set prepared_by = created_by where prepared_by is null;
alter table public.secretariat_letters alter column control_sequence set not null;
alter table public.secretariat_letters alter column prepared_by set not null;
create unique index if not exists secretariat_letters_sequence on public.secretariat_letters (control_sequence);

create or replace function public.assign_letter_control_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    NEW.control_sequence := nextval('public.secretariat_letter_numbers');
    NEW.control_number := 'UST:CC-026-LTR-' || lpad(NEW.control_sequence::text, greatest(3, length(NEW.control_sequence::text)), '0');
    NEW.created_at := now();
  elsif NEW.control_sequence is distinct from OLD.control_sequence
     or NEW.control_number is distinct from OLD.control_number
     or NEW.prepared_by is distinct from OLD.prepared_by
     or NEW.created_by is distinct from OLD.created_by
     or NEW.created_at is distinct from OLD.created_at then
    raise exception 'The control number, preparer and date added are fixed.';
  end if;
  return NEW;
end $$;
drop trigger if exists secretariat_letter_control_number on public.secretariat_letters;
create trigger secretariat_letter_control_number before insert or update on public.secretariat_letters
for each row execute function public.assign_letter_control_number();

revoke all on sequence public.secretariat_letter_numbers from public, anon, authenticated;
grant usage, select on sequence public.secretariat_letter_numbers to service_role;
notify pgrst, 'reload schema';
commit;
