-- Presence, chats and Mirror Mode identify a membership rather than its shared sign-in email.
-- Existing presence rows retain their last-seen timestamps and account details.
begin;
alter table public.portal_presence drop constraint portal_presence_pkey;
alter table public.portal_presence add primary key (account_id);
create index if not exists portal_presence_email on public.portal_presence (email);
notify pgrst, 'reload schema';
commit;
