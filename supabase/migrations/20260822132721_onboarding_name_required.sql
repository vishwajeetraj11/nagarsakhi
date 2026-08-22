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

  if v_clean_name is null then
    raise exception 'Enter your public or official display name';
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
