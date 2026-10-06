-- Run after 0043. Existing queued messages retain email-only delivery.
alter table public.portal_emails add column if not exists send_to_email boolean not null default true;
alter table public.portal_emails add column if not exists send_to_inbox boolean not null default false;
notify pgrst, 'reload schema';
