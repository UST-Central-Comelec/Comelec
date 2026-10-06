-- Delete only the current recipient's copy, preserving every other recipient and the message.
-- The server supplies the authenticated account ID; browser roles cannot call this function.
create or replace function public.delete_inbox_announcement(message_id uuid, recipient_id text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.portal_messages
    set recipient_ids = array_remove(recipient_ids, recipient_id)
    where id = message_id and kind = 'announcement'
      and recipient_ids @> array[recipient_id];
  get diagnostics affected = row_count;
  if affected = 0 then return false; end if;

  delete from public.portal_message_reads r
    where r.message_id = delete_inbox_announcement.message_id
      and r.account_id = recipient_id;
  return true;
end;
$$;
revoke all on function public.delete_inbox_announcement(uuid, text) from public, anon, authenticated;
grant execute on function public.delete_inbox_announcement(uuid, text) to service_role;
notify pgrst, 'reload schema';
