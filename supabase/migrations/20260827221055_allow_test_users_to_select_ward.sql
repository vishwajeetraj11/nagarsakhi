-- TEMPORARY TESTING MIGRATION
--
-- The preceding testing migration auto-provisions new Firebase citizens, but
-- the production onboarding function still requires the profile's original
-- ward. Allow only an uncompleted citizen profile to choose its municipality
-- and ward once during onboarding. Completed profiles remain immutable.

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
begin
  if v_firebase_uid is null
    or v_firebase_issuer <> ('https://securetoken.google.com/' || v_firebase_project_id)
  then
    raise exception 'A verified NagarSakhi Firebase token is required';
  end if;

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
    and firebase_uid = v_firebase_uid
    and role = 'citizen'
    and onboarding_completed = false;

  if not found then
    raise exception 'Only a new citizen profile can complete ward onboarding';
  end if;

  return v_profile_id;
end;
$$;
