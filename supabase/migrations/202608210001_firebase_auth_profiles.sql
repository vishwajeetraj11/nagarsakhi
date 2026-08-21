alter table public.profiles
  alter column id set default extensions.gen_random_uuid();

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add column if not exists firebase_uid text;

create unique index if not exists profiles_firebase_uid_key
  on public.profiles (firebase_uid)
  where firebase_uid is not null;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.firebase_uid = auth.jwt()->>'sub'
    or p.id::text = auth.jwt()->>'sub'
  limit 1;
$$;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = public.current_profile_id();
$$;

create or replace function public.current_municipality_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select municipality_id from public.profiles where id = public.current_profile_id();
$$;

create or replace function public.current_ward_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ward_id from public.profiles where id = public.current_profile_id();
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
    join public.profiles viewer on viewer.id = public.current_profile_id()
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
    join public.profiles viewer on viewer.id = public.current_profile_id()
    where media.storage_path = object_name
      and issue.municipality_id = viewer.municipality_id
  );
$$;

create or replace function public.provision_firebase_profile(display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  firebase_project_id text := 'nagarsakhi-cbe25';
  firebase_uid text := auth.jwt()->>'sub';
  firebase_issuer text := auth.jwt()->>'iss';
  phone text := coalesce(auth.jwt()->>'phone_number', auth.jwt()->>'phone');
  target_municipality_id uuid;
  target_ward_id uuid;
  profile_id uuid;
begin
  if firebase_uid is null or firebase_issuer <> ('https://securetoken.google.com/' || firebase_project_id) then
    raise exception 'A verified NagarSakhi Firebase token is required';
  end if;

  select p.id into profile_id from public.profiles p where p.firebase_uid = firebase_uid;
  if profile_id is not null then
    return profile_id;
  end if;

  select m.id into target_municipality_id
  from public.municipalities m
  where m.is_active
  order by m.created_at
  limit 1;

  select w.id into target_ward_id
  from public.wards w
  where w.municipality_id = target_municipality_id
  order by w.ward_number
  limit 1;

  if target_municipality_id is null or target_ward_id is null then
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
    firebase_uid,
    target_municipality_id,
    target_ward_id,
    coalesce(nullif(trim(display_name), ''), coalesce(phone, 'NagarSakhi user')),
    'fb-' || left(regexp_replace(firebase_uid, '[^a-zA-Z0-9]+', '-', 'g'), 32),
    'citizen',
    false
  )
  returning id into profile_id;

  if phone is not null then
    insert into public.citizen_private_profiles (profile_id, phone, house_number)
    values (profile_id, phone, 'Not provided')
    on conflict (phone) do nothing;
  end if;

  return profile_id;
end;
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.provision_firebase_profile(text) from public;
grant execute on function public.current_profile_id() to anon, authenticated;
grant execute on function public.current_role() to anon, authenticated;
grant execute on function public.current_municipality_id() to anon, authenticated;
grant execute on function public.current_ward_id() to anon, authenticated;
grant execute on function public.alert_is_visible(uuid) to anon, authenticated;
grant execute on function public.issue_media_object_is_visible(text) to anon, authenticated;
grant execute on function public.provision_firebase_profile(text) to anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

drop policy if exists municipalities_read_current on public.municipalities;
create policy municipalities_read_current on public.municipalities
for select to anon, authenticated
using (id = public.current_municipality_id() and is_active);

drop policy if exists wards_read_municipality on public.wards;
create policy wards_read_municipality on public.wards
for select to anon, authenticated
using (municipality_id = public.current_municipality_id());

drop policy if exists officials_read_municipality on public.officials;
create policy officials_read_municipality on public.officials
for select to anon, authenticated
using (municipality_id = public.current_municipality_id());

drop policy if exists official_terms_read_municipality on public.official_terms;
create policy official_terms_read_municipality on public.official_terms
for select to anon, authenticated
using (exists (
  select 1 from public.officials o
  where o.id = official_id and o.municipality_id = public.current_municipality_id()
));

drop policy if exists profiles_read_scoped on public.profiles;
create policy profiles_read_scoped on public.profiles
for select to anon, authenticated
using (
  id = public.current_profile_id()
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

drop policy if exists citizen_private_read_scoped on public.citizen_private_profiles;
create policy citizen_private_read_scoped on public.citizen_private_profiles
for select to anon, authenticated
using (
  profile_id = public.current_profile_id()
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

drop policy if exists citizen_private_update_self on public.citizen_private_profiles;
create policy citizen_private_update_self on public.citizen_private_profiles
for update to anon, authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

drop policy if exists issues_create_own_ward on public.issues;
create policy issues_create_own_ward on public.issues
for insert to anon, authenticated
with check (
  public.current_role() = 'citizen'
  and reporter_id = public.current_profile_id()
  and ward_id = public.current_ward_id()
  and municipality_id = public.current_municipality_id()
  and status = 'requested'
);

drop policy if exists issue_votes_create_own_ward on public.issue_votes;
create policy issue_votes_create_own_ward on public.issue_votes
for insert to anon, authenticated
with check (
  voter_id = public.current_profile_id()
  and public.current_role() = 'citizen'
  and exists (select 1 from public.issues i where i.id = issue_id and i.ward_id = public.current_ward_id())
);

drop policy if exists issue_votes_update_self on public.issue_votes;
create policy issue_votes_update_self on public.issue_votes
for update to anon, authenticated
using (voter_id = public.current_profile_id())
with check (
  voter_id = public.current_profile_id()
  and public.current_role() = 'citizen'
  and exists (select 1 from public.issues i where i.id = issue_id and i.ward_id = public.current_ward_id())
);

drop policy if exists issue_votes_delete_self on public.issue_votes;
create policy issue_votes_delete_self on public.issue_votes
for delete to anon, authenticated
using (voter_id = public.current_profile_id());

drop policy if exists issues_read_municipality on public.issues;
create policy issues_read_municipality on public.issues
for select to anon, authenticated
using (municipality_id = public.current_municipality_id());

drop policy if exists issue_media_read_municipality on public.issue_media;
create policy issue_media_read_municipality on public.issue_media
for select to anon, authenticated
using (exists (
  select 1 from public.issues i where i.id = issue_id and i.municipality_id = public.current_municipality_id()
));

drop policy if exists issue_votes_read_municipality on public.issue_votes;
create policy issue_votes_read_municipality on public.issue_votes
for select to anon, authenticated
using (exists (
  select 1 from public.issues i where i.id = issue_id and i.municipality_id = public.current_municipality_id()
));

drop policy if exists notices_read_municipality on public.notices;
create policy notices_read_municipality on public.notices
for select to anon, authenticated
using (municipality_id = public.current_municipality_id());

drop policy if exists alerts_read_visible on public.alerts;
create policy alerts_read_visible on public.alerts
for select to anon, authenticated
using (public.alert_is_visible(id));

drop policy if exists alert_targets_read_municipality on public.alert_ward_targets;
create policy alert_targets_read_municipality on public.alert_ward_targets
for select to anon, authenticated
using (exists (
  select 1
  from public.alerts a
  where a.id = alert_id and a.municipality_id = public.current_municipality_id()
));

drop policy if exists alert_completions_read_scoped on public.alert_completions;
create policy alert_completions_read_scoped on public.alert_completions
for select to anon, authenticated
using (
  (profile_id = public.current_profile_id() and public.alert_is_visible(alert_id))
  or (
    public.current_role() = 'parshad'
    and exists (
      select 1
      from public.profiles p
      where p.id = profile_id
        and p.ward_id = public.current_ward_id()
        and p.municipality_id = public.current_municipality_id()
    )
  )
  or (
    public.current_role() = 'corporation_admin'
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.municipality_id = public.current_municipality_id()
    )
  )
);

drop policy if exists ward_budgets_read_municipality on public.ward_budgets;
create policy ward_budgets_read_municipality on public.ward_budgets
for select to anon, authenticated
using (exists (
  select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id()
));

drop policy if exists expenditures_read_municipality on public.expenditures;
create policy expenditures_read_municipality on public.expenditures
for select to anon, authenticated
using (exists (
  select 1 from public.wards w where w.id = ward_id and w.municipality_id = public.current_municipality_id()
));

drop policy if exists escalations_read_municipality on public.escalations;
create policy escalations_read_municipality on public.escalations
for select to anon, authenticated
using (exists (
  select 1 from public.issues i where i.id = issue_id and i.municipality_id = public.current_municipality_id()
));
