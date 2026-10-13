-- Private portal surveys. Server actions enforce Secretariat access and college scope.
begin;
create table public.secretariat_surveys (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  title text not null check (length(btrim(title)) between 1 and 300),
  description text not null default '' check (length(description) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  college text,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.secretariat_survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.secretariat_surveys(id) on delete cascade,
  respondent_email text not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  created_at timestamptz not null default now(),
  unique (survey_id, respondent_email)
);
create index secretariat_surveys_college_created on public.secretariat_surveys (college, created_at desc);
create index secretariat_survey_responses_created on public.secretariat_survey_responses (survey_id, created_at desc);
alter table public.secretariat_surveys enable row level security;
alter table public.secretariat_survey_responses enable row level security;
revoke all on public.secretariat_surveys, public.secretariat_survey_responses from anon, authenticated;
grant all on public.secretariat_surveys, public.secretariat_survey_responses to service_role;
grant usage, select on sequence public.secretariat_surveys_number_seq to service_role;

-- Lock the survey for both editing and submission: closing or editing cannot race an answer.
create function public.save_secretariat_survey(p_id uuid, p_value jsonb, p_expected timestamptz, p_actor text, p_local boolean, p_college text)
returns jsonb language plpgsql set search_path = public as $$
declare item public.secretariat_surveys;
begin
  if p_local and p_college is null then raise exception 'Your account needs a college.'; end if;
  if p_id is null then
    insert into public.secretariat_surveys (title, description, status, definition, created_by, updated_by, college)
    values (p_value->>'title', p_value->>'description', p_value->>'status', p_value->'definition', p_actor, p_actor, case when p_local then p_college else null end) returning * into item;
  else
    select * into item from public.secretariat_surveys where id = p_id and (not p_local or college = p_college) for update;
    if not found then return jsonb_build_object('error', 'This survey is unavailable.'); end if;
    if item.updated_at is distinct from p_expected then return jsonb_build_object('conflict', true); end if;
    if item.definition is distinct from p_value->'definition' and exists(select 1 from public.secretariat_survey_responses where survey_id = p_id) then
      return jsonb_build_object('error', 'This survey has responses. Create a new survey to change its questions.');
    end if;
    update public.secretariat_surveys set title = p_value->>'title', description = p_value->>'description', status = p_value->>'status', definition = p_value->'definition', updated_at = clock_timestamp(), updated_by = p_actor where id = p_id returning * into item;
  end if;
  return jsonb_build_object('id', item.id);
end $$;

create function public.submit_secretariat_survey(p_id uuid, p_answers jsonb, p_expected timestamptz, p_actor text, p_local boolean, p_college text)
returns jsonb language plpgsql set search_path = public as $$
declare item public.secretariat_surveys;
begin
  select * into item from public.secretariat_surveys where id = p_id and (not p_local or college = p_college) for update;
  if not found or item.status <> 'open' then return jsonb_build_object('error', 'This survey is closed or unavailable.'); end if;
  if item.updated_at is distinct from p_expected then return jsonb_build_object('error', 'This survey changed. Reload before answering.'); end if;
  insert into public.secretariat_survey_responses (survey_id, respondent_email, answers, definition)
  values (p_id, lower(p_actor), p_answers, item.definition) on conflict (survey_id, respondent_email) do nothing;
  if not found then return jsonb_build_object('error', 'You have already answered this survey.'); end if;
  return jsonb_build_object('success', true);
end $$;
revoke all on function public.save_secretariat_survey(uuid, jsonb, timestamptz, text, boolean, text), public.submit_secretariat_survey(uuid, jsonb, timestamptz, text, boolean, text) from public, anon, authenticated;
grant execute on function public.save_secretariat_survey(uuid, jsonb, timestamptz, text, boolean, text), public.submit_secretariat_survey(uuid, jsonb, timestamptz, text, boolean, text) to service_role;
notify pgrst, 'reload schema';
commit;
