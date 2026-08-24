drop policy if exists issue_votes_create_own_ward on public.issue_votes;
create policy issue_votes_create_own_ward on public.issue_votes
for insert to anon, authenticated
with check (
  voter_id = public.current_profile_id()
  and public.current_role() = 'citizen'
  and exists (
    select 1
    from public.issues i
    where i.id = issue_id
      and i.ward_id = public.current_ward_id()
      and i.reporter_id <> public.current_profile_id()
  )
);

drop policy if exists issue_votes_update_self on public.issue_votes;
create policy issue_votes_update_self on public.issue_votes
for update to anon, authenticated
using (voter_id = public.current_profile_id())
with check (
  voter_id = public.current_profile_id()
  and public.current_role() = 'citizen'
  and exists (
    select 1
    from public.issues i
    where i.id = issue_id
      and i.ward_id = public.current_ward_id()
      and i.reporter_id <> public.current_profile_id()
  )
);
