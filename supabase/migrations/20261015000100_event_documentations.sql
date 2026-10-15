-- Event documents reuse the letters tracker, with every access scoped to its event.
-- Run after 0068_secretariat_settings.sql. Existing Secretariat letters remain unassigned.
alter table public.secretariat_letters
  add column if not exists event_id text references public.events(id) on delete cascade;

create index if not exists secretariat_letters_event_sequence
  on public.secretariat_letters (event_id, control_sequence desc, id);

create or replace function public.notify_letter_status_update()
returns trigger language plpgsql set search_path = public as $$
declare
  recipients text[];
  unit_label text;
begin
  if not NEW.notify_status_updates or NEW.status is not distinct from OLD.status
     or current_setting('secretariat.renaming', true) = 'on' then
    return NEW;
  end if;

  select coalesce(array_agg(id), '{}'::text[]) into recipients
  from public.portal_accounts
  where active and (
    (NEW.college is null and affiliation = 'central')
    or (NEW.college is not null and affiliation = 'local' and college = NEW.college)
  );

  -- The reserved executive identity can exist without a portal_accounts row.
  -- A stored executive profile is already included among Central accounts above.
  if NEW.college is null then
    recipients := array_append(recipients, 'built-in');
    unit_label := 'Central Comelec';
  else
    unit_label := NEW.college || ' Comelec';
  end if;

  if cardinality(recipients) > 0 then
    insert into public.portal_messages (
      kind, title, body, sender_name, audience_label, recipient_ids,
      sender_affiliation, sender_college, recipient_mention
    ) values (
      'activity', NEW.control_number || ' - Status updated to ' || NEW.status,
      NEW.title || E'\nStatus: ' || OLD.status || ' → ' || NEW.status
        || case when NEW.event_id is null then E'\nOpen Secretariat → Letters Tracker to view this letter.'
          else E'\nOpen Events → Documentations to view this document: /portal/events/' || NEW.event_id || '/documentations' end,
      'Secretariat', unit_label, recipients,
      case when NEW.college is null then 'central' else 'local' end,
      NEW.college, 'All members of ' || unit_label
    );
  end if;
  return NEW;
end $$;

notify pgrst, 'reload schema';
