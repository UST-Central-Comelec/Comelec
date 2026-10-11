alter table public.secretariat_letters
add column if not exists remarks text not null default '';
notify pgrst, 'reload schema';
