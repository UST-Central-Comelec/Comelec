-- UST Central Comelec — recruitment slots follow accepted applications automatically. Accepting an
-- application takes one slot from its position (recruitment_slots); moving it off "accepted" (back
-- to pending, or rejected) gives the slot back. Accepting is refused when the position has no slots
-- left. (Interview times work the same way already: booking one takes a place, see 0006.)
-- This runs in the same transaction as the status change, so the count can't drift, even when two
-- commissioners accept at the same moment. Applications deleted after 60 days (0007) keep their
-- slot taken: the person was still accepted.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0004 and 0005 first. Safe to re-run.

create or replace function public.sync_recruitment_slots() returns trigger
language plpgsql as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'accepted' then
    -- The row lock taken by this update makes simultaneous accepts wait their turn.
    update public.recruitment_slots
    set slots = slots - 1, updated_at = now(), updated_by = coalesce(new.status_updated_by, 'system')
    where position_id = new.position_id and slots > 0;
    if not found then
      raise exception 'recruitment_slots_full';
    end if;
  elsif old.status = 'accepted' then
    insert into public.recruitment_slots (position_id, slots, updated_at, updated_by)
    values (new.position_id, 1, now(), coalesce(new.status_updated_by, 'system'))
    on conflict (position_id) do update
      set slots = least(public.recruitment_slots.slots + 1, 999), updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  end if;

  return new;
end $$;

drop trigger if exists applications_sync_recruitment_slots on public.applications;
create trigger applications_sync_recruitment_slots
  before update of status on public.applications
  for each row execute function public.sync_recruitment_slots();
