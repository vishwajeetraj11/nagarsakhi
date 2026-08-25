-- Public-only synthetic representative directory for Phusro.
--
-- These records intentionally do not create Firebase users or rows in
-- public.profiles. They are read-only public representatives until a real
-- Parshad is separately registered for authentication.
--
-- The seed is safe to rerun. It reuses a current synthetic term when one is
-- already present, and never overwrites a non-synthetic current term.

do $$
declare
  v_municipality_id uuid;
  v_ward_id uuid;
  v_official_id uuid;
  v_current_term_id uuid;
  v_current_term_synthetic boolean;
  v_seed record;
begin
  select m.id
  into v_municipality_id
  from public.municipalities m
  where m.name = 'Phusro Municipal Corporation'
    and m.district = 'Bokaro'
    and m.state = 'Jharkhand'
  limit 1;

  if v_municipality_id is null then
    raise exception 'Phusro Municipal Corporation was not found';
  end if;

  for v_seed in
    select *
    from (values
      (1,  'Asha Kumari',    1),
      (2,  'Ravi Kumar',     1),
      (3,  'Sunita Devi',    1),
      (4,  'Mohan Prasad',   1),
      (5,  'Pooja Kumari',   1),
      (6,  'Sanjay Mahto',   1),
      (7,  'Rajesh Kumar',   3),
      (8,  'Neha Devi',      1),
      (9,  'Amit Kumar',     1),
      (10, 'Kavita Singh',   1),
      (11, 'Rakesh Prasad',  1),
      (12, 'Meena Kumari',   2),
      (13, 'Deepak Mahto',   1),
      (14, 'Anjali Devi',    1),
      (15, 'Vijay Kumar',    1),
      (16, 'Sushma Kumari',  1),
      (17, 'Imran Ansari',   1),
      (18, 'Nandita Devi',   2),
      (19, 'Manoj Prasad',   1),
      (20, 'Priya Kumari',   1),
      (21, 'Arvind Kumar',   1),
      (22, 'Rekha Devi',     1),
      (23, 'Gopal Mahto',    1),
      (24, 'Farida Begum',   2),
      (25, 'Ashok Kumar',    1),
      (26, 'Kiran Devi',     1),
      (27, 'Mukesh Prasad',  1),
      (28, 'Lata Kumari',    1)
    ) as seed(ward_number, official_name, term_number)
  loop
    select w.id
    into v_ward_id
    from public.wards w
    where w.municipality_id = v_municipality_id
      and w.ward_number = v_seed.ward_number;

    if v_ward_id is null then
      raise exception 'Ward % was not found in Phusro Municipal Corporation', v_seed.ward_number;
    end if;

    select ot.id, o.is_synthetic
    into v_current_term_id, v_current_term_synthetic
    from public.official_terms ot
    join public.officials o on o.id = ot.official_id
    where ot.ward_id = v_ward_id
      and ot.is_current
    order by ot.created_at desc
    limit 1;

    if v_current_term_id is not null and not coalesce(v_current_term_synthetic, false) then
      raise notice 'Preserving the existing non-synthetic current representative for ward %', v_seed.ward_number;
      continue;
    end if;

    if v_current_term_id is not null then
      select ot.official_id
      into v_official_id
      from public.official_terms ot
      where ot.id = v_current_term_id;

      update public.officials
      set
        name = v_seed.official_name,
        role_label = 'Ward Parshad',
        is_synthetic = true
      where id = v_official_id;

      update public.official_terms
      set
        role_label = 'Ward Parshad',
        term_number = v_seed.term_number,
        is_current = true
      where id = v_current_term_id;

      continue;
    end if;

    select o.id
    into v_official_id
    from public.officials o
    where o.municipality_id = v_municipality_id
      and o.name = v_seed.official_name
      and o.role_label = 'Ward Parshad'
      and o.is_synthetic
    order by o.created_at
    limit 1;

    if v_official_id is null then
      insert into public.officials (
        municipality_id,
        name,
        role_label,
        is_synthetic
      )
      values (
        v_municipality_id,
        v_seed.official_name,
        'Ward Parshad',
        true
      )
      returning id into v_official_id;
    end if;

    insert into public.official_terms (
      official_id,
      ward_id,
      role_label,
      term_number,
      is_current
    )
    values (
      v_official_id,
      v_ward_id,
      'Ward Parshad',
      v_seed.term_number,
      true
    );
  end loop;
end;
$$;
