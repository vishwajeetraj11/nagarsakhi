-- Issue records are public civic history once reported. Citizens cannot
-- remove them, including their own reports.
revoke delete on public.issues from anon, authenticated;

drop policy if exists issues_delete_own_requested on public.issues;
drop policy if exists issues_delete_own on public.issues;

drop policy if exists issue_media_objects_delete_reporter on storage.objects;
