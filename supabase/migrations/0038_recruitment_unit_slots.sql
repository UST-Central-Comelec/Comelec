-- Existing shared vacancies become Central's; Local units start with zero until configured.
begin;
alter table public.recruitment_slots add column college text not null default '';
alter table public.recruitment_slots drop constraint recruitment_slots_pkey;
alter table public.recruitment_slots add primary key (college, position_id);

create or replace function public.sync_recruitment_slots() returns trigger
language plpgsql set search_path = public as $$
declare
  unit_college text := case when new.preferred_body = 'local' then new.college else '' end;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'accepted' then
    update public.recruitment_slots
    set slots = slots - 1, updated_at = now(), updated_by = coalesce(new.status_updated_by, 'system')
    where college = unit_college and position_id = new.position_id and slots > 0;
    if not found then
      raise exception 'recruitment_slots_full';
    end if;
  elsif old.status = 'accepted' then
    insert into public.recruitment_slots (college, position_id, slots, updated_at, updated_by)
    values (unit_college, new.position_id, 1, now(), coalesce(new.status_updated_by, 'system'))
    on conflict (college, position_id) do update
      set slots = least(public.recruitment_slots.slots + 1, 999), updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  end if;
  return new;
end $$;
commit;
notify pgrst, 'reload schema';
