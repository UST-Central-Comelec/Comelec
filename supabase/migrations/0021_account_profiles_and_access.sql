-- UST Central Comelec — fuller portal accounts, the Directory built from them, and who may open what.
--
-- Accounts now carry who the commissioner is, not just an email:
--   last_name, first_name, middle_initial, student_number, program, facebook_url;
--   position:          'executive-board', 'executive-associate' or 'deputy' (their standing in the unit);
--   role:              what they are there, in words: "Chairperson", "Office of the Chairperson",
--                      "Deputy". This column used to hold 'commissioner' or 'executive'; those become
--                      a position (below) and the column is left empty until their role is picked;
--   email_verified_at: when the UST email was proved with Google. Set on approval for accounts that
--                      came through Request access, and on the first sign-in for accounts an
--                      executive added by hand. Null: they haven't signed in yet;
--   photo_url, chamber_role: what the Directory shows besides the above (photo, Primus or Vicar).
--
-- The Directory and the website's "Meet the commission" are now filled in from active accounts
-- with a role. public.members is no longer read; it is left as it is, so nothing is deleted.
--
-- Executives become Central Executive Board and commissioners Executive Associates, which opens the
-- same tabs to them as before. The Executive Board is no longer Central only: a Local Executive
-- Board manages its own college.
--
-- public.portal_access holds what each level may open, where it was changed from the defaults under
-- Accounts → Access Control (the defaults are in src/lib/portal/access.ts).
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0017 first. Safe to re-run.

alter table public.portal_accounts add column if not exists last_name text;
alter table public.portal_accounts add column if not exists first_name text;
alter table public.portal_accounts add column if not exists middle_initial text;
alter table public.portal_accounts add column if not exists student_number text;
alter table public.portal_accounts add column if not exists program text;
alter table public.portal_accounts add column if not exists facebook_url text;
alter table public.portal_accounts add column if not exists position text;
alter table public.portal_accounts add column if not exists email_verified_at timestamptz;
alter table public.portal_accounts add column if not exists photo_url text;
alter table public.portal_accounts add column if not exists chamber_role text;

-- The old role check (0001), and the rule that executives are Central (0017).
alter table public.portal_accounts drop constraint if exists portal_accounts_role_check;
alter table public.portal_accounts drop constraint if exists portal_accounts_affiliation_check;

update public.portal_accounts
set position = case when role = 'executive' then 'executive-board' else 'executive-associate' end
where position is null;

update public.portal_accounts set role = '' where role in ('commissioner', 'executive');

alter table public.portal_accounts alter column position set not null;
alter table public.portal_accounts alter column role set default '';

alter table public.portal_accounts drop constraint if exists portal_accounts_position_check;
alter table public.portal_accounts add constraint portal_accounts_position_check check (position in ('executive-board', 'executive-associate', 'deputy'));

alter table public.portal_accounts add constraint portal_accounts_affiliation_check check (
  affiliation in ('central', 'local')
  and (affiliation = 'central' or college is not null)
);

alter table public.portal_accounts drop constraint if exists portal_accounts_profile_check;
alter table public.portal_accounts add constraint portal_accounts_profile_check check (
  (student_number is null or student_number ~ '^[0-9]{10}$')
  and (middle_initial is null or char_length(middle_initial) <= 1)
  and (chamber_role is null or chamber_role in ('primus', 'vicar'))
);

-- At most one Primus and one Vicar, as public.members had (0012).
create unique index if not exists portal_accounts_chamber_role_idx on public.portal_accounts (chamber_role) where chamber_role is not null;

-- Access requests now say which position and role the requester holds, and may give a Facebook
-- link. `position` keeps holding the role in words; `account_position` is the new one of three.
alter table public.access_requests add column if not exists account_position text;
alter table public.access_requests add column if not exists facebook_url text;

alter table public.access_requests drop constraint if exists access_requests_account_position_check;
alter table public.access_requests add constraint access_requests_account_position_check check (account_position is null or account_position in ('executive-board', 'executive-associate', 'deputy'));

-- Accounts that came through Request access: their details are on the request (kept 60 days), and
-- their email was verified with Google when they sent it.
update public.portal_accounts account
set last_name = coalesce(account.last_name, initcap(request.last_name)),
    first_name = coalesce(account.first_name, initcap(request.first_name)),
    middle_initial = coalesce(account.middle_initial, request.middle_initial),
    student_number = coalesce(account.student_number, request.student_number),
    program = coalesce(account.program, request.program),
    email_verified_at = coalesce(account.email_verified_at, request.decided_at, request.created_at)
from (
  select distinct on (email) * from public.access_requests where status = 'approved' order by email, decided_at desc nulls last
) request
where request.email = account.email;

-- Accounts added by hand whose owner has already signed in with Google: verified since that sign-in.
do $$
begin
  if to_regclass('auth.users') is not null and to_regclass('auth.identities') is not null then
    execute $sql$
      update public.portal_accounts account
      set email_verified_at = signed_in.last_sign_in_at
      from auth.users signed_in
      where lower(signed_in.email) = account.email
        and signed_in.last_sign_in_at is not null
        and account.email_verified_at is null
        and exists (select 1 from auth.identities identity where identity.user_id = signed_in.id and identity.provider = 'google')
    $sql$;
  end if;
end $$;

-- What each level may open, where it differs from the defaults: {"news": false, "logs": true}.
-- The Central Executive Board isn't here: everything is always open to it.
create table if not exists public.portal_access (
  level text primary key check (level in ('local-board', 'central-associate', 'local-associate', 'deputy')),
  overrides jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

-- Read and written only by the server with the secret key.
alter table public.portal_access enable row level security;

-- Tell the Supabase API about the new columns and table now, instead of waiting for it to notice.
notify pgrst, 'reload schema';
