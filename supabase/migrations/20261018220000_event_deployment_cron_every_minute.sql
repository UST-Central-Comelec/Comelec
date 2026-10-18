-- Check for due deployment changes every minute instead of every 5 seconds, which logged two lines per run all day.
-- A change goes live 1 to 2 minutes after its last edit. Scheduling the same name again just updates it.
select cron.schedule('apply-event-deployments', '* * * * *', 'select public.apply_due_event_deployments()');
