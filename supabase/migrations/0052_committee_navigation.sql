-- Committee navigation: preserve Calendar and Secretariat grants and denials.
-- The other tabs retain their keys and data; only their navigation groups change.
begin;
with key_map(old_key, new_key) as (values
  ('apps/secretariat', 'secretariat/letters-tracker'),
  ('apps/calendar', 'secretariat/calendar')
), migrated as (
  select access.level,
    coalesce(jsonb_object_agg(coalesce(map.new_key, entry.key), entry.value
      order by (map.old_key is null)), '{}'::jsonb) as overrides
  from public.portal_access access
  cross join lateral jsonb_each(access.overrides) entry
  left join key_map map on map.old_key = entry.key
  group by access.level
)
update public.portal_access access
set overrides = migrated.overrides
from migrated
where access.level = migrated.level and access.overrides is distinct from migrated.overrides;

-- Minutes inherits explicitly configured Secretariat access until set independently.
update public.portal_access
set overrides = overrides || jsonb_build_object('secretariat/minutes', overrides -> 'secretariat/letters-tracker')
where overrides ? 'secretariat/letters-tracker' and not (overrides ? 'secretariat/minutes');
commit;
notify pgrst, 'reload schema';
