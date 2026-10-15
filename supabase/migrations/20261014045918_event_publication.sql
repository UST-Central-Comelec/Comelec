-- Keep existing events public; Deployment can hide an event without removing its records.
begin;

alter table public.events add column if not exists published boolean not null default true;
comment on column public.events.published is 'Website visibility. Unpublished events remain accessible in the portal.';

commit;
notify pgrst, 'reload schema';
