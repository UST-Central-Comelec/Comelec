-- UST Central Comelec — an acceptance is an offer the applicant answers. The acceptance email asks
-- them to Join the Commission or Decline. The offer stays open for 14 days from the day that email
-- is sent (the site sets offer_expires_at when it sends it); after that, an offer nobody answered
-- lapses, which counts as declining. Declining, or letting it lapse, frees the position's slot
-- (0009, 0038) and keeps them from applying to that unit again for 60 days, unless the unit
-- accepts them again. Keep OFFER_DAYS and REAPPLY_DAYS in src/lib/applications/offer.ts the same.
-- Run 0004–0038 first. Safe to re-run.

begin;

alter table public.applications add column if not exists offer_expires_at timestamptz;
alter table public.applications add column if not exists offer_response text;
alter table public.applications add column if not exists offer_responded_at timestamptz;
alter table public.applications drop constraint if exists applications_offer_response_check;
alter table public.applications add constraint applications_offer_response_check
  check (offer_response is null or offer_response in ('joined', 'declined', 'lapsed'));

-- Who declined an offer, or let it lapse, and until when they can't apply to that unit again.
-- Only what the wait needs, so it can outlast the application itself (deleted 60 days after it's
-- sent, 0007). college is '' for the Central Comelec.
create table if not exists public.application_holds (
  email text not null check (email = lower(email)),
  preferred_body text not null check (preferred_body in ('central', 'local')),
  college text not null default '',
  reference_code text not null,
  reason text not null check (reason in ('declined', 'lapsed')),
  until timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (email, preferred_body, college)
);
alter table public.application_holds enable row level security;
revoke all on public.application_holds from anon, authenticated;
grant all on public.application_holds to service_role;

-- Accepting (again) opens a new offer: no answer yet, no deadline until the email goes, and no wait.
-- Moving an open offer back to pending or rejected by hand closes it without an answer.
create or replace function public.application_offer_window() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'accepted' then
    new.offer_expires_at := null;
    new.offer_response := null;
    new.offer_responded_at := null;
    delete from public.application_holds hold
    where hold.email = lower(new.email)
      and hold.preferred_body = new.preferred_body
      and hold.college = case when new.preferred_body = 'local' then new.college else '' end;
  elsif old.status = 'accepted' and new.offer_response is not distinct from old.offer_response then
    new.offer_expires_at := null;
  end if;
  return new;
end $$;

drop trigger if exists applications_offer_window on public.applications;
create trigger applications_offer_window
  before update of status on public.applications
  for each row execute function public.application_offer_window();

-- The database's own check of the 60-day wait, for an application that slips past the site's.
create or replace function public.check_application_hold() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from public.application_holds hold
    where hold.email = lower(new.email)
      and hold.preferred_body = new.preferred_body
      and hold.college = case when new.preferred_body = 'local' then new.college else '' end
      and hold.until > now()
  ) then
    raise exception 'application_hold';
  end if;
  return new;
end $$;

drop trigger if exists applications_check_hold on public.applications;
create trigger applications_check_hold
  before insert on public.applications
  for each row execute function public.check_application_hold();

-- Closes the offers whose 14 days are up. Someone who already has an account in that unit joined
-- (through Join the Commission, Onboard or Accounts) and stays accepted; anyone else's offer lapses,
-- which gives the slot back and starts their 60-day wait. Returns how many lapsed.
create or replace function public.lapse_unanswered_offers() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  lapsed integer;
begin
  update public.applications application
  set offer_response = 'joined', offer_responded_at = now()
  where application.status = 'accepted'
    and application.offer_response is null
    and application.offer_expires_at < now()
    and exists (
      select 1 from public.portal_accounts account
      where lower(account.email) = lower(application.email)
        and coalesce(account.affiliation, 'central') = application.preferred_body
        and (application.preferred_body <> 'local' or account.college = application.college)
    );

  with closed as (
    update public.applications application
    set status = 'declined', offer_response = 'lapsed', offer_responded_at = now(),
        status_updated_at = now(), status_updated_by = 'Offer lapsed'
    where application.status = 'accepted'
      and application.offer_response is null
      and application.offer_expires_at < now()
    returning application.email, application.preferred_body, application.college, application.reference_code
  )
  insert into public.application_holds (email, preferred_body, college, reference_code, reason, until)
  select lower(email), preferred_body, case when preferred_body = 'local' then college else '' end, reference_code, 'lapsed', now() + interval '60 days'
  from closed
  on conflict (email, preferred_body, college) do update
    set reference_code = excluded.reference_code, reason = excluded.reason, until = excluded.until, created_at = now();
  get diagnostics lapsed = row_count;

  delete from public.application_holds where until < now();
  return lapsed;
end $$;

revoke all on function public.lapse_unanswered_offers() from public, anon, authenticated;

commit;

-- Every hour, at five past. Scheduling the same name again just updates it.
select cron.schedule('lapse-unanswered-offers', '5 * * * *', 'select public.lapse_unanswered_offers()');

notify pgrst, 'reload schema';
