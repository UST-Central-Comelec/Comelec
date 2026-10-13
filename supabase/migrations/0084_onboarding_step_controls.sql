-- Saved onboarding order and visibility. Document history and acceptances are retained.
begin;
-- Also support databases that have not yet created the document table from 0074.
create table if not exists public.onboarding_documents (
  key text not null check (key ~ '^[a-z][a-z0-9-]{1,60}$'),
  version integer not null check (version >= 2),
  title text not null check (length(btrim(title)) between 1 and 120),
  statement text not null check (length(btrim(statement)) between 1 and 300),
  body text not null check (length(btrim(body)) between 1 and 60000),
  saved_at timestamptz not null default now(),
  saved_by text not null,
  primary key (key, version)
);
alter table public.onboarding_documents enable row level security;
revoke all on public.onboarding_documents from anon, authenticated;
grant all on public.onboarding_documents to service_role;

create table if not exists public.onboarding_layout (
  id integer primary key check (id = 1),
  steps jsonb not null check (jsonb_typeof(steps) = 'array'),
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.onboarding_layout (id, steps) values (1, '[{"key": "privacy-notice", "hidden": false, "deleted": false}, {"key": "profile", "hidden": false, "deleted": false}, {"key": "membership-agreement", "hidden": false, "deleted": false}, {"key": "code-of-conduct", "hidden": false, "deleted": false}, {"key": "confidentiality", "hidden": false, "deleted": false}, {"key": "neutrality", "hidden": false, "deleted": false}, {"key": "recusal", "hidden": false, "deleted": false}, {"key": "intellectual-property", "hidden": false, "deleted": false}, {"key": "terms-of-service", "hidden": false, "deleted": false}, {"key": "acceptable-use", "hidden": false, "deleted": false}, {"key": "privacy-policy", "hidden": false, "deleted": false}, {"key": "officer-acceptance", "hidden": false, "deleted": false}]'::jsonb) on conflict (id) do nothing;
alter table public.onboarding_layout enable row level security;
revoke all on public.onboarding_layout from anon, authenticated;
grant all on public.onboarding_layout to service_role;

alter table public.onboarding_documents drop constraint if exists onboarding_documents_key_check;
alter table public.onboarding_documents add constraint onboarding_documents_key_check check (key ~ '^[a-z][a-z0-9-]{1,60}$');

-- Serialize changes to the flow; creation saves the document and step together.
create or replace function public.change_onboarding_step(
  operation text, step_key text, author text, direction integer default 0,
  visible boolean default true, document_text jsonb default null
) returns void language plpgsql set search_path = public as $$
declare
  layout jsonb;
  position integer;
  target integer;
  item jsonb;
begin
  select steps into layout from public.onboarding_layout where id = 1 for update;
  if layout is null then raise exception 'Onboarding settings are missing.'; end if;
  if step_key in ('privacy-notice', 'profile') then raise exception 'Steps 0 and 1 are locked.'; end if;
  select (ordinality - 1)::integer into position from jsonb_array_elements(layout) with ordinality where value->>'key' = step_key;
  if operation = 'add' then
    if position is not null or step_key !~ '^custom-[0-9a-f-]{36}$' then raise exception 'Invalid step key.'; end if;
    insert into public.onboarding_documents (key, version, title, statement, body, saved_by)
      values (step_key, 2, document_text->>'title', document_text->>'statement', document_text->>'body', author);
    layout := layout || jsonb_build_array(jsonb_build_object('key', step_key, 'hidden', false, 'deleted', false));
  else
    if position is null then raise exception 'This step no longer exists.'; end if;
    if operation = 'move' then
      if direction not in (-1, 1) then raise exception 'Invalid direction.'; end if;
      target := position + direction;
      if target < 2 or target >= jsonb_array_length(layout) then raise exception 'Steps 0 and 1 are locked.'; end if;
      item := layout->position;
      layout := jsonb_set(layout, array[position::text], layout->target);
      layout := jsonb_set(layout, array[target::text], item);
    elsif operation = 'visibility' then
      layout := jsonb_set(layout, array[position::text, 'hidden'], to_jsonb(not visible));
    elsif operation = 'delete' then
      layout := layout - position;
    else
      raise exception 'Invalid operation.';
    end if;
  end if;
  update public.onboarding_layout set steps = layout, updated_at = now(), updated_by = author where id = 1;
end;
$$;
revoke all on function public.change_onboarding_step(text, text, text, integer, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.change_onboarding_step(text, text, text, integer, boolean, jsonb) to service_role;
commit;
