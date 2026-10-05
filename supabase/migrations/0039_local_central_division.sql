-- Each Local Comelec can recruit an Executive Assistant to its Central Representative.
-- Existing interview times belong to Central Comelec; Local units configure their own.
begin;

alter table public.interview_slots add column if not exists college text not null default '';
alter table public.interview_slots drop constraint if exists interview_slots_division_check;
alter table public.interview_slots add constraint interview_slots_division_check
  check (division in ('central', 'executive', 'legal', 'operations', 'public-information'));
alter table public.interview_slots drop constraint if exists interview_slots_central_division_unit_check;
alter table public.interview_slots add constraint interview_slots_central_division_unit_check
  check (division is distinct from 'central' or college <> '');
create index if not exists interview_slots_unit_division_idx
  on public.interview_slots (college, division, starts_at);

commit;
notify pgrst, 'reload schema';
