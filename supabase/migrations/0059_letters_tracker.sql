-- Letters are private to the portal. Server actions enforce tab, editor and college access.
create table if not exists public.secretariat_letters (
  id uuid primary key default gen_random_uuid(),
  control_number text not null check (length(btrim(control_number)) between 1 and 100),
  title text not null check (length(btrim(title)) between 1 and 300),
  type text not null check (type in ('Request Letter', 'Invitation Letter', 'Attestation Letter', 'Excuse Letter', 'Cover Letter', 'Courtesy Letter', 'Partnership Letter', 'Sponsorship Letter', 'Narrative Report')),
  status text not null default 'Draft' check (status in ('Draft', 'For Signing', 'Signed', 'Approved', 'Discarded', 'Rejected')),
  working_document text not null default '',
  college text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null,
  updated_by text not null
);
create unique index if not exists secretariat_letters_control_number on public.secretariat_letters (coalesce(college, ''), lower(btrim(control_number)));
create index if not exists secretariat_letters_college_created on public.secretariat_letters (college, created_at desc);
alter table public.secretariat_letters enable row level security;
notify pgrst, 'reload schema';
