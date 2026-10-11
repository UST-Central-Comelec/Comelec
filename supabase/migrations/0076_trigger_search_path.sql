-- Pin the search path of the two application triggers, so a schema someone creates earlier in the
-- path can't stand in for the tables they read (Supabase security advisor: "Function Search Path
-- Mutable"). Their bodies name tables without a schema, so the path stays public.
begin;

alter function public.check_application_period() set search_path = public, pg_temp;
alter function public.check_interview_slot_capacity() set search_path = public, pg_temp;

commit;
