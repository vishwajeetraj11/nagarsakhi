do $$
declare
  v_municipality_id uuid := '00000000-0000-4000-8000-000000000001';
  v_admin_id uuid := '00000000-0000-4000-8000-000000000101';
  v_ward12_parshad_id uuid := '00000000-0000-4000-8000-000000000112';
  v_ward7_parshad_id uuid := '00000000-0000-4000-8000-000000000107';
  v_ward18_parshad_id uuid := '00000000-0000-4000-8000-000000000118';
  v_chair_id uuid := '00000000-0000-4000-8000-000000000201';
  v_exec_id uuid := '00000000-0000-4000-8000-000000000202';
  v_official_ward7_id uuid := '00000000-0000-4000-8000-000000000207';
  v_official_ward12_id uuid := '00000000-0000-4000-8000-000000000212';
  v_official_ward18_id uuid := '00000000-0000-4000-8000-000000000218';
  v_ward_names text[] := array[
    'Station Road', 'Bania Tola', 'Gandhi Nagar', 'Kargali', 'Fusri Bazaar', 'Subhash Nagar',
    'Janta Nagar', 'New Colony', 'Railway Quarter', 'Bermo Road', 'Shiv Mandir', 'Nehru Nagar',
    'Madhukunda', 'Khurpania', 'Karo', 'Gandhi Chowk', 'Singarbera', 'Azad Nagar', 'Central Market',
    'Bokaro River', 'Sahijana', 'Milan Nagar', 'Lalpania Road', 'Sundar Nagar', 'Kumarpur', 'Pragati Nagar',
    'Rajendra Nagar', 'Gandhi Maidan'
  ];
  v_number int;
  v_ward_id uuid;
begin
  insert into public.municipalities (id, name, district, state, is_active)
  values (v_municipality_id, 'Phusro Nagar Parishad', 'Bokaro', 'Jharkhand', true)
  on conflict (id) do update set
    name = excluded.name,
    district = excluded.district,
    state = excluded.state,
    is_active = true;

  for v_number in 1..array_length(v_ward_names, 1) loop
    v_ward_id := ('00000000-0000-4000-8000-' || lpad(v_number::text, 12, '0'))::uuid;

    insert into public.wards (id, municipality_id, ward_number, name)
    values (v_ward_id, v_municipality_id, v_number, v_ward_names[v_number])
    on conflict (municipality_id, ward_number) do update set name = excluded.name;

  end loop;

  insert into public.profiles (id, municipality_id, ward_id, name, username, role, is_synthetic)
  values
    (v_admin_id, v_municipality_id, null, 'Corporation Demo Admin', 'corp-admin-demo', 'corporation_admin', true),
    (v_ward7_parshad_id, v_municipality_id, '00000000-0000-4000-8000-000000000007', 'Meena Placeholder', 'ward7-parshad-demo', 'parshad', true),
    (v_ward12_parshad_id, v_municipality_id, '00000000-0000-4000-8000-000000000012', 'Nandita Sample', 'ward12-parshad-demo', 'parshad', true),
    (v_ward18_parshad_id, v_municipality_id, '00000000-0000-4000-8000-000000000018', 'Kavita Demo', 'ward18-parshad-demo', 'parshad', true)
  on conflict (id) do update set
    municipality_id = excluded.municipality_id,
    ward_id = excluded.ward_id,
    name = excluded.name,
    role = excluded.role;

  for v_number in 1..array_length(v_ward_names, 1) loop
    v_ward_id := ('00000000-0000-4000-8000-' || lpad(v_number::text, 12, '0'))::uuid;

    insert into public.ward_budgets (ward_id, allocated_amount, updated_by)
    values (
      v_ward_id,
      case
        when v_number = 7 then 1860000
        when v_number = 12 then 2420000
        when v_number = 18 then 2110000
        else 1200000 + v_number * 35000
      end,
      v_admin_id
    )
    on conflict (ward_id) do update set allocated_amount = excluded.allocated_amount;
  end loop;

  insert into public.officials (id, municipality_id, name, role_label, department)
  values
    (v_chair_id, v_municipality_id, 'Sushila Demo', 'Chairperson', null),
    (v_exec_id, v_municipality_id, 'Arvind Sample', 'Executive Officer', 'Municipal Administration'),
    (v_official_ward7_id, v_municipality_id, 'Meena Placeholder', 'Ward Parshad', null),
    (v_official_ward12_id, v_municipality_id, 'Nandita Sample', 'Ward Parshad', null),
    (v_official_ward18_id, v_municipality_id, 'Kavita Demo', 'Ward Parshad', null)
  on conflict (id) do update set
    name = excluded.name,
    role_label = excluded.role_label,
    department = excluded.department;

  insert into public.official_terms (id, official_id, ward_id, role_label, won_by_votes, is_current)
  values
    ('00000000-0000-4000-8000-000000000301', v_chair_id, null, 'Chairperson', null, true),
    ('00000000-0000-4000-8000-000000000302', v_exec_id, null, 'Executive Officer', null, true),
    ('00000000-0000-4000-8000-000000000307', v_official_ward7_id, '00000000-0000-4000-8000-000000000007', 'Ward Parshad', 1240, true),
    ('00000000-0000-4000-8000-000000000312', v_official_ward12_id, '00000000-0000-4000-8000-000000000012', 'Ward Parshad', 1586, true),
    ('00000000-0000-4000-8000-000000000318', v_official_ward18_id, '00000000-0000-4000-8000-000000000018', 'Ward Parshad', 1391, true)
  on conflict (id) do update set
    official_id = excluded.official_id,
    ward_id = excluded.ward_id,
    role_label = excluded.role_label,
    won_by_votes = excluded.won_by_votes,
    is_current = excluded.is_current;

  insert into public.notices (id, municipality_id, ward_id, author_id, body, created_at)
  values
    ('00000000-0000-4000-8000-000000000401', v_municipality_id, null, v_admin_id, 'Ward sabha meetings will be held on the second Sunday of every month.', '2026-08-01T08:00:00Z'),
    ('00000000-0000-4000-8000-000000000402', v_municipality_id, '00000000-0000-4000-8000-000000000012', v_ward12_parshad_id, 'वार्ड 12 में सड़क मरम्मत का कार्य 20 अगस्त से शुरू होगा।', '2026-08-10T08:00:00Z')
  on conflict (id) do update set body = excluded.body;

  insert into public.issues (id, municipality_id, ward_id, reporter_id, title, description, original_language, status, created_at, updated_at)
  values
    ('00000000-0000-4000-8000-000000000501', v_municipality_id, '00000000-0000-4000-8000-000000000012', v_ward12_parshad_id, 'Streetlight near Nehru Park is off', 'Three lamps are dark after sunset on the park lane.', 'en', 'requested', '2026-08-02T09:00:00Z', '2026-08-02T15:00:00Z'),
    ('00000000-0000-4000-8000-000000000502', v_municipality_id, '00000000-0000-4000-8000-000000000012', v_ward12_parshad_id, 'नाली की सफाई की जरूरत', 'बारिश के बाद स्कूल के पास नाली भर गई है।', 'hi', 'in_progress', '2026-08-03T09:00:00Z', '2026-08-03T15:00:00Z'),
    ('00000000-0000-4000-8000-000000000503', v_municipality_id, '00000000-0000-4000-8000-000000000007', v_ward7_parshad_id, 'Water tanker schedule', 'Please publish the weekly tanker route for Janta Nagar.', 'en', 'completed', '2026-08-04T09:00:00Z', '2026-08-04T15:00:00Z')
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    updated_at = excluded.updated_at;

  insert into public.expenditures (id, ward_id, amount, description, spent_at, created_by)
  values
    ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000007', 540000, 'LED streetlight replacement', '2026-07-28', v_admin_id),
    ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000012', 825000, 'Drain desilting and covers', '2026-08-04', v_admin_id),
    ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000018', 410000, 'Community park repairs', '2026-07-30', v_admin_id)
  on conflict (id) do nothing;
end;
$$;
