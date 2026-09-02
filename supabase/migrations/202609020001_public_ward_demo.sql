-- Fixed public Ward 7 showcase boundary. No private profiles, phone numbers,
-- house numbers, resident ids, or media storage paths are returned.
create or replace function public.get_public_ward_demo(target_ward_number integer default 7)
returns jsonb language sql stable security definer set search_path = public
as $$
with municipality as (
  select id, name, district, state from public.municipalities
  where id = 'f0010000-0000-4000-8000-000000801777'::uuid and is_active and not is_synthetic
), wards as (
  select w.id, w.municipality_id, w.ward_number, w.name,
    coalesce(b.allocated_amount, 0) allocated_amount,
    coalesce((select sum(e.amount) from public.expenditures e where e.ward_id = w.id), 0) spent_amount,
    coalesce(b.is_demo, false) budget_is_demo
  from public.wards w join municipality m on m.id = w.municipality_id
  left join public.ward_budgets b on b.ward_id = w.id
), selected_ward as (select id from wards where ward_number = target_ward_number),
officials as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'municipalityId', o.municipality_id, 'wardId', t.ward_id,
    'name', o.name, 'roleLabel', t.role_label, 'department', o.department,
    'wonByVotes', t.won_by_votes, 'termNumber', t.term_number, 'current', t.is_current
  ) order by t.is_current desc, t.ward_id nulls first, o.name), '[]'::jsonb) value
  from public.officials o join public.official_terms t on t.official_id = o.id
  join municipality m on m.id = o.municipality_id
), issues as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'municipalityId', i.municipality_id, 'wardId', i.ward_id,
    'reporterId', 'public', 'reporterName', 'Community resident',
    'title', i.title, 'description', i.description,
    'originalLanguage', case when i.original_language = 'hi' then 'hi' else 'en' end,
    'status', i.status::text,
    'statusHistory', coalesce((select jsonb_agg(jsonb_build_object(
      'status', e.to_status::text, 'actorName', 'Public record', 'note', e.note,
      'supportCountAtChange', e.support_count_at_change, 'createdAt', e.created_at
    ) order by e.created_at) from public.issue_status_events e where e.issue_id = i.id), '[]'::jsonb),
    'rejectionReason', case when i.status::text = 'rejected' then i.rejection_reason else null end,
    'upvotes', i.upvote_count, 'downvotes', i.downvote_count, 'viewerVote', 0,
    'media', '[]'::jsonb, 'createdAt', i.created_at, 'updatedAt', i.updated_at,
    'escalated', exists (select 1 from public.escalations e where e.issue_id = i.id),
    'escalationStatus', (select e.status from public.escalations e where e.issue_id = i.id limit 1)
  ) order by i.created_at desc), '[]'::jsonb) value
  from public.issues i join selected_ward w on w.id = i.ward_id
), notices as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'municipalityId', n.municipality_id, 'wardId', n.ward_id,
    'authorName', 'Municipal office', 'title', coalesce(n.title, 'Municipal notice'),
    'body', n.body, 'createdAt', n.created_at
  ) order by n.created_at desc), '[]'::jsonb) value
  from public.notices n join municipality m on m.id = n.municipality_id
  where n.ward_id is null or n.ward_id = (select id from selected_ward)
), alerts as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'title', a.title, 'description', a.description,
    'dueAt', coalesce(a.due_at, a.created_at),
    'wardIds', case when a.targets_all_wards then
      (select coalesce(jsonb_agg(w.id order by w.ward_number), '[]'::jsonb) from wards w)
      else (select coalesce(jsonb_agg(t.ward_id), '[]'::jsonb) from public.alert_ward_targets t where t.alert_id = a.id and t.ward_id = (select id from selected_ward)) end,
    'completed', false
  ) order by a.created_at desc), '[]'::jsonb) value
  from public.alerts a join municipality m on m.id = a.municipality_id
  where a.targets_all_wards or exists (select 1 from public.alert_ward_targets t where t.alert_id = a.id and t.ward_id = (select id from selected_ward))
), expenditures as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'wardId', e.ward_id, 'amount', e.amount, 'description', e.description,
    'spentAt', e.spent_at, 'isDemo', coalesce(e.is_demo, false)
  ) order by e.spent_at desc, e.created_at desc), '[]'::jsonb) value
  from public.expenditures e join wards w on w.id = e.ward_id
), escalations as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'issueId', e.issue_id, 'issueTitle', i.title, 'wardId', i.ward_id,
    'wardNumber', w.ward_number,
    'parshadName', coalesce((select o.name from public.officials o join public.official_terms t on t.official_id = o.id where t.ward_id = i.ward_id and t.is_current order by t.started_on desc nulls last limit 1), 'Ward office'),
    'reason', e.reason, 'status', e.status, 'createdAt', e.created_at
  ) order by e.created_at desc), '[]'::jsonb) value
  from public.escalations e join public.issues i on i.id = e.issue_id join wards w on w.id = i.ward_id
  where i.ward_id = (select id from selected_ward)
)
select case when target_ward_number = 7 and exists (select 1 from selected_ward) then jsonb_build_object(
  'municipality', jsonb_build_object('id', m.id, 'name', m.name, 'district', m.district, 'state', m.state, 'wardCount', (select count(*) from wards)),
  'wards', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'municipalityId', municipality_id, 'number', ward_number, 'name', name, 'allocatedBudget', allocated_amount, 'spentBudget', spent_amount, 'budgetIsDemo', budget_is_demo) order by ward_number) from wards), '[]'::jsonb),
  'publicProfiles', '[]'::jsonb, 'officials', (select value from officials), 'issues', (select value from issues),
  'notices', (select value from notices), 'alerts', (select value from alerts), 'expenditures', (select value from expenditures), 'escalations', (select value from escalations)
) else null end from municipality m;
$$;

revoke all on function public.get_public_ward_demo(integer) from public;
grant execute on function public.get_public_ward_demo(integer) to anon, authenticated;
