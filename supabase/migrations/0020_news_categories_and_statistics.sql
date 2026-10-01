-- UST Central Comelec — News categories, and the Statistics page.
--
-- 1. News. The News page now carries press releases, announcements and publications. Election
--    Explainers are written in the same place in the portal but have their own page. The two
--    categories retired here move with their posts: Event to Announcement (events have their own
--    page and table since 0019), and Election Watch to Explainer.
-- 2. Statistics. Tables of figures the commission publishes (voters, turnout, candidates and so
--    on), added in the portal (Statistics) by pasting a table from a spreadsheet, and shown on the
--    website's Statistics page grouped by the election or period they belong to.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste this file → Run.
-- Run 0001 first. Safe to re-run.

-- News categories -----------------------------------------------------------

alter table public.news drop constraint if exists news_category_check;

update public.news set category = 'announcement' where category = 'event';
update public.news set category = 'explainer' where category = 'election-watch';

alter table public.news add constraint news_category_check check (category in ('press-release', 'announcement', 'publication', 'explainer'));

-- Statistics ----------------------------------------------------------------

create table if not exists public.statistics (
  id text primary key,
  title text not null,
  -- What the table is grouped under on the page, e.g. '2026 Central Student Council Elections'.
  period text not null,
  -- The day the figures are as of.
  as_of date not null,
  -- One or two sentences on what the table shows.
  summary text not null default '',
  -- The column headings, as a JSON array of text. The first column names each row.
  columns jsonb not null,
  -- The cells, as a JSON array of rows, each an array of text as wide as "columns".
  rows jsonb not null,
  -- The column drawn with bars (0 is the first column, which never is), or null for none.
  bar_column smallint,
  -- Whether a row of totals closes the table.
  show_total boolean not null default false,
  -- Where the figures come from, or how to read them.
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null,
  check (jsonb_typeof(columns) = 'array' and jsonb_array_length(columns) between 2 and 10),
  check (jsonb_typeof(rows) = 'array' and jsonb_array_length(rows) between 1 and 300),
  check (bar_column is null or (bar_column >= 1 and bar_column < jsonb_array_length(columns)))
);

create index if not exists statistics_as_of_idx on public.statistics (as_of desc);

-- Only the server (secret key) reads or writes this table; Row Level Security with no policies
-- blocks the public (publishable/anon) key, as on every other table.
alter table public.statistics enable row level security;

-- Tell the Supabase API about the new table now, instead of waiting for it to notice.
notify pgrst, 'reload schema';
