-- Read the next possible number without consuming or reserving it.
create or replace function public.preview_letter_control_number()
returns text language sql volatile set search_path = public as $$
  select 'UST:CC-026-LTR-' || lpad(number::text, greatest(3, length(number::text)), '0')
  from (
    select case when is_called then last_value + 1 else last_value end as number
    from public.secretariat_letter_numbers
  ) as next_number;
$$;
revoke all on function public.preview_letter_control_number() from public, anon, authenticated;
grant execute on function public.preview_letter_control_number() to service_role;
notify pgrst, 'reload schema';
