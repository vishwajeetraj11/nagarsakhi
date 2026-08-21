create or replace function public.provision_firebase_profile(display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firebase_project_id text := 'nagarsakhi-cbe25';
  v_firebase_uid text := auth.jwt()->>'sub';
  v_firebase_issuer text := auth.jwt()->>'iss';
  v_phone text := coalesce(auth.jwt()->>'phone_number', auth.jwt()->>'phone');
  v_target_municipality_id uuid;
  v_target_ward_id uuid;
  v_profile_id uuid;
begin
  if v_firebase_uid is null or v_firebase_issuer <> ('https://securetoken.google.com/' || v_firebase_project_id) then
    raise exception 'A verified NagarSakhi Firebase token is required';
  end if;

  select p.id into v_profile_id from public.profiles p where p.firebase_uid = v_firebase_uid;
  if v_profile_id is not null then
    return v_profile_id;
  end if;

  select m.id into v_target_municipality_id
  from public.municipalities m
  where m.is_active
  order by m.created_at
  limit 1;

  select w.id into v_target_ward_id
  from public.wards w
  where w.municipality_id = v_target_municipality_id
  order by w.ward_number
  limit 1;

  if v_target_municipality_id is null or v_target_ward_id is null then
    raise exception 'No active municipality and ward are available for provisioning';
  end if;

  insert into public.profiles (
    firebase_uid,
    municipality_id,
    ward_id,
    name,
    username,
    role,
    is_synthetic
  )
  values (
    v_firebase_uid,
    v_target_municipality_id,
    v_target_ward_id,
    coalesce(nullif(trim(display_name), ''), coalesce(v_phone, 'NagarSakhi user')),
    'fb-' || left(regexp_replace(v_firebase_uid, '[^a-zA-Z0-9]+', '-', 'g'), 32),
    'citizen',
    false
  )
  returning id into v_profile_id;

  if v_phone is not null then
    insert into public.citizen_private_profiles (profile_id, phone, house_number)
    values (v_profile_id, v_phone, 'Not provided')
    on conflict (phone) do nothing;
  end if;

  return v_profile_id;
end;
$$;

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
      (old.status = 'requested' and new.status = 'in_progress')
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
begin
  if tg_op = 'INSERT' then
    insert into public.issue_status_events (issue_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.reporter_id);
  elsif new.status is distinct from old.status then
    if v_actor_id is null then
      raise exception 'Issue status changes require an authenticated actor';
    end if;
    insert into public.issue_status_events (issue_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, v_actor_id);
  end if;
  return new;
end;
$$;

create or replace function public.transition_escalation_status(
  target_escalation_id uuid,
  target_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_status text;
  target_municipality_id uuid;
begin
  if public.current_role() <> 'corporation_admin' then
    raise exception 'Only a corporation administrator may transition escalations';
  end if;

  select e.status, i.municipality_id into existing_status, target_municipality_id
  from public.escalations e
  join public.issues i on i.id = e.issue_id
  where e.id = target_escalation_id
  for update of e;

  if existing_status is null or target_municipality_id <> public.current_municipality_id() then
    raise exception 'Escalation is not managed by this corporation';
  end if;

  if not (
    (existing_status = 'open' and target_status = 'acknowledged')
    or (existing_status = 'acknowledged' and target_status = 'resolved')
  ) then
    raise exception 'Invalid escalation status transition';
  end if;

  perform set_config('app.escalation_status_transition', 'allowed', true);
  update public.escalations
  set
    status = target_status,
    resolved_at = case when target_status = 'resolved' then now() else null end
  where id = target_escalation_id;

  insert into public.audit_events (
    municipality_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    target_municipality_id,
    public.current_profile_id(),
    'escalation.status.transitioned',
    'escalation',
    target_escalation_id,
    jsonb_build_object('from_status', existing_status, 'to_status', target_status)
  );

  return target_status;
end;
$$;

create or replace function public.enqueue_ai_job(
  target_issue_id uuid,
  target_job_type public.job_type,
  target_idempotency_key text,
  target_options jsonb default '{}'::jsonb
)
returns public.ai_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  issue_record public.issues;
  existing_job public.ai_jobs;
  derived_input jsonb;
  created_job public.ai_jobs;
  requested_limit int;
begin
  if v_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if target_idempotency_key !~ '^[A-Za-z0-9._:-]{16,160}$' then
    raise exception 'Invalid idempotency key';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai-user:' || v_profile_id::text, 0));

  select * into existing_job
  from public.ai_jobs
  where idempotency_key = target_idempotency_key;

  if existing_job.id is not null then
    if existing_job.created_by <> v_profile_id
      or existing_job.issue_id <> target_issue_id
      or existing_job.job_type <> target_job_type then
      raise exception 'Idempotency key was already used for another request';
    end if;
    return existing_job;
  end if;

  select * into issue_record
  from public.issues
  where id = target_issue_id
    and reporter_id = v_profile_id
    and municipality_id = public.current_municipality_id();

  if issue_record.id is null then
    raise exception 'Only the issue reporter may request AI processing';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai-municipality:' || issue_record.municipality_id::text, 0));

  if (
    select count(*) from public.ai_jobs
    where created_by = v_profile_id
      and created_at >= now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Hourly AI job quota reached';
  end if;

  if (
    select count(*) from public.ai_jobs
    where created_by = v_profile_id
      and status in ('queued', 'processing')
  ) >= 5 then
    raise exception 'Too many active AI jobs';
  end if;

  if (
    select count(*) from public.ai_jobs
    where municipality_id = issue_record.municipality_id
      and created_at >= now() - interval '1 hour'
  ) >= 500 then
    raise exception 'Municipality AI job quota reached';
  end if;

  case target_job_type
    when 'summarization' then
      requested_limit := least(1000, greatest(1, coalesce((target_options ->> 'maxCharacters')::int, 240)));
      derived_input := jsonb_build_object(
        'text', left(issue_record.title || E'\n' || issue_record.description, 5000),
        'language', issue_record.original_language,
        'maxCharacters', requested_limit
      );
    when 'translation' then
      if coalesce(target_options ->> 'targetLanguage', '') !~ '^[A-Za-z0-9-]{2,16}$' then
        raise exception 'Invalid target language';
      end if;
      derived_input := jsonb_build_object(
        'text', left(issue_record.title || E'\n' || issue_record.description, 5000),
        'sourceLanguage', issue_record.original_language,
        'targetLanguage', target_options ->> 'targetLanguage'
      );
    when 'embedding' then
      requested_limit := least(1536, greatest(1, coalesce((target_options ->> 'dimensions')::int, 1536)));
      derived_input := jsonb_build_object(
        'input', left(issue_record.title || E'\n' || issue_record.description, 5000),
        'dimensions', requested_limit
      );
    when 'transcription' then
      if not exists (
        select 1 from public.issue_media media
        where media.issue_id = issue_record.id
          and media.kind = 'audio'
          and media.storage_path = target_options ->> 'audioPath'
      ) then
        raise exception 'Audio does not belong to this issue';
      end if;
      derived_input := jsonb_strip_nulls(jsonb_build_object(
        'audioPath', target_options ->> 'audioPath',
        'filename', target_options ->> 'filename',
        'language', coalesce(target_options ->> 'language', issue_record.original_language)
      ));
  end case;

  insert into public.ai_jobs (
    municipality_id,
    created_by,
    issue_id,
    job_type,
    idempotency_key,
    input
  ) values (
    issue_record.municipality_id,
    v_profile_id,
    issue_record.id,
    target_job_type,
    target_idempotency_key,
    derived_input
  ) returning * into created_job;

  return created_job;
end;
$$;

drop policy if exists notices_create_authorized on public.notices;
create policy notices_create_authorized on public.notices
for insert to anon, authenticated
with check (
  author_id = public.current_profile_id()
  and municipality_id = public.current_municipality_id()
  and (
    (public.current_role() = 'parshad' and ward_id = public.current_ward_id())
    or (public.current_role() = 'corporation_admin' and ward_id is null)
  )
);

drop policy if exists alerts_create_corporation on public.alerts;
create policy alerts_create_corporation on public.alerts
for insert to anon, authenticated
with check (
  public.current_role() = 'corporation_admin'
  and created_by = public.current_profile_id()
  and municipality_id = public.current_municipality_id()
);

drop policy if exists alert_targets_create_corporation on public.alert_ward_targets;
create policy alert_targets_create_corporation on public.alert_ward_targets
for insert to anon, authenticated
with check (
  public.current_role() = 'corporation_admin'
  and exists (
    select 1
    from public.alerts a
    join public.wards w on w.id = ward_id
    where a.id = alert_id
      and a.created_by = public.current_profile_id()
      and not a.targets_all_wards
      and a.municipality_id = public.current_municipality_id()
      and w.municipality_id = a.municipality_id
  )
);

drop policy if exists alert_completions_create_self on public.alert_completions;
create policy alert_completions_create_self on public.alert_completions
for insert to anon, authenticated
with check (profile_id = public.current_profile_id() and public.alert_is_visible(alert_id));

drop policy if exists alert_completions_delete_self on public.alert_completions;
create policy alert_completions_delete_self on public.alert_completions
for delete to anon, authenticated using (profile_id = public.current_profile_id());

drop policy if exists ward_budgets_create_corporation on public.ward_budgets;
create policy ward_budgets_create_corporation on public.ward_budgets
for insert to anon, authenticated
with check (
  public.current_role() = 'corporation_admin'
  and updated_by = public.current_profile_id()
  and exists (select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id())
);

drop policy if exists ward_budgets_update_corporation on public.ward_budgets;
create policy ward_budgets_update_corporation on public.ward_budgets
for update to anon, authenticated
using (
  public.current_role() = 'corporation_admin'
  and exists (select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id())
)
with check (
  public.current_role() = 'corporation_admin'
  and updated_by = public.current_profile_id()
  and exists (select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id())
);

drop policy if exists expenditures_create_corporation on public.expenditures;
create policy expenditures_create_corporation on public.expenditures
for insert to anon, authenticated
with check (
  public.current_role() = 'corporation_admin'
  and created_by = public.current_profile_id()
  and exists (select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id())
);

drop policy if exists escalations_create_parshad on public.escalations;
create policy escalations_create_parshad on public.escalations
for insert to anon, authenticated
with check (
  public.current_role() = 'parshad'
  and escalated_by = public.current_profile_id()
  and status = 'open'
  and resolved_at is null
  and exists (select 1 from public.issues i where i.id = issue_id and i.ward_id = public.current_ward_id())
);

drop policy if exists ai_jobs_read_scoped on public.ai_jobs;
create policy ai_jobs_read_scoped on public.ai_jobs
for select to anon, authenticated
using (
  created_by = public.current_profile_id()
  or (public.current_role() = 'parshad' and exists (
    select 1 from public.issues i where i.id = issue_id and i.ward_id = public.current_ward_id()
  ))
  or (public.current_role() = 'corporation_admin' and municipality_id = public.current_municipality_id())
);

drop policy if exists audit_events_read_corporation on public.audit_events;
create policy audit_events_read_corporation on public.audit_events
for select to anon, authenticated
using (public.current_role() = 'corporation_admin' and municipality_id = public.current_municipality_id());

drop policy if exists issue_media_create_reporter on public.issue_media;
create policy issue_media_create_reporter on public.issue_media
for insert to anon, authenticated
with check (exists (
  select 1 from public.issues i
  where i.id = issue_id
    and i.reporter_id = public.current_profile_id()
    and split_part(storage_path, '/', 1) = public.current_profile_id()::text
    and split_part(storage_path, '/', 2) = issue_id::text
    and split_part(storage_path, '/', 3) in ('photo-1', 'photo-2', 'photo-3', 'audio')
));

drop policy if exists issue_media_objects_read on storage.objects;
create policy issue_media_objects_read on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'issue-media'
  and public.issue_media_object_is_visible(name)
);

drop policy if exists issue_media_objects_create on storage.objects;
create policy issue_media_objects_create on storage.objects
for insert to anon, authenticated
with check (
  bucket_id = 'issue-media'
  and (storage.foldername(name))[1] = public.current_profile_id()::text
  and exists (
    select 1 from public.issues i
    where i.id::text = (storage.foldername(name))[2]
      and i.reporter_id = public.current_profile_id()
  )
  and storage.filename(name) in ('photo-1', 'photo-2', 'photo-3', 'audio')
);

grant execute on function public.enqueue_ai_job(uuid, public.job_type, text, jsonb) to anon, authenticated;
grant execute on function public.transition_issue_status(uuid, public.issue_status, text) to anon, authenticated;
grant execute on function public.transition_escalation_status(uuid, text) to anon, authenticated;
grant execute on function public.match_ward_issues(extensions.halfvec, uuid, float, int) to anon, authenticated;
