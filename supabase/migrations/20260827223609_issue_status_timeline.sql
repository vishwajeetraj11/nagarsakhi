-- Preserve an auditable, citizen-readable lifecycle for every issue.
alter type public.issue_status add value if not exists 'acknowledged' after 'requested';

alter table public.issue_status_events
  add column if not exists actor_role public.app_role,
  add column if not exists support_count_at_change integer
    check (support_count_at_change is null or support_count_at_change >= 0);

-- Existing events predate these snapshots. Fill only facts we can prove.
update public.issue_status_events event
set actor_role = profile.role
from public.profiles profile
where profile.id = event.changed_by
  and event.actor_role is null;

-- Every issue gets a truthful initial Reported event. This deliberately avoids
-- inventing intermediate historical transitions for imported legacy records.
insert into public.issue_status_events (
  issue_id, from_status, to_status, changed_by, actor_role, note,
  support_count_at_change, created_at
)
select
  issue.id, null, 'requested', issue.reporter_id, reporter.role, null,
  null, issue.created_at
from public.issues issue
join public.profiles reporter on reporter.id = issue.reporter_id
where not exists (
  select 1 from public.issue_status_events event where event.issue_id = issue.id
);

create or replace function public.protect_issue_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id
    or new.municipality_id <> old.municipality_id
    or new.ward_id <> old.ward_id
    or new.reporter_id <> old.reporter_id then
    raise exception 'Issue ownership and tenancy fields are immutable';
  end if;

  if public.current_profile_id() is not null and public.current_role() = 'parshad' then
    if (to_jsonb(new) - array['status', 'updated_at'])
      is distinct from (to_jsonb(old) - array['status', 'updated_at']) then
      raise exception 'Parshads may only change issue status';
    end if;

    if new.status is distinct from old.status and not (
      (old.status = 'requested' and new.status = 'acknowledged')
      or (old.status = 'acknowledged' and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status = 'completed')
    ) then
      raise exception 'Invalid issue status transition';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.record_issue_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := public.current_profile_id();
  v_actor_role public.app_role;
begin
  if tg_op = 'INSERT' then
    select role into v_actor_role from public.profiles where id = new.reporter_id;
    insert into public.issue_status_events (issue_id, from_status, to_status, changed_by, actor_role, support_count_at_change)
    values (new.id, null, new.status, new.reporter_id, v_actor_role, null);
  elsif new.status is distinct from old.status then
    if v_actor_id is null then
      raise exception 'Issue status changes require an authenticated actor';
    end if;
    select role into v_actor_role from public.profiles where id = v_actor_id;
    insert into public.issue_status_events (issue_id, from_status, to_status, changed_by, actor_role, support_count_at_change)
    values (new.id, old.status, new.status, v_actor_id, v_actor_role, new.upvote_count);
  end if;
  return new;
end;
$$;

create or replace function public.transition_issue_status(
  target_issue_id uuid,
  target_status public.issue_status,
  transition_note text default null
)
returns public.issue_status
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_status public.issue_status;
  issue_ward_id uuid;
begin
  if public.current_role() <> 'parshad' then
    raise exception 'Only a ward parshad may transition issues';
  end if;

  select i.status, i.ward_id into existing_status, issue_ward_id
  from public.issues i
  where i.id = target_issue_id
    and i.municipality_id = public.current_municipality_id()
  for update;

  if existing_status is null or issue_ward_id <> public.current_ward_id() then
    raise exception 'Issue is not managed by this parshad';
  end if;

  if not (
    (existing_status = 'requested' and target_status = 'acknowledged')
    or (existing_status = 'acknowledged' and target_status = 'in_progress')
    or (existing_status = 'in_progress' and target_status = 'completed')
  ) then
    raise exception 'Invalid issue status transition';
  end if;

  update public.issues set status = target_status where id = target_issue_id;
  update public.issue_status_events
  set note = transition_note
  where id = (
    select event.id from public.issue_status_events event
    where event.issue_id = target_issue_id
    order by event.created_at desc
    limit 1
  );

  return target_status;
end;
$$;
