-- Successful acknowledgement and result sends, private to recruitment reviewers.
-- No historical timestamps are inferred for emails sent before logging was introduced.
create table if not exists public.application_email_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  kind text not null check (kind in ('acknowledgement', 'accepted', 'rejected')),
  sent_at timestamptz not null
);

create index if not exists application_email_logs_application_id_sent_at_idx
  on public.application_email_logs(application_id, sent_at);

alter table public.application_email_logs enable row level security;

-- Refresh PostgREST after this and the preceding recruitment schema additions.
notify pgrst, 'reload schema';
