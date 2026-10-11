-- Existing letters have no destination until one is chosen in their modal.
alter table public.secretariat_letters
add column if not exists destination_office text not null default '';
notify pgrst, 'reload schema';
