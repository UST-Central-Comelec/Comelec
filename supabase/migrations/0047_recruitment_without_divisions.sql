-- Interviews are shared by all recruitment positions within each Comelec unit.
-- Preserve historical division labels and bookings; new interview slots have no division.
alter table public.interview_slots alter column division drop not null;
notify pgrst, 'reload schema';
