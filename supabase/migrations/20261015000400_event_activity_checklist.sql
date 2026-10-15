-- Venue type and nature of activity, from the UST e-ReSERVe checklist, and the university forms
-- that carry a fixed number. Run after 20261015000300_event_fixed_document_types.sql.
-- The checklist itself lives in src/lib/events/activity-checklist.ts; keep the form codes in step.
begin;
lock table public.events, public.secretariat_letters in access exclusive mode;

alter table public.events
  add column if not exists venue_type text,
  add column if not exists nature_of_activity text;

-- Existing events: online stays online, anything on-site is taken as in-campus until edited.
update public.events set venue_type = case when venue_mode = 'online' then 'online' else 'in-campus' end
  where venue_type is null;

alter table public.events drop constraint if exists events_venue_type_check;
alter table public.events add constraint events_venue_type_check
  check (venue_type is null or venue_type in ('in-campus', 'off-campus-local', 'off-campus-international', 'online'));
alter table public.events drop constraint if exists events_nature_of_activity_check;
alter table public.events add constraint events_nature_of_activity_check
  check (nature_of_activity is null or length(nature_of_activity) between 2 and 120);

-- Each fixed form under its one name. Older names still map to it.
create or replace function public.event_document_form_type(p_type text)
returns text language plpgsql stable set search_path = public as $$
declare item jsonb; name text := lower(btrim(p_type));
begin
  if name in ('project proposal', 'project proposal form', 'project proposal form (ppf)', 'ppf') then
    return 'Project Proposal Form (PPF)';
  elsif name in ('community development project proposal form (simbahayan)', 'community development project proposal form',
    'community development project proposal', 'simbahayan') then
    return 'Community Development Project Proposal Form (Simbahayan)';
  elsif name in ('vehicle reservation form', 'vehicle reservation', 'accomplished vehicle reservation form') then
    return 'Vehicle Reservation Form';
  elsif name in ('budget proposal', 'budget proposal form', 'budget proposal form (bpf)', 'bpf') then return 'Budget Proposal';
  elsif name = 'advocacy project proposal' then return 'Advocacy Project Proposal';
  elsif name = 'service learning project proposal' then return 'Service Learning Project Proposal';
  elsif name = 'student undertaking and parental consent for sports and physical activities' then
    return 'Student Undertaking and Parental Consent for Sports and Physical Activities';
  elsif name = 'accomplished and notarized student undertaking and parental consent' then
    return 'Accomplished and Notarized Student Undertaking and Parental Consent';
  elsif name = 'food approval form' then return 'Food Approval Form';
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

-- The codes printed on each template. The Project Proposal Form is FO120, not FO130.
create or replace function public.event_document_form_number(p_type text)
returns text language sql stable set search_path = public as $$
  select case public.event_document_form_type(p_type)
    when 'Project Proposal Form (PPF)' then 'UST:S030-00-FO120'
    when 'Community Development Project Proposal Form (Simbahayan)' then 'UST:S040-00-FO21'
    when 'Vehicle Reservation Form' then 'UST:S040-00-FO25'
    when 'Budget Proposal' then 'UST:S030-00-FO130'
    when 'Advocacy Project Proposal' then 'UST:S040-00-FO38'
    when 'Service Learning Project Proposal' then 'UST:S040-00-FO47'
    when 'Student Undertaking and Parental Consent for Sports and Physical Activities' then 'UST:S030-00-FO90'
    when 'Accomplished and Notarized Student Undertaking and Parental Consent' then 'UST:S030-00-FO30'
    when 'Food Approval Form' then 'UST:S042-00-FO83' else null end;
$$;

-- Existing event documents of a fixed form take its name and code. An ordinary document that turns
-- out to be a fixed form gives up its counter number (the number stays consumed).
select set_config('secretariat.renaming', 'on', true);
update public.secretariat_letters as letter set
  type = public.event_document_form_type(letter.type),
  control_format = null, control_sequence = null,
  control_number = public.event_document_form_number(letter.type) || ' (SA'
    || lpad(event.activity_sequence::text, greatest(2, length(event.activity_sequence::text)), '0') || ')'
from public.events event where letter.event_id = event.id and public.event_document_form_type(letter.type) is not null;
select set_config('secretariat.renaming', 'off', true);

notify pgrst, 'reload schema';
commit;
