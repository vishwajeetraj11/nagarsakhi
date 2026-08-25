-- Only phone numbers that already belong to a NagarSakhi profile may enter the
-- live app. Unknown Firebase accounts are kept on the ward setup screen so the
-- selected ward can produce a useful, ward-specific error instead of creating a
-- synthetic profile.

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
  v_profile_id uuid;
  v_registered_firebase_uid text;
begin
  if v_firebase_uid is null or v_firebase_issuer <> ('https://securetoken.google.com/' || v_firebase_project_id) then
    raise exception 'A verified NagarSakhi Firebase token is required';
  end if;

  -- A previously linked Firebase account can open its existing profile.
  select p.id
  into v_profile_id
  from public.profiles p
  where p.firebase_uid = v_firebase_uid
  limit 1;

  if v_profile_id is not null then
    return v_profile_id;
  end if;

  -- Do not create a profile from login data. The phone must already be present
  -- in the municipality's private citizen register.
  if v_phone is null or nullif(trim(v_phone), '') is null then
    return null;
  end if;

  select p.id, p.firebase_uid
  into v_profile_id, v_registered_firebase_uid
  from public.citizen_private_profiles cpp
  join public.profiles p on p.id = cpp.profile_id
  where regexp_replace(cpp.phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
  limit 1;

  if v_profile_id is null then
    return null;
  end if;

  if v_registered_firebase_uid is not null and v_registered_firebase_uid <> v_firebase_uid then
    raise exception 'This phone number is already linked to another Firebase account';
  end if;

  if v_registered_firebase_uid is null then
    update public.profiles
    set firebase_uid = v_firebase_uid
    where id = v_profile_id;
  end if;

  return v_profile_id;
end;
$$;

create or replace function public.check_firebase_profile_registration(
  target_municipality_id uuid,
  target_ward_id uuid
)
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
  v_profile_id uuid;
  v_ward_number smallint;
begin
  if v_firebase_uid is null or v_firebase_issuer <> ('https://securetoken.google.com/' || v_firebase_project_id) then
    raise exception 'A verified NagarSakhi Firebase token is required';
  end if;

  select w.ward_number
  into v_ward_number
  from public.wards w
  join public.municipalities m on m.id = w.municipality_id
  where w.id = target_ward_id
    and w.municipality_id = target_municipality_id
    and m.is_active;

  if v_ward_number is null then
    raise exception 'Choose a valid municipality and ward';
  end if;

  select p.id
  into v_profile_id
  from public.citizen_private_profiles cpp
  join public.profiles p on p.id = cpp.profile_id
  where regexp_replace(cpp.phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
    and p.municipality_id = target_municipality_id
    and p.ward_id = target_ward_id
    and (p.firebase_uid is null or p.firebase_uid = v_firebase_uid)
  limit 1;

  if v_profile_id is null then
    raise exception 'User does not exist in Ward %. Use the mobile number registered with your municipality.', v_ward_number;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_profile_id
      and p.firebase_uid = v_firebase_uid
  ) then
    update public.profiles
    set firebase_uid = v_firebase_uid
    where id = v_profile_id
      and firebase_uid is null;
  end if;

  return v_profile_id;
end;
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
  v_firebase_project_id text := 'nagarsakhi-cbe25';
  v_firebase_uid text := auth.jwt()->>'sub';
  v_firebase_issuer text := auth.jwt()->>'iss';
  v_profile_id uuid := public.current_profile_id();
  v_clean_name text := nullif(trim(display_name), '');
  v_ward_number smallint;
begin
  if v_firebase_uid is null or v_firebase_issuer <> ('https://securetoken.google.com/' || v_firebase_project_id) then
    raise exception 'A verified NagarSakhi Firebase token is required';
  end if;

  if v_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if v_clean_name is null then
    raise exception 'Enter your public or official display name';
  end if;

  select w.ward_number
  into v_ward_number
  from public.wards w
  join public.municipalities m on m.id = w.municipality_id
  where w.id = target_ward_id
    and w.municipality_id = target_municipality_id
    and m.is_active;

  if v_ward_number is null then
    raise exception 'Choose a valid municipality and ward';
  end if;

  -- Onboarding confirms the ward already assigned to the registered profile;
  -- it must not be an authorization or ward-transfer mechanism.
  if not exists (
    select 1
    from public.profiles p
    join public.citizen_private_profiles cpp on cpp.profile_id = p.id
    where p.id = v_profile_id
      and p.firebase_uid = v_firebase_uid
      and p.municipality_id = target_municipality_id
      and p.ward_id = target_ward_id
  ) then
    raise exception 'User does not exist in Ward %. Use the mobile number registered with your municipality.', v_ward_number;
  end if;

  perform set_config('app.profile_onboarding_update', 'allowed', true);

  update public.profiles
  set
    municipality_id = target_municipality_id,
    ward_id = target_ward_id,
    name = v_clean_name,
    onboarding_completed = true
  where id = v_profile_id
    and role = 'citizen';

  if not found then
    raise exception 'Only citizen profiles can complete ward onboarding';
  end if;

  return v_profile_id;
end;
$$;

revoke all on function public.provision_firebase_profile(text) from public;
revoke all on function public.check_firebase_profile_registration(uuid, uuid) from public;
revoke all on function public.complete_firebase_profile_onboarding(uuid, uuid, text) from public;
grant execute on function public.provision_firebase_profile(text) to anon, authenticated;
grant execute on function public.check_firebase_profile_registration(uuid, uuid) to anon, authenticated;
grant execute on function public.complete_firebase_profile_onboarding(uuid, uuid, text) to anon, authenticated;
