-- Apply after 0076_trigger_search_path.sql, and before deploying the code that uses it (check-ins
-- write the two new columns). Then, in the Supabase dashboard, turn off Realtime → Settings →
-- "Allow public access", so only these private channels can be joined.
--
-- Who's online and chat run on Realtime channels whose names come from the server. Until now they
-- were public channels: anyone holding a name could join with the publishable key, including
-- someone whose portal access had since been removed. Now they're private, and Realtime asks these
-- policies on every join and every token refresh: the lobby is open to whoever checked in to the
-- portal in the last ten minutes, and an inbox only to the person it belongs to. Check-ins happen
-- only after the server confirms the account's access, so removing someone closes both within
-- minutes. Only the server sends (with the secret key, which isn't subject to these policies).
begin;

alter table public.portal_presence add column if not exists lobby_topic text;
alter table public.portal_presence add column if not exists inbox_topic text;

-- Runs as its owner because signed-in browsers have no access to portal_presence itself.
create or replace function public.portal_realtime_allowed(topic text, extension text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.portal_presence p
    where p.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and p.last_seen_at > now() - interval '10 minutes'
      and ((extension = 'presence' and p.lobby_topic = topic) or (extension = 'broadcast' and p.inbox_topic = topic))
  );
$$;
revoke all on function public.portal_realtime_allowed(text, text) from public, anon;
grant execute on function public.portal_realtime_allowed(text, text) to authenticated;

drop policy if exists "portal members receive their channels" on realtime.messages;
create policy "portal members receive their channels" on realtime.messages
  for select to authenticated
  using (public.portal_realtime_allowed((select realtime.topic()), realtime.messages.extension));

-- Joining the lobby means announcing yourself there; nothing else is sent from a browser.
drop policy if exists "portal members announce themselves in the lobby" on realtime.messages;
create policy "portal members announce themselves in the lobby" on realtime.messages
  for insert to authenticated
  with check (realtime.messages.extension = 'presence' and public.portal_realtime_allowed((select realtime.topic()), 'presence'));

notify pgrst, 'reload schema';
commit;
