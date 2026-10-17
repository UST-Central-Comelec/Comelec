-- Persist deployment edits immediately; a database job applies them after the grace period.
begin;
create table public.event_deployment_changes (
  event_id text primary key references public.events(id) on delete cascade,
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  version uuid not null default gen_random_uuid(),
  client_id uuid not null,
  revision bigint not null check (revision > 0),
  apply_at timestamptz not null,
  retry_at timestamptz not null,
  applied_at timestamptz,
  error text,
  updated_by text not null
);
alter table public.event_deployment_changes enable row level security;
revoke all on public.event_deployment_changes from public, anon, authenticated;
grant select, insert, update, delete on public.event_deployment_changes to service_role;
create index event_deployment_due on public.event_deployment_changes(retry_at) where applied_at is null;

create function public.queue_event_deployment(p_event_id text, p_values jsonb, p_author text, p_client_id uuid, p_revision bigint)
returns public.event_deployment_changes language plpgsql security invoker set search_path = '' as $$
declare current_change public.event_deployment_changes; deadline timestamptz;
begin
  -- Queueing, cancelling and applying always lock the event before its pending change.
  perform 1 from public.events where id = p_event_id for update;
  if not found then raise exception 'event_missing'; end if;
  select * into current_change from public.event_deployment_changes where event_id = p_event_id for update;
  -- Keep the last revision after application too, so a late request cannot resurrect old edits.
  if found and current_change.client_id = p_client_id and current_change.revision >= p_revision then return current_change; end if;
  deadline := clock_timestamp() + interval '60 seconds';
  insert into public.event_deployment_changes(event_id, settings, client_id, revision, apply_at, retry_at, updated_by)
  values(p_event_id, p_values, p_client_id, p_revision, deadline, deadline, p_author)
  on conflict(event_id) do update set settings = excluded.settings, version = gen_random_uuid(),
    client_id = excluded.client_id, revision = excluded.revision, apply_at = excluded.apply_at,
    retry_at = excluded.retry_at, applied_at = null, error = null, updated_by = excluded.updated_by
  returning * into current_change;
  return current_change;
end $$;

create function public.cancel_event_deployment(p_event_id text, p_version uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.events where id = p_event_id for update;
  update public.event_deployment_changes set applied_at = clock_timestamp()
    where event_id = p_event_id and version = p_version and applied_at is null and apply_at > clock_timestamp();
  return found;
end $$;

create function public.apply_due_event_deployments()
returns integer language plpgsql security invoker set search_path = '' as $$
declare candidate record; change public.event_deployment_changes; applied integer := 0;
begin
  for candidate in select event_id from public.event_deployment_changes
    where applied_at is null and retry_at <= clock_timestamp() order by retry_at limit 100
  loop
    perform 1 from public.events where id = candidate.event_id for update skip locked;
    if not found then continue; end if;
    select * into change from public.event_deployment_changes
      where event_id = candidate.event_id and applied_at is null and retry_at <= clock_timestamp() for update;
    if not found then continue; end if;
    begin
      update public.events set published = (change.settings->>'published')::boolean,
        registration_status = change.settings->>'registrationStatus',
        minimum_registrants = (change.settings->>'minimumRegistrants')::integer,
        maximum_registrants = nullif(change.settings->>'maximumRegistrants', '')::integer,
        require_google = (change.settings->>'requireGoogle')::boolean,
        updated_at = clock_timestamp(), updated_by = change.updated_by
        where id = change.event_id;
      insert into public.event_rsvp_forms(event_id, enabled, require_google)
        values(change.event_id, (change.settings->>'rsvpEnabled')::boolean, (change.settings->>'rsvpGoogle')::boolean)
        on conflict(event_id) do update set enabled = excluded.enabled, require_google = excluded.require_google, updated_at = clock_timestamp();
      -- Only seed questionnaire content for a missing form. Never overwrite content edited during the grace period.
      insert into public.event_evaluation_forms(event_id, enabled, require_google, allow_anonymous, questions, steps)
        values(change.event_id, (change.settings->>'evaluationEnabled')::boolean, (change.settings->>'evaluationGoogle')::boolean,
          (change.settings->>'allowAnonymous')::boolean, change.settings->'evaluationQuestions', nullif(change.settings->'evaluationSteps', 'null'::jsonb))
        on conflict(event_id) do update set enabled = excluded.enabled, require_google = excluded.require_google,
          allow_anonymous = excluded.allow_anonymous, updated_at = clock_timestamp();
      update public.event_deployment_changes set applied_at = clock_timestamp(), error = null where event_id = change.event_id;
      applied := applied + 1;
    exception when others then
      -- A failed group rolls back all three settings updates, then retries independently.
      update public.event_deployment_changes set error = sqlerrm, retry_at = clock_timestamp() + interval '30 seconds' where event_id = change.event_id;
    end;
  end loop;
  return applied;
end $$;

revoke all on function public.queue_event_deployment(text,jsonb,text,uuid,bigint) from public, anon, authenticated;
revoke all on function public.cancel_event_deployment(text,uuid) from public, anon, authenticated;
revoke all on function public.apply_due_event_deployments() from public, anon, authenticated;
grant execute on function public.queue_event_deployment(text,jsonb,text,uuid,bigint) to service_role;
grant execute on function public.cancel_event_deployment(text,uuid) to service_role;
grant execute on function public.apply_due_event_deployments() to service_role;
commit;

-- Existing project migrations already enable pg_cron.
select cron.schedule('apply-event-deployments', '5 seconds', 'select public.apply_due_event_deployments()');
select cron.schedule('clean-event-deployment-job-history', '15 18 * * *',
  $$delete from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'apply-event-deployments') and end_time < now() - interval '7 days'$$);
notify pgrst, 'reload schema';
