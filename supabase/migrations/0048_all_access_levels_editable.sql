-- Access Control may save permissions for every role, including Central Executive Board.
alter table public.portal_access drop constraint if exists portal_access_level_check;
alter table public.portal_access add constraint portal_access_level_check check (
  level in ('central-board', 'local-board', 'central-associate', 'local-associate',
    'deputy', 'central-adviser', 'local-adviser', 'admin', 'central-official', 'local-official')
);

notify pgrst, 'reload schema';
