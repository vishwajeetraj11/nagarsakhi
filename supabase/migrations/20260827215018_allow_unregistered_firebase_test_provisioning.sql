-- TEMPORARY TESTING MIGRATION
--
-- Restores automatic citizen provisioning so Firebase test accounts can be
-- used to seed additional issue records. This is intentionally a forward
-- migration: do not edit or remove the already-applied registration gate.
-- Re-enable the gate with a later migration before production use.

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
  if v_firebase_uid is null
    or v_firebase_issuer <> ('https://securetoken.google.com/' || v_firebase_project_id)
  then
    raise exception 'A verified NagarSakhi Firebase token is required';
  end if;

  select p.id
  into v_profile_id
  from public.profiles p
  where p.firebase_uid = v_firebase_uid
  limit 1;

  if v_profile_id is not null then
    return v_profile_id;
  end if;

  -- Firebase phone auth is required for this temporary test path. The
  -- profile is still a normal citizen profile and remains subject to RLS.
  if v_phone is null or nullif(trim(v_phone), '') is null then
    return null;
  end if;

  select m.id
  into v_target_municipality_id
  from public.municipalities m
  where m.is_active
  order by m.created_at
  limit 1;

  select w.id
  into v_target_ward_id
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
    coalesce(nullif(trim(display_name), ''), v_phone),
    'fb-' || left(regexp_replace(v_firebase_uid, '[^a-zA-Z0-9]+', '-', 'g'), 32),
    'citizen',
    false
  )
  returning id into v_profile_id;

  insert into public.citizen_private_profiles (profile_id, phone, house_number)
  values (v_profile_id, v_phone, 'Not provided')
  on conflict (phone) do nothing;

  return v_profile_id;
end;
$$;
