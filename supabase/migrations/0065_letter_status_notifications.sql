-- Apply after 0064 and the portal inbox migrations (0043 and 0045).
-- Inbox delivery shares the status update transaction, so a failed save cannot notify.
begin;

alter table public.secretariat_letters
  add column if not exists notify_status_updates boolean not null default false,
  add column if not exists remark_presets text[] not null default '{}'::text[]
    check (remark_presets <@ array[
      'Print hard copy (Colored) - copy for recipient',
      'Print hard copy (Monochrome) - copy as receiving copy',
      'Signed in Person (Wet Signature)',
      'Send to email'
    ]::text[] and array_position(remark_presets, null) is null);

create or replace function public.notify_letter_status_update()
returns trigger language plpgsql set search_path = public as $$
declare
  recipients text[];
  unit_label text;
begin
  if not NEW.notify_status_updates or NEW.status is not distinct from OLD.status then
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
        || E'\nOpen Secretariat → Letters Tracker to view this letter.',
      'Secretariat', unit_label, recipients,
      case when NEW.college is null then 'central' else 'local' end,
      NEW.college, 'All members of ' || unit_label
    );
  end if;
  return NEW;
end $$;

revoke all on function public.notify_letter_status_update() from public, anon, authenticated;
drop trigger if exists secretariat_letter_status_notification on public.secretariat_letters;
create trigger secretariat_letter_status_notification
after update of status on public.secretariat_letters
for each row execute function public.notify_letter_status_update();

notify pgrst, 'reload schema';
commit;
