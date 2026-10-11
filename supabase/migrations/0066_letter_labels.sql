alter table public.secretariat_letters
  add column if not exists label text
  check (label in ('Priority', 'Print', 'Follow-up', 'Revise'));
notify pgrst, 'reload schema';
