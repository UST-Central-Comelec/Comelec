-- Internal event participants and collaborating Comelec units / other organizations.
begin;
alter table public.events
  add column if not exists open_to_internal boolean not null default false,
  add column if not exists collaborators text[] not null default '{}',
  add column if not exists other_collaborators text[] not null default '{}';

-- Replace the original unnamed audience check, including installations with different check names.
do $$
declare audience_check record;
begin
  for audience_check in
    select conname from pg_constraint
    where conrelid = 'public.events'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%open_to_students%'
      and pg_get_constraintdef(oid) like '%open_to_externals%'
      and pg_get_constraintdef(oid) like '%open_to_admins%'
  loop
    execute format('alter table public.events drop constraint %I', audience_check.conname);
  end loop;
end $$;
alter table public.events add constraint events_participants_check
  check (open_to_students or open_to_externals or open_to_admins or open_to_internal);
commit;
notify pgrst, 'reload schema';
