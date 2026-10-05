-- UST Central Comelec — official accounts, and the people who only read the portal.
--
--   kind: 'personal' (a commissioner's, adviser's or admin's own account) or 'official' (a unit's
--         shared mailbox, like comelec.sci@ust.edu.ph: no name parts, student ID, role or program).
--         An official account opens what its unit's Executive Board does; a Local unit's also gets
--         the Email Sender.
--   position: two more, 'adviser' and 'admin'. They open their tabs to read them, and change
--         nothing. Neither has a role, a program or a student ID.
--   affiliation: one more, 'osa' (Office for Student Affairs), whose accounts are Admins.
--
-- Names are now kept in capitals, so the ones already saved are put in capitals.
--
-- The official accounts are added here, each to its unit, so they can sign in. An email that
-- already has an account is left exactly as it is; change its category under Accounts if needed.
-- comelec@ust.edu.ph is the Central Comelec's; if it's also PORTAL_EXECUTIVE_EMAIL it keeps the
-- built-in executive's full access.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0021 first. Safe to re-run.

alter table public.portal_accounts add column if not exists kind text not null default 'personal';

alter table public.portal_accounts drop constraint if exists portal_accounts_kind_check;
alter table public.portal_accounts add constraint portal_accounts_kind_check check (kind in ('personal', 'official'));

alter table public.portal_accounts drop constraint if exists portal_accounts_position_check;
alter table public.portal_accounts add constraint portal_accounts_position_check check (position in ('executive-board', 'executive-associate', 'deputy', 'adviser', 'admin'));

alter table public.portal_accounts drop constraint if exists portal_accounts_affiliation_check;
alter table public.portal_accounts add constraint portal_accounts_affiliation_check check (
  affiliation in ('central', 'local', 'osa')
  and (affiliation <> 'local' or college is not null)
  -- The Office for Student Affairs' accounts are Admins, and only they are.
  and ((affiliation = 'osa') = (position = 'admin'))
);

update public.portal_accounts
set name = upper(name), last_name = upper(last_name), first_name = upper(first_name), middle_initial = upper(middle_initial)
where name <> upper(name) or last_name <> upper(last_name) or first_name <> upper(first_name) or middle_initial <> upper(middle_initial);

-- The levels that can now be set under Accounts → Access Control.
alter table public.portal_access drop constraint if exists portal_access_level_check;
alter table public.portal_access add constraint portal_access_level_check check (
  level in ('local-board', 'central-associate', 'local-associate', 'deputy', 'central-adviser', 'local-adviser', 'admin', 'central-official', 'local-official')
);

-- The official accounts. Each stands as its unit's Executive Board, and is verified the first time
-- it signs in with Google.
insert into public.portal_accounts (id, kind, name, email, role, position, affiliation, college, active, created_at, updated_at, updated_by)
select 'official-' || replace(split_part(unit.email, '@', 1), '.', '-'), 'official',
       upper(case when unit.college is null then 'Central Comelec' else unit.college || ' Comelec' end),
       unit.email, '', 'executive-board', case when unit.college is null then 'central' else 'local' end, unit.college, true, now(), now(), 'system'
from (values
  ('comelec@ust.edu.ph', null),
  ('comelec.acct@ust.edu.ph', 'Alfredo M. Velayo College of Accountancy'),
  ('comelec.archi@ust.edu.ph', 'College of Architecture'),
  ('comelec.ab@ust.edu.ph', 'Faculty of Arts and Letters'),
  ('comelec.law@ust.edu.ph', 'Faculty of Civil Law'),
  ('comelec.comm@ust.edu.ph', 'College of Commerce and Business Administration'),
  ('educ.comelec@ust.edu.ph', 'College of Education'),
  ('comelec.eng@ust.edu.ph', 'Faculty of Engineering'),
  ('comelec.cfad@ust.edu.ph', 'College of Fine Arts and Design'),
  ('comelec.cics@ust.edu.ph', 'College of Information and Computing Sciences'),
  ('comelec.nur@ust.edu.ph', 'College of Nursing'),
  ('comelec.pharma@ust.edu.ph', 'Faculty of Pharmacy'),
  ('comelec.crs@ust.edu.ph', 'College of Rehabilitation Sciences'),
  ('comelec.sci@ust.edu.ph', 'College of Science'),
  ('comelec.cthm@ust.edu.ph', 'College of Tourism and Hospitality Management'),
  ('comelec.shs@ust.edu.ph', 'Senior High School'),
  ('comelec.jhs@ust.edu.ph', 'Junior High School')
) as unit (email, college)
on conflict do nothing;

-- Tell the Supabase API about the new column now, instead of waiting for it to notice.
notify pgrst, 'reload schema';
