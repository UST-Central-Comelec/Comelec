-- Scheduled emails on Vercel: the server only runs while answering a request, so the database calls
-- /api/email/dispatch every minute (Vercel's free plan only runs its own cron jobs once a day).
-- The address and the secret live in Vault. The secret is made here; copy it into Vercel's CRON_SECRET:
--   select decrypted_secret from vault.decrypted_secrets where name = 'email_dispatch_secret';
-- After moving to a custom domain, change the address:
--   select vault.update_secret((select id from vault.secrets where name = 'email_dispatch_url'), 'https://<domain>/api/email/dispatch');
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'email_dispatch_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'email_dispatch_secret', 'CRON_SECRET for /api/email/dispatch');
  end if;
  if not exists (select 1 from vault.secrets where name = 'email_dispatch_url') then
    perform vault.create_secret('https://comelec-comet.vercel.app/api/email/dispatch', 'email_dispatch_url', 'Where the scheduled-email job calls');
  end if;
end $$;

create or replace function public.call_email_dispatch() returns bigint language sql security definer set search_path = '' as $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'email_dispatch_url'),
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_dispatch_secret')),
    timeout_milliseconds := 30000
  )
$$;
revoke all on function public.call_email_dispatch() from public, anon, authenticated;

select cron.schedule('dispatch-scheduled-emails', '* * * * *', 'select public.call_email_dispatch()');
