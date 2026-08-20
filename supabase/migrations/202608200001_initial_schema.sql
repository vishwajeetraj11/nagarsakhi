create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create type public.app_role as enum ('citizen', 'parshad', 'corporation_admin');
create type public.issue_status as enum ('requested', 'in_progress', 'completed');
create type public.job_status as enum ('queued', 'processing', 'completed', 'failed');
create type public.job_type as enum ('transcription', 'translation', 'summarization', 'embedding');

create table public.municipalities (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  district text not null,
  state text not null,
  is_active boolean not null default true,
  is_synthetic boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, district, state)
);

create table public.wards (
  id uuid primary key default extensions.gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  ward_number smallint not null check (ward_number > 0),
  name text not null,
  created_at timestamptz not null default now(),
  unique (municipality_id, ward_number)
);

create table public.officials (
  id uuid primary key default extensions.gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  name text not null,
  role_label text not null,
  department text,
  is_synthetic boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.official_terms (
  id uuid primary key default extensions.gen_random_uuid(),
  official_id uuid not null references public.officials(id) on delete cascade,
  ward_id uuid references public.wards(id) on delete cascade,
  role_label text not null,
  won_by_votes integer check (won_by_votes is null or won_by_votes >= 0),
  started_on date,
  ended_on date,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  municipality_id uuid not null references public.municipalities(id) on delete restrict,
  ward_id uuid references public.wards(id) on delete restrict,
  official_id uuid references public.officials(id) on delete set null,
  name text not null check (char_length(name) between 2 and 100),
  username text not null check (char_length(username) between 2 and 40),
  role public.app_role not null default 'citizen',
  is_synthetic boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (municipality_id, username),
  check ((role = 'corporation_admin' and ward_id is null) or (role <> 'corporation_admin' and ward_id is not null))
);

create table public.citizen_private_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone text not null unique,
  house_number text not null check (char_length(house_number) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.issues (
  id uuid primary key default extensions.gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  ward_id uuid not null references public.wards(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 4 and 140),
  description text not null check (char_length(description) between 8 and 5000),
  original_language text not null default 'hi' check (char_length(original_language) between 2 and 16),
  original_transcript text,
  original_audio_path text,
  summary text,
  embedding extensions.halfvec(1536),
  status public.issue_status not null default 'requested',
  upvote_count integer not null default 0 check (upvote_count >= 0),
  downvote_count integer not null default 0 check (downvote_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index issues_ward_status_votes_idx
  on public.issues (ward_id, status, upvote_count desc, downvote_count asc, created_at desc);

create index issues_embedding_hnsw_idx
  on public.issues using hnsw (embedding extensions.halfvec_cosine_ops)
  where embedding is not null;

create table public.issue_media (
  id uuid primary key default extensions.gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  kind text not null check (kind in ('photo', 'audio')),
  storage_path text not null,
  alt_text text,
  sort_order smallint not null default 0 check (sort_order between 0 and 3),
  created_at timestamptz not null default now(),
  unique (issue_id, storage_path)
);

create table public.issue_votes (
  issue_id uuid not null references public.issues(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (issue_id, voter_id)
);

create table public.issue_status_events (
  id uuid primary key default extensions.gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  from_status public.issue_status,
  to_status public.issue_status not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  note text,
  created_at timestamptz not null default now()
);

create table public.notices (
  id uuid primary key default extensions.gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  ward_id uuid references public.wards(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 2 and 3000),
  created_at timestamptz not null default now()
);

create index notices_scope_created_idx on public.notices (municipality_id, ward_id, created_at desc);

create table public.alerts (
  id uuid primary key default extensions.gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 3 and 3000),
  due_at timestamptz,
  targets_all_wards boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.alert_ward_targets (
  alert_id uuid not null references public.alerts(id) on delete cascade,
  ward_id uuid not null references public.wards(id) on delete cascade,
  primary key (alert_id, ward_id)
);

create table public.alert_completions (
  alert_id uuid not null references public.alerts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (alert_id, profile_id)
);

create table public.ward_budgets (
  ward_id uuid primary key references public.wards(id) on delete cascade,
  allocated_amount numeric(14, 2) not null default 0 check (allocated_amount >= 0),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table public.expenditures (
  id uuid primary key default extensions.gen_random_uuid(),
  ward_id uuid not null references public.wards(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  description text not null check (char_length(description) between 3 and 500),
  spent_at date not null default current_date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index expenditures_ward_date_idx on public.expenditures (ward_id, spent_at desc, created_at desc);

create table public.escalations (
  id uuid primary key default extensions.gen_random_uuid(),
  issue_id uuid not null unique references public.issues(id) on delete cascade,
  escalated_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.issue_translations (
  issue_id uuid not null references public.issues(id) on delete cascade,
  language_code text not null check (char_length(language_code) between 2 and 16),
  translated_title text not null,
  translated_description text not null,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  primary key (issue_id, language_code)
);

create table public.ai_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  issue_id uuid references public.issues(id) on delete cascade,
  job_type public.job_type not null,
  status public.job_status not null default 'queued',
  attempt_count smallint not null default 0 check (attempt_count between 0 and 10),
  idempotency_key text not null unique,
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  provider_request_id text,
  last_error text,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index ai_jobs_ready_idx on public.ai_jobs (status, next_retry_at, created_at)
  where status in ('queued', 'failed');

create table public.audit_events (
  id bigint generated always as identity primary key,
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger citizen_private_profiles_set_updated_at before update on public.citizen_private_profiles
for each row execute function public.set_updated_at();
create trigger issues_set_updated_at before update on public.issues
for each row execute function public.set_updated_at();
create trigger issue_votes_set_updated_at before update on public.issue_votes
for each row execute function public.set_updated_at();
create trigger ai_jobs_set_updated_at before update on public.ai_jobs
for each row execute function public.set_updated_at();

create or replace function public.validate_private_citizen_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.profile_id and p.role = 'citizen'
  ) then
    raise exception 'Private citizen data may only belong to a citizen profile';
  end if;
  return new;
end;
$$;

create trigger citizen_private_profiles_validate_owner
before insert or update on public.citizen_private_profiles
for each row execute function public.validate_private_citizen_profile();

create or replace function public.validate_official_term_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ward_id is not null and not exists (
    select 1
    from public.officials o
    join public.wards w on w.id = new.ward_id
    where o.id = new.official_id and o.municipality_id = w.municipality_id
  ) then
    raise exception 'Official term ward must belong to the official municipality';
  end if;
  return new;
end;
$$;

create trigger official_terms_validate_tenancy
before insert or update on public.official_terms
for each row execute function public.validate_official_term_tenancy();

create or replace function public.validate_profile_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ward_id is not null and not exists (
    select 1 from public.wards w
    where w.id = new.ward_id and w.municipality_id = new.municipality_id
  ) then
    raise exception 'Profile ward must belong to its municipality';
  end if;

  if new.official_id is not null and not exists (
    select 1 from public.officials o
    where o.id = new.official_id and o.municipality_id = new.municipality_id
  ) then
    raise exception 'Profile official must belong to its municipality';
  end if;

  if tg_op = 'UPDATE' and (
    new.role <> old.role
    or new.municipality_id <> old.municipality_id
    or new.ward_id is distinct from old.ward_id
    or new.official_id is distinct from old.official_id
  ) then
    raise exception 'Profile authorization assignments are immutable';
  end if;

  return new;
end;
$$;

create trigger profiles_validate_tenancy
before insert or update on public.profiles
for each row execute function public.validate_profile_tenancy();

create or replace function public.validate_issue_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.wards w
    where w.id = new.ward_id and w.municipality_id = new.municipality_id
  ) then
    raise exception 'Issue ward must belong to its municipality';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = new.reporter_id
      and p.municipality_id = new.municipality_id
      and p.ward_id = new.ward_id
  ) then
    raise exception 'Issue reporter must be a resident of the issue ward';
  end if;

  return new;
end;
$$;

create trigger issues_validate_tenancy
before insert or update on public.issues
for each row execute function public.validate_issue_tenancy();

create or replace function public.validate_notice_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.author_id
      and p.municipality_id = new.municipality_id
  ) then
    raise exception 'Author must belong to the record municipality';
  end if;

  if new.ward_id is not null and not exists (
    select 1 from public.wards w
    where w.id = new.ward_id and w.municipality_id = new.municipality_id
  ) then
    raise exception 'Notice ward must belong to its municipality';
  end if;

  return new;
end;
$$;

create trigger notices_validate_tenancy
before insert or update on public.notices
for each row execute function public.validate_notice_tenancy();

create or replace function public.validate_alert_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.created_by and p.municipality_id = new.municipality_id
  ) then
    raise exception 'Alert author must belong to its municipality';
  end if;

  if new.targets_all_wards and exists (
    select 1 from public.alert_ward_targets awt where awt.alert_id = new.id
  ) then
    raise exception 'All-ward alerts cannot retain explicit ward targets';
  end if;

  return new;
end;
$$;

create trigger alerts_validate_tenancy
before insert or update on public.alerts
for each row execute function public.validate_alert_tenancy();

create or replace function public.validate_alert_target_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.alerts a
    join public.wards w on w.id = new.ward_id
    where a.id = new.alert_id
      and a.municipality_id = w.municipality_id
      and not a.targets_all_wards
  ) then
    raise exception 'Alert target must be a ward in the alert municipality';
  end if;
  return new;
end;
$$;

create trigger alert_targets_validate_tenancy
before insert or update on public.alert_ward_targets
for each row execute function public.validate_alert_target_tenancy();

create or replace function public.validate_alert_completion_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.alerts a
    join public.profiles citizen on citizen.id = new.profile_id
    where a.id = new.alert_id
      and citizen.role = 'citizen'
      and citizen.municipality_id = a.municipality_id
      and (
        a.targets_all_wards
        or exists (
          select 1 from public.alert_ward_targets awt
          where awt.alert_id = a.id and awt.ward_id = citizen.ward_id
        )
      )
  ) then
    raise exception 'Alert completion must belong to a targeted citizen';
  end if;
  return new;
end;
$$;

create trigger alert_completions_validate_tenancy
before insert or update on public.alert_completions
for each row execute function public.validate_alert_completion_tenancy();

create or replace function public.validate_ai_job_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.created_by and p.municipality_id = new.municipality_id
  ) then
    raise exception 'AI job creator must belong to its municipality';
  end if;

  if new.issue_id is not null and not exists (
    select 1 from public.issues i
    where i.id = new.issue_id and i.municipality_id = new.municipality_id
  ) then
    raise exception 'AI job issue must belong to its municipality';
  end if;
  return new;
end;
$$;

create trigger ai_jobs_validate_tenancy
before insert or update on public.ai_jobs
for each row execute function public.validate_ai_job_tenancy();

create or replace function public.validate_vote_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.issues i
    join public.profiles voter on voter.id = new.voter_id
    where i.id = new.issue_id
      and voter.role = 'citizen'
      and voter.municipality_id = i.municipality_id
      and voter.ward_id = i.ward_id
  ) then
    raise exception 'Votes are limited to citizens in the issue ward';
  end if;
  return new;
end;
$$;

create trigger issue_votes_validate_tenancy
before insert or update on public.issue_votes
for each row execute function public.validate_vote_tenancy();

create or replace function public.validate_budget_entry_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.wards w
    join public.profiles actor on actor.id = new.updated_by
    where w.id = new.ward_id
      and actor.role = 'corporation_admin'
      and actor.municipality_id = w.municipality_id
  ) then
    raise exception 'Budget editor must administer the ward municipality';
  end if;
  return new;
end;
$$;

create trigger ward_budgets_validate_tenancy
before insert or update on public.ward_budgets
for each row execute function public.validate_budget_entry_tenancy();

create or replace function public.validate_expenditure_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.wards w
    join public.profiles actor on actor.id = new.created_by
    where w.id = new.ward_id
      and actor.role = 'corporation_admin'
      and actor.municipality_id = w.municipality_id
  ) then
    raise exception 'Expenditure author must administer the ward municipality';
  end if;
  return new;
end;
$$;

create trigger expenditures_validate_tenancy
before insert on public.expenditures
for each row execute function public.validate_expenditure_tenancy();

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

create trigger escalations_validate_tenancy
before insert or update on public.escalations
for each row execute function public.validate_escalation_tenancy();

create or replace function public.protect_escalation_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.escalation_status_transition', true) is distinct from 'allowed' then
    raise exception 'Escalation updates must use transition_escalation_status';
  end if;

  if new.id <> old.id
    or new.issue_id <> old.issue_id
    or new.escalated_by <> old.escalated_by
    or new.reason <> old.reason
    or new.created_at <> old.created_at then
    raise exception 'Escalation history fields are immutable';
  end if;

  if not (
    (old.status = 'open' and new.status = 'acknowledged')
    or (old.status = 'acknowledged' and new.status = 'resolved')
  ) then
    raise exception 'Invalid escalation status transition';
  end if;

  if new.status = 'resolved' and new.resolved_at is null then
    raise exception 'Resolved escalations require a resolution timestamp';
  elsif new.status <> 'resolved' and new.resolved_at is not null then
    raise exception 'Only resolved escalations may have a resolution timestamp';
  end if;

  return new;
end;
$$;

create trigger escalations_protect_update
before update on public.escalations
for each row execute function public.protect_escalation_update();

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

  if auth.uid() is not null and public.current_role() = 'parshad' then
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

create trigger issues_protect_update
before update on public.issues
for each row execute function public.protect_issue_update();

create or replace function public.refresh_issue_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_issue_id uuid := coalesce(new.issue_id, old.issue_id);
begin
  update public.issues
  set
    upvote_count = (select count(*) from public.issue_votes where issue_id = target_issue_id and value = 1),
    downvote_count = (select count(*) from public.issue_votes where issue_id = target_issue_id and value = -1)
  where id = target_issue_id;
  return coalesce(new, old);
end;
$$;

create trigger issue_votes_refresh_counts
after insert or update or delete on public.issue_votes
for each row execute function public.refresh_issue_vote_counts();

create or replace function public.record_issue_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.issue_status_events (issue_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.reporter_id);
  elsif new.status is distinct from old.status then
    if auth.uid() is null then
      raise exception 'Issue status changes require an authenticated actor';
    end if;
    insert into public.issue_status_events (issue_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger issues_record_status_event
after insert or update of status on public.issues
for each row execute function public.record_issue_status_event();

create or replace function public.prevent_expenditure_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Expenditures are append-only';
end;
$$;

create trigger expenditures_append_only
before update or delete on public.expenditures
for each row execute function public.prevent_expenditure_mutation();

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_municipality_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select municipality_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_ward_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ward_id from public.profiles where id = auth.uid();
$$;

create or replace function public.alert_is_visible(candidate_alert_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.alerts a
    join public.profiles viewer on viewer.id = auth.uid()
    where a.id = candidate_alert_id
      and a.municipality_id = viewer.municipality_id
      and (
        viewer.role <> 'citizen'
        or a.targets_all_wards
        or exists (
          select 1 from public.alert_ward_targets awt
          where awt.alert_id = a.id and awt.ward_id = viewer.ward_id
        )
      )
  );
$$;

create or replace function public.issue_media_object_is_visible(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.issue_media media
    join public.issues issue on issue.id = media.issue_id
    join public.profiles viewer on viewer.id = auth.uid()
    where media.storage_path = object_name
      and issue.municipality_id = viewer.municipality_id
  );
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
    (existing_status = 'requested' and target_status = 'in_progress')
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
    auth.uid(),
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
  issue_record public.issues;
  existing_job public.ai_jobs;
  derived_input jsonb;
  created_job public.ai_jobs;
  requested_limit int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_idempotency_key !~ '^[A-Za-z0-9._:-]{16,160}$' then
    raise exception 'Invalid idempotency key';
  end if;

  -- Serialize quota checks per user so parallel requests cannot race the caps.
  perform pg_advisory_xact_lock(hashtextextended('ai-user:' || auth.uid()::text, 0));

  select * into existing_job
  from public.ai_jobs
  where idempotency_key = target_idempotency_key;

  if existing_job.id is not null then
    if existing_job.created_by <> auth.uid()
      or existing_job.issue_id <> target_issue_id
      or existing_job.job_type <> target_job_type then
      raise exception 'Idempotency key was already used for another request';
    end if;
    return existing_job;
  end if;

  select * into issue_record
  from public.issues
  where id = target_issue_id
    and reporter_id = auth.uid()
    and municipality_id = public.current_municipality_id();

  if issue_record.id is null then
    raise exception 'Only the issue reporter may request AI processing';
  end if;

  -- A second, namespaced lock makes the cross-user municipality cap atomic too.
  -- Every call takes the user lock first and this municipality lock second.
  perform pg_advisory_xact_lock(hashtextextended('ai-municipality:' || issue_record.municipality_id::text, 0));

  if (
    select count(*) from public.ai_jobs
    where created_by = auth.uid()
      and created_at >= now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Hourly AI job quota reached';
  end if;

  if (
    select count(*) from public.ai_jobs
    where created_by = auth.uid()
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
    auth.uid(),
    issue_record.id,
    target_job_type,
    target_idempotency_key,
    derived_input
  ) returning * into created_job;

  return created_job;
end;
$$;

revoke all on function public.current_role() from public;
revoke all on function public.current_municipality_id() from public;
revoke all on function public.current_ward_id() from public;
revoke all on function public.alert_is_visible(uuid) from public;
revoke all on function public.issue_media_object_is_visible(text) from public;
revoke all on function public.set_updated_at() from public;
revoke all on function public.validate_private_citizen_profile() from public;
revoke all on function public.validate_official_term_tenancy() from public;
revoke all on function public.validate_profile_tenancy() from public;
revoke all on function public.validate_issue_tenancy() from public;
revoke all on function public.validate_notice_tenancy() from public;
revoke all on function public.validate_alert_tenancy() from public;
revoke all on function public.validate_alert_target_tenancy() from public;
revoke all on function public.validate_alert_completion_tenancy() from public;
revoke all on function public.validate_ai_job_tenancy() from public;
revoke all on function public.validate_vote_tenancy() from public;
revoke all on function public.validate_budget_entry_tenancy() from public;
revoke all on function public.validate_expenditure_tenancy() from public;
revoke all on function public.validate_escalation_tenancy() from public;
revoke all on function public.protect_escalation_update() from public;
revoke all on function public.protect_issue_update() from public;
revoke all on function public.refresh_issue_vote_counts() from public;
revoke all on function public.record_issue_status_event() from public;
revoke all on function public.prevent_expenditure_mutation() from public;
revoke all on function public.transition_issue_status(uuid, public.issue_status, text) from public;
revoke all on function public.transition_escalation_status(uuid, text) from public;
revoke all on function public.enqueue_ai_job(uuid, public.job_type, text, jsonb) from public;
grant execute on function public.current_role() to authenticated;
grant execute on function public.current_municipality_id() to authenticated;
grant execute on function public.current_ward_id() to authenticated;
grant execute on function public.alert_is_visible(uuid) to authenticated;
grant execute on function public.issue_media_object_is_visible(text) to authenticated;
grant execute on function public.transition_issue_status(uuid, public.issue_status, text) to authenticated;
grant execute on function public.transition_escalation_status(uuid, text) to authenticated;
grant execute on function public.enqueue_ai_job(uuid, public.job_type, text, jsonb) to authenticated;

create or replace function public.match_ward_issues(
  query_embedding extensions.halfvec(1536),
  query_ward_id uuid,
  match_threshold float,
  match_count int default 5
)
returns table (id uuid, title text, summary text, similarity float)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    i.id,
    i.title,
    i.summary,
    1 - (i.embedding <=> query_embedding) as similarity
  from public.issues i
  where i.ward_id = query_ward_id
    and i.status <> 'completed'
    and i.embedding is not null
    and 1 - (i.embedding <=> query_embedding) >= match_threshold
  order by i.embedding <=> query_embedding
  limit least(match_count, 10);
$$;

alter table public.municipalities enable row level security;
alter table public.wards enable row level security;
alter table public.officials enable row level security;
alter table public.official_terms enable row level security;
alter table public.profiles enable row level security;
alter table public.citizen_private_profiles enable row level security;
alter table public.issues enable row level security;
alter table public.issue_media enable row level security;
alter table public.issue_votes enable row level security;
alter table public.issue_status_events enable row level security;
alter table public.notices enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_ward_targets enable row level security;
alter table public.alert_completions enable row level security;
alter table public.ward_budgets enable row level security;
alter table public.expenditures enable row level security;
alter table public.escalations enable row level security;
alter table public.issue_translations enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.audit_events enable row level security;

create view public.public_profiles
with (security_invoker = false)
as
select id, name
from public.profiles
where municipality_id = public.current_municipality_id();

revoke all on public.public_profiles from public;
grant select on public.public_profiles to authenticated;

create policy municipalities_read_active on public.municipalities
for select to authenticated
using (id = public.current_municipality_id() and is_active);

create policy wards_read_municipality on public.wards
for select to authenticated
using (municipality_id = public.current_municipality_id());

create policy officials_read_municipality on public.officials
for select to authenticated
using (municipality_id = public.current_municipality_id());

create policy official_terms_read_municipality on public.official_terms
for select to authenticated
using (exists (
  select 1 from public.officials o
  where o.id = official_id and o.municipality_id = public.current_municipality_id()
));

create policy profiles_read_scoped on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or (
    public.current_role() = 'parshad'
    and municipality_id = public.current_municipality_id()
    and ward_id = public.current_ward_id()
  )
  or (
    public.current_role() = 'corporation_admin'
    and municipality_id = public.current_municipality_id()
  )
);

create policy citizen_private_read_scoped on public.citizen_private_profiles
for select to authenticated
using (
  profile_id = auth.uid()
  or (
    public.current_role() = 'parshad'
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.ward_id = public.current_ward_id()
        and p.municipality_id = public.current_municipality_id()
    )
  )
);

create policy citizen_private_update_self on public.citizen_private_profiles
for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy issues_read_municipality on public.issues
for select to authenticated
using (municipality_id = public.current_municipality_id());

create policy issues_create_own_ward on public.issues
for insert to authenticated
with check (
  public.current_role() = 'citizen'
  and reporter_id = auth.uid()
  and ward_id = public.current_ward_id()
  and municipality_id = public.current_municipality_id()
  and status = 'requested'
);

create policy issue_media_read_municipality on public.issue_media
for select to authenticated
using (exists (
  select 1 from public.issues i where i.id = issue_id and i.municipality_id = public.current_municipality_id()
));

create policy issue_media_create_reporter on public.issue_media
for insert to authenticated
with check (exists (
  select 1 from public.issues i
  where i.id = issue_id
    and i.reporter_id = auth.uid()
    and split_part(storage_path, '/', 1) = auth.uid()::text
    and split_part(storage_path, '/', 2) = issue_id::text
    and split_part(storage_path, '/', 3) in ('photo-1', 'photo-2', 'photo-3', 'audio')
));

create policy issue_votes_read_municipality on public.issue_votes
for select to authenticated
using (exists (
  select 1 from public.issues i where i.id = issue_id and i.municipality_id = public.current_municipality_id()
));

create policy issue_votes_create_own_ward on public.issue_votes
for insert to authenticated
with check (
  voter_id = auth.uid()
  and public.current_role() = 'citizen'
  and exists (select 1 from public.issues i where i.id = issue_id and i.ward_id = public.current_ward_id())
);

create policy issue_votes_update_self on public.issue_votes
for update to authenticated
using (voter_id = auth.uid())
with check (
  voter_id = auth.uid()
  and public.current_role() = 'citizen'
  and exists (select 1 from public.issues i where i.id = issue_id and i.ward_id = public.current_ward_id())
);

create policy issue_votes_delete_self on public.issue_votes
for delete to authenticated using (voter_id = auth.uid());

create policy issue_status_events_read_municipality on public.issue_status_events
for select to authenticated
using (exists (
  select 1 from public.issues i where i.id = issue_id and i.municipality_id = public.current_municipality_id()
));

create policy notices_read_municipality on public.notices
for select to authenticated
using (municipality_id = public.current_municipality_id());

create policy notices_create_authorized on public.notices
for insert to authenticated
with check (
  author_id = auth.uid()
  and municipality_id = public.current_municipality_id()
  and (
    (public.current_role() = 'parshad' and ward_id = public.current_ward_id())
    or (public.current_role() = 'corporation_admin' and ward_id is null)
  )
);

create policy alerts_read_targeted on public.alerts
for select to authenticated
using (public.alert_is_visible(id));

create policy alerts_create_corporation on public.alerts
for insert to authenticated
with check (
  public.current_role() = 'corporation_admin'
  and created_by = auth.uid()
  and municipality_id = public.current_municipality_id()
);

create policy alert_targets_read_municipality on public.alert_ward_targets
for select to authenticated
using (public.alert_is_visible(alert_id));

create policy alert_targets_create_corporation on public.alert_ward_targets
for insert to authenticated
with check (
  public.current_role() = 'corporation_admin'
  and exists (
    select 1
    from public.alerts a
    join public.wards w on w.id = ward_id
    where a.id = alert_id
      and a.created_by = auth.uid()
      and not a.targets_all_wards
      and a.municipality_id = public.current_municipality_id()
      and w.municipality_id = a.municipality_id
  )
);

create policy alert_completions_read_scoped on public.alert_completions
for select to authenticated
using (
  (profile_id = auth.uid() and public.alert_is_visible(alert_id))
  or (
    public.current_role() = 'parshad'
    and public.alert_is_visible(alert_id)
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.ward_id = public.current_ward_id()
        and p.municipality_id = public.current_municipality_id()
    )
  )
  or (
    public.current_role() = 'corporation_admin'
    and public.alert_is_visible(alert_id)
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.municipality_id = public.current_municipality_id()
    )
  )
);

create policy alert_completions_create_self on public.alert_completions
for insert to authenticated
with check (profile_id = auth.uid() and public.alert_is_visible(alert_id));

create policy alert_completions_delete_self on public.alert_completions
for delete to authenticated using (profile_id = auth.uid());

create policy ward_budgets_read_municipality on public.ward_budgets
for select to authenticated
using (exists (
  select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id()
));

create policy ward_budgets_create_corporation on public.ward_budgets
for insert to authenticated
with check (
  public.current_role() = 'corporation_admin'
  and updated_by = auth.uid()
  and exists (select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id())
);

create policy ward_budgets_update_corporation on public.ward_budgets
for update to authenticated
using (
  public.current_role() = 'corporation_admin'
  and exists (select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id())
)
with check (
  public.current_role() = 'corporation_admin'
  and updated_by = auth.uid()
  and exists (select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id())
);

create policy expenditures_read_municipality on public.expenditures
for select to authenticated
using (exists (
  select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id()
));

create policy expenditures_create_corporation on public.expenditures
for insert to authenticated
with check (
  public.current_role() = 'corporation_admin'
  and created_by = auth.uid()
  and exists (select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id())
);

create policy escalations_read_municipality on public.escalations
for select to authenticated
using (exists (
  select 1 from public.issues i where i.id = issue_id and i.municipality_id = public.current_municipality_id()
));

create policy escalations_create_parshad on public.escalations
for insert to authenticated
with check (
  public.current_role() = 'parshad'
  and escalated_by = auth.uid()
  and status = 'open'
  and resolved_at is null
  and exists (select 1 from public.issues i where i.id = issue_id and i.ward_id = public.current_ward_id())
);

create policy translations_read_municipality on public.issue_translations
for select to authenticated
using (exists (
  select 1 from public.issues i where i.id = issue_id and i.municipality_id = public.current_municipality_id()
));

create policy ai_jobs_read_scoped on public.ai_jobs
for select to authenticated
using (
  created_by = auth.uid()
  or (public.current_role() = 'parshad' and exists (
    select 1 from public.issues i where i.id = issue_id and i.ward_id = public.current_ward_id()
  ))
  or (public.current_role() = 'corporation_admin' and municipality_id = public.current_municipality_id())
);

create policy audit_events_read_corporation on public.audit_events
for select to authenticated
using (public.current_role() = 'corporation_admin' and municipality_id = public.current_municipality_id());

grant execute on function public.match_ward_issues(extensions.halfvec, uuid, float, int) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'issue-media',
  'issue-media',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav']
)
on conflict (id) do nothing;

create policy issue_media_objects_read on storage.objects
for select to authenticated
using (
  bucket_id = 'issue-media'
  and public.issue_media_object_is_visible(name)
);

create policy issue_media_objects_create on storage.objects
for insert to authenticated
with check (
  bucket_id = 'issue-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.issues i
    where i.id::text = (storage.foldername(name))[2]
      and i.reporter_id = auth.uid()
  )
  and storage.filename(name) in ('photo-1', 'photo-2', 'photo-3', 'audio')
);
