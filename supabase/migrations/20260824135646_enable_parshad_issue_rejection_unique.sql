alter table public.issues
  add column if not exists rejection_reason text;

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
    if (to_jsonb(new) - array['status', 'updated_at', 'rejection_reason'])
      is distinct from (to_jsonb(old) - array['status', 'updated_at', 'rejection_reason']) then
      raise exception 'Parshads may only change issue status and rejection reason';
    end if;

    if new.status = 'rejected' then
      if old.status <> 'requested' then
        raise exception 'Only reported issues may be rejected';
      end if;
      if nullif(trim(new.rejection_reason), '') is null or char_length(trim(new.rejection_reason)) > 500 then
        raise exception 'A rejection reason is required and must be 500 characters or fewer';
      end if;
    elsif new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'A rejection reason is only valid for rejected issues';
    end if;

    if new.status is distinct from old.status and not (
      (old.status = 'requested' and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status = 'completed')
      or (old.status = 'requested' and new.status = 'rejected')
    ) then
      raise exception 'Invalid issue status transition';
    end if;
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
  normalized_note text := nullif(trim(transition_note), '');
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

  if target_status = 'rejected' and (normalized_note is null or char_length(normalized_note) > 500) then
    raise exception 'A rejection reason is required and must be 500 characters or fewer';
  end if;

  if not (
    (existing_status = 'requested' and target_status = 'in_progress')
    or (existing_status = 'in_progress' and target_status = 'completed')
    or (existing_status = 'requested' and target_status = 'rejected')
  ) then
    raise exception 'Invalid issue status transition';
  end if;

  update public.issues
  set
    status = target_status,
    rejection_reason = case when target_status = 'rejected' then normalized_note else null end
  where id = target_issue_id;

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
