-- Forward migration for projects where the historical demo seed was already applied.
-- It creates only the real Phusro civic directory and is safe to run repeatedly.

do $$
declare
  v_requested_municipality_id uuid := 'f0010000-0000-4000-8000-000000801777';
  v_municipality_id uuid;
begin
  insert into public.municipalities (
    id,
    name,
    district,
    state,
    is_active,
    is_synthetic
  )
  values (
    v_requested_municipality_id,
    'Phusro Nagar Parishad',
    'Bokaro',
    'Jharkhand',
    true,
    false
  )
  on conflict (name, district, state) do update
  set
    is_active = true,
    is_synthetic = false
  returning id into v_municipality_id;

  insert into public.wards (
    id,
    municipality_id,
    ward_number,
    name
  )
  select
    ('f0010000-0000-4000-8100-' || lpad(ward_number::text, 12, '0'))::uuid,
    v_municipality_id,
    ward_number::smallint,
    'Ward ' || lpad(ward_number::text, 2, '0')
  from generate_series(1, 28) as generated(ward_number)
  on conflict (municipality_id, ward_number) do update
  set name = excluded.name;
end;
$$;
