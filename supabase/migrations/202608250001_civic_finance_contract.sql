-- Civic/finance contract foundation for Phusro Municipal Corporation.
-- Seeded finance rows are temporary demo product data. Fixed UUIDs and
-- upserts below make repeated migration runs idempotent.

alter table public.official_terms
  add column if not exists term_number smallint
  check (term_number is null or term_number > 0);

alter table public.ward_budgets
  add column if not exists is_demo boolean not null default false;

alter table public.expenditures
  add column if not exists is_demo boolean not null default false;

-- Imported demo finance rows do not have an authenticated human editor.
-- Non-demo writes retain the existing actor requirement through these checks
-- and the existing RLS/tenancy policies.
alter table public.ward_budgets
  alter column updated_by drop not null;

alter table public.expenditures
  alter column created_by drop not null;

alter table public.ward_budgets
  drop constraint if exists ward_budgets_actor_required,
  add constraint ward_budgets_actor_required
    check (is_demo or updated_by is not null);

alter table public.expenditures
  drop constraint if exists expenditures_actor_required,
  add constraint expenditures_actor_required
    check (is_demo or created_by is not null);

do $$
declare
  v_old_id uuid;
  v_canonical_id uuid;
begin
  select id into v_old_id
  from public.municipalities
  where name = 'Phusro Nagar Parishad'
    and district = 'Bokaro'
    and state = 'Jharkhand';

  select id into v_canonical_id
  from public.municipalities
  where name = 'Phusro Municipal Corporation'
    and district = 'Bokaro'
    and state = 'Jharkhand';

  if v_old_id is not null and v_canonical_id is not null and v_old_id <> v_canonical_id then
    raise exception 'Both legacy and canonical Phusro municipality rows exist; manual reconciliation is required';
  elsif v_old_id is not null then
    update public.municipalities
    set name = 'Phusro Municipal Corporation'
    where id = v_old_id;
  elsif v_canonical_id is null then
    raise exception 'Phusro municipality row was not found';
  end if;
end;
$$;

-- Persist the existing fixed 28-ward demo allocation dataset. Existing
-- authoritative (is_demo = false) budgets are never overwritten.
insert into public.ward_budgets (
  ward_id,
  allocated_amount,
  updated_by,
  updated_at,
  is_demo
)
select
  w.id,
  case w.ward_number
    when 7 then 1860000
    when 12 then 2420000
    when 18 then 2110000
    else 1200000 + (w.ward_number * 35000)
  end,
  null,
  now(),
  true
from public.wards w
join public.municipalities m on m.id = w.municipality_id
where m.name = 'Phusro Municipal Corporation'
  and m.district = 'Bokaro'
  and m.state = 'Jharkhand'
  and w.ward_number between 1 and 28
on conflict (ward_id) do update
set
  allocated_amount = excluded.allocated_amount,
  updated_by = null,
  updated_at = excluded.updated_at,
  is_demo = true
where public.ward_budgets.is_demo;

-- Fixed UUIDs plus DO NOTHING make the append-only expenditure seed
-- repeatable without duplicating records.
insert into public.expenditures (
  id,
  ward_id,
  amount,
  description,
  spent_at,
  created_by,
  is_demo
)
select
  seed.id,
  w.id,
  seed.amount,
  seed.description,
  seed.spent_at,
  null,
  true
from (
  values
    ('f0010000-0000-4000-8500-000000000001'::uuid, 7::smallint, 540000::numeric, 'LED streetlight replacement'::text, '2026-07-28'::date),
    ('f0010000-0000-4000-8500-000000000002'::uuid, 12::smallint, 825000::numeric, 'Drain desilting and covers'::text, '2026-08-04'::date),
    ('f0010000-0000-4000-8500-000000000003'::uuid, 18::smallint, 410000::numeric, 'Community park repairs'::text, '2026-07-30'::date),
    ('f0010000-0000-4000-8500-000000000004'::uuid, 12::smallint, 662500::numeric, 'Crossing and footpath works'::text, '2026-08-12'::date)
) as seed(id, ward_number, amount, description, spent_at)
join public.municipalities m
  on m.name = 'Phusro Municipal Corporation'
  and m.district = 'Bokaro'
  and m.state = 'Jharkhand'
join public.wards w
  on w.municipality_id = m.id
  and w.ward_number = seed.ward_number
on conflict (id) do nothing;
