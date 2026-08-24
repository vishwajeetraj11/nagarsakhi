create or replace function public.validate_escalation_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.issues i
    join public.profiles actor on actor.id = new.escalated_by
    where i.id = new.issue_id
      and actor.role = 'parshad'
      and actor.municipality_id = i.municipality_id
      and actor.ward_id = i.ward_id
  ) then
    raise exception 'Only the issue ward parshad may create an escalation';
  end if;

  if tg_op = 'INSERT' and not exists (
    select 1
    from public.issues i
    where i.id = new.issue_id
      and i.status in ('requested', 'in_progress')
  ) then
    raise exception 'Only reported or in-progress issues may be escalated';
  end if;

  if tg_op = 'INSERT' and (new.status <> 'open' or new.resolved_at is not null) then
    raise exception 'Escalations must be created open without a resolution timestamp';
  end if;

  if tg_op = 'UPDATE' and (
    new.issue_id <> old.issue_id or new.escalated_by <> old.escalated_by
  ) then
    raise exception 'Escalation ownership is immutable';
  end if;
  return new;
end;
$$;
