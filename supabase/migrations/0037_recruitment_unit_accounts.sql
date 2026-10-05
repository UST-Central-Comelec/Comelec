-- A commissioner can hold different positions in Central and their Local unit.
-- Keep duplicate protection within each unit, including revoked accounts.
begin;
alter table public.portal_accounts drop constraint if exists portal_accounts_email_key;
create unique index portal_accounts_email_unit_idx
  on public.portal_accounts (lower(email), coalesce(affiliation, 'central'), (case when affiliation = 'local' then coalesce(college, '') else '' end));

-- Applications to Central and Local are independent within an election year.
alter table public.applications drop constraint if exists applications_email_cycle_key;
create unique index applications_email_cycle_unit_idx
  on public.applications (lower(email), cycle, preferred_body, (case when preferred_body = 'local' then college else '' end));

create or replace function public.check_application_commission_account() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from public.portal_accounts account
    where lower(account.email) = lower(new.email)
      and coalesce(account.affiliation, 'central') = new.preferred_body
      and (new.preferred_body <> 'local' or account.college = new.college)
  ) then
    raise exception 'commission_account_exists';
  end if;
  return new;
end $$;
create trigger applications_check_commission_account
  before insert on public.applications
  for each row execute function public.check_application_commission_account();
commit;
notify pgrst, 'reload schema';
