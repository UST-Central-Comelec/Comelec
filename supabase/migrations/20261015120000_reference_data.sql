-- Apply after 20261015081414_event_deployment_grace.sql.
-- Administrative → Database: the colleges and faculties, programs, admin offices, Comelec positions
-- and Comelec roles the forms and dropdowns offer. Each list is a section saved on its own row:
--   colleges, offices, role-names                     the whole commission's (Central official account)
--   programs:<college>, positions:<unit>, roles:<unit>  one unit's ("" after the colon is the Central
--                                                     Comelec); its Local official account edits its own
-- A section with no row keeps the defaults written in the code (src/lib/reference/data.ts).
begin;

create table if not exists public.reference_data (
  section text primary key check (section ~ '^(colleges|offices|role-names|(programs|positions|roles):.{0,120})$'),
  value jsonb not null check (jsonb_typeof(value) in ('array', 'object')),
  updated_at timestamptz not null default now(),
  updated_by text not null
);
alter table public.reference_data enable row level security;
revoke all on public.reference_data from anon, authenticated;
grant all on public.reference_data to service_role;

-- Saves one section over the version the editor loaded (p_expected: its updated_at, null when it had
-- none). Refuses, saving nothing, when someone saved in between ({conflict}) or when something it
-- removes is still in use ({blocked: [{name, count}]}):
--   p_role_checks     roles held by an account in the unit (p_unit: '' Central, else the college)
--   p_college_checks  colleges any account names
--   p_unit_checks     colleges whose Local Comelec has accounts
--   p_program_checks  programs an account in the college (p_unit) has
-- p_renames ([{from_name, to_name}]) renames the roles the unit's accounts hold, and
-- p_program_renames the program the college's accounts and pending access requests have, in the
-- same step. Applications and registrations keep the name they were submitted with.
-- The first version of this function took no program arguments; replace it rather than add a second.
drop function if exists public.save_reference_section(text, jsonb, timestamptz, text, text, jsonb, text[], text[], text[]);

create or replace function public.save_reference_section(
  p_section text,
  p_value jsonb,
  p_expected timestamptz,
  p_actor text,
  p_unit text default '',
  p_renames jsonb default '[]'::jsonb,
  p_role_checks text[] default '{}',
  p_college_checks text[] default '{}',
  p_unit_checks text[] default '{}',
  p_program_renames jsonb default '[]'::jsonb,
  p_program_checks text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stamp timestamptz;
  blocked jsonb;
  saved_at timestamptz := clock_timestamp();
begin
  perform pg_advisory_xact_lock(hashtext('reference_data:' || p_section));
  select updated_at into current_stamp from public.reference_data where section = p_section;
  if current_stamp is distinct from p_expected then
    return jsonb_build_object('conflict', true);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', used.name, 'count', used.total)), '[]'::jsonb) into blocked
  from (
    select checked.name, count(*) as total
    from unnest(p_role_checks) as checked(name)
    join public.portal_accounts account on account.role = checked.name
      and (case when p_unit = '' then account.affiliation = 'central' else account.affiliation = 'local' and account.college = p_unit end)
    group by checked.name
    union all
    select checked.name, count(*)
    from unnest(p_college_checks) as checked(name)
    join public.portal_accounts account on account.college = checked.name
    group by checked.name
    union all
    select checked.name, count(*)
    from unnest(p_unit_checks) as checked(name)
    join public.portal_accounts account on account.affiliation = 'local' and account.college = checked.name
    group by checked.name
    union all
    select checked.name, count(*)
    from unnest(p_program_checks) as checked(name)
    join public.portal_accounts account on account.college = p_unit and account.program = checked.name
    group by checked.name
  ) as used;
  if jsonb_array_length(blocked) > 0 then
    return jsonb_build_object('blocked', blocked);
  end if;

  update public.portal_accounts account
  set role = renamed.to_name, updated_at = saved_at, updated_by = p_actor
  from jsonb_to_recordset(p_renames) as renamed(from_name text, to_name text)
  where account.role = renamed.from_name
    and (case when p_unit = '' then account.affiliation = 'central' else account.affiliation = 'local' and account.college = p_unit end);

  update public.portal_accounts account
  set program = renamed.to_name, updated_at = saved_at, updated_by = p_actor
  from jsonb_to_recordset(p_program_renames) as renamed(from_name text, to_name text)
  where account.college = p_unit and account.program = renamed.from_name;

  update public.access_requests request
  set program = renamed.to_name
  from jsonb_to_recordset(p_program_renames) as renamed(from_name text, to_name text)
  where request.status = 'pending' and request.college = p_unit and request.program = renamed.from_name;

  insert into public.reference_data (section, value, updated_at, updated_by)
  values (p_section, p_value, saved_at, p_actor)
  on conflict (section) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  return jsonb_build_object('ok', true, 'updatedAt', saved_at);
end;
$$;

revoke all on function public.save_reference_section(text, jsonb, timestamptz, text, text, jsonb, text[], text[], text[], jsonb, text[]) from public, anon, authenticated;
grant execute on function public.save_reference_section(text, jsonb, timestamptz, text, text, jsonb, text[], text[], text[], jsonb, text[]) to service_role;

commit;
