-- Citizens may remove their own reports only while they are still waiting for review.
-- This keeps the public record immutable once a ward team has started work.
grant delete on public.issues to anon, authenticated;

drop policy if exists issues_delete_own_requested on public.issues;
create policy issues_delete_own_requested on public.issues
for delete to anon, authenticated
using (
  public.current_role() = 'citizen'
  and reporter_id = public.current_profile_id()
  and status = 'requested'
  and municipality_id = public.current_municipality_id()
);

-- Storage objects are removed through the Storage API, never by deleting rows
-- directly from storage.objects. The policy allows the reporter to remove
-- attachments only as part of deleting their own still-requested report.
drop policy if exists issue_media_objects_delete_reporter on storage.objects;
create policy issue_media_objects_delete_reporter on storage.objects
for delete to anon, authenticated
using (
  bucket_id = 'issue-media'
  and exists (
    select 1
    from public.issue_media media
    join public.issues issue on issue.id = media.issue_id
    where media.storage_path = name
      and issue.reporter_id = public.current_profile_id()
      and issue.status = 'requested'
      and issue.municipality_id = public.current_municipality_id()
  )
);
