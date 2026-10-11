-- Apply after 0072_recruitment_onboarding.sql.
-- Acceptance email text returns to the fixed Email Sender format; keep existing
-- body values for rollback, but new settings only save Messenger and extra buttons.
begin;
alter table public.recruitment_onboarding
  alter column body set default 'Acceptance email uses the standard Email Sender format.',
  add column if not exists buttons jsonb not null default '[]'::jsonb
    check (jsonb_typeof(buttons) = 'array' and jsonb_array_length(buttons) <= 10);
commit;
