alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

update public.profiles
set onboarding_completed = true
where firebase_uid is null;

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

  if tg_op = 'UPDATE'
    and current_setting('app.profile_onboarding_update', true) is distinct from 'allowed'
    and (
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
    is_synthetic,
    onboarding_completed
  )
  values (
    v_firebase_uid,
    v_target_municipality_id,
    v_target_ward_id,
    coalesce(nullif(trim(display_name), ''), coalesce(v_phone, 'NagarSakhi user')),
    'fb-' || left(regexp_replace(v_firebase_uid, '[^a-zA-Z0-9]+', '-', 'g'), 32),
    'citizen',
    false,
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

create or replace function public.list_onboarding_locations()
returns table (
  municipality_id uuid,
  municipality_name text,
  district text,
  state text,
  ward_id uuid,
  ward_number smallint,
  ward_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.name,
    m.district,
    m.state,
    w.id,
    w.ward_number,
    w.name
  from public.municipalities m
  join public.wards w on w.municipality_id = m.id
  where m.is_active
  order by m.state, m.district, m.name, w.ward_number;
$$;

create or replace function public.complete_firebase_profile_onboarding(
  target_municipality_id uuid,
  target_ward_id uuid,
  display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_clean_name text := nullif(trim(display_name), '');
begin
  if v_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.wards w
    join public.municipalities m on m.id = w.municipality_id
    where w.id = target_ward_id
      and w.municipality_id = target_municipality_id
      and m.is_active
  ) then
    raise exception 'Choose a valid municipality and ward';
  end if;

  perform set_config('app.profile_onboarding_update', 'allowed', true);

  update public.profiles
  set
    municipality_id = target_municipality_id,
    ward_id = target_ward_id,
    name = coalesce(v_clean_name, name),
    onboarding_completed = true
  where id = v_profile_id
    and role = 'citizen';

  if not found then
    raise exception 'Only citizen profiles can complete ward onboarding';
  end if;

  return v_profile_id;
end;
$$;

grant execute on function public.list_onboarding_locations() to anon, authenticated;
grant execute on function public.complete_firebase_profile_onboarding(uuid, uuid, text) to anon, authenticated;
