-- UST Central Comelec — the Constitution and the Elections Code, kept in the portal
-- (portal → Publications → Constitution, Elections Code; portal → Apps → Approvals).
--
-- Neither text is edited in place. A change is a revision: written by the Central Comelec's Legal
-- Head, its Secretary to the Adjudicatory, or the Executive Associates of their offices; sent for
-- approval; and signed by the Chairperson, the Vice Chairperson and the Secretary to the Executive.
-- The website shows the latest revision all three have signed. Until there is one, it shows the
-- text as it was signed, which the app carries itself (src/lib/elections-code).
--
-- One row per revision. `articles` is the whole text as proposed, `base_articles` the published
-- text it was started from (what its changes are measured against).
--
-- status: draft (being written; its editors can change it), pending (sent for approval; locked),
-- approved (signed by all three, and published as `version`) or discarded (given up by its editors).
-- A revision sent back for changes is a draft again, with why in `returned`.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0024 first. Safe to re-run.

create table if not exists public.code_revisions (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code in ('constitution', 'elections-code')),
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'discarded')),
  articles jsonb not null,
  base_articles jsonb not null,
  -- The published version it was written against (0: the text as signed), and the one it became.
  base_version integer not null default 0,
  version integer,
  -- What changed and why, in its editors' words, for those who sign.
  summary text not null default '',
  -- How much it changes: {"added": 1, "removed": 0, "edited": 3, "moved": 0, "articles": 0}.
  stats jsonb not null default '{}'::jsonb,
  author_email text not null,
  author_name text not null,
  author_role text not null default '',
  -- Who sent it for approval last: {"name", "email", "role", "at"}.
  submitted jsonb,
  -- Who has signed, by office: {"Chairperson": {"name", "email", "at"}, …}.
  approvals jsonb not null default '{}'::jsonb,
  -- Why it was sent back, until it's sent for approval again: {"note", "name", "role", "at"}.
  returned jsonb,
  -- Its history: [{"at", "action", "name", "role", "note"}, …].
  events jsonb not null default '[]'::jsonb,
  -- How many times it has been saved. A save names the count it read, so two people saving at once can't overwrite each other.
  edits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null,
  -- When it was published or discarded.
  decided_at timestamptz
);

-- One revision at a time for each text: a second can't be started while one is being written or is waiting to be signed.
create unique index if not exists code_revisions_one_open on public.code_revisions (code) where status in ('draft', 'pending');
-- Each published version of a text exists once.
create unique index if not exists code_revisions_versions on public.code_revisions (code, version) where version is not null;
create index if not exists code_revisions_listing on public.code_revisions (code, created_at desc);

-- Read and written only by the server with the secret key.
alter table public.code_revisions enable row level security;

notify pgrst, 'reload schema';
