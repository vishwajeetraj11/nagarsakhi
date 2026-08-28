-- Firebase JWTs use the anon Postgres role. Match the municipality-scoped
-- read policy used by issues so citizens can see the status events for
-- records they are already permitted to view.
drop policy if exists issue_status_events_read_municipality on public.issue_status_events;

create policy issue_status_events_read_municipality on public.issue_status_events
for select to anon, authenticated
using (exists (
  select 1
  from public.issues issue
  where issue.id = issue_id
    and issue.municipality_id = public.current_municipality_id()
));
