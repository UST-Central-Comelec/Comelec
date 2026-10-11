-- Legals navigation: migrate saved access keys, preserving explicit grants and denials.
-- Run after 0048 and 0049. Safe to re-run. Existing document/revision rows keep their identities.
begin;

with key_map(old_key, new_key) as (values
  ('apps/approvals', 'documents/approval'),
  ('documents', 'documents/archive'),
  ('codes/constitution', 'charters/constitution'),
  ('codes/elections-code', 'charters/elections-code'),
  ('codes/magna-carta', 'charters/magna-carta'),
  ('petitions/submissions', 'petitions/case-docket')
), migrated as (
  select access.level,
    coalesce(jsonb_object_agg(coalesce(map.new_key, entry.key), entry.value
      -- If both versions exist, the explicit canonical key wins.
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

-- New Guidelines inherits any explicit grant/denial on existing case settings.
update public.portal_access
set overrides = overrides || jsonb_build_object('petitions/guidelines', overrides -> 'petitions/settings')
where overrides ? 'petitions/settings' and not (overrides ? 'petitions/guidelines');

-- No audit timestamp is changed: regrouping isn't a commissioner changing permissions.
commit;
notify pgrst, 'reload schema';
