-- A ward has one current Parshad term and one Parshad profile.
-- Partial unique indexes enforce this under concurrent writes as well as normal inserts.
create unique index if not exists official_terms_one_current_ward_parshad
  on public.official_terms (ward_id)
  where ward_id is not null and is_current;

create unique index if not exists profiles_one_parshad_per_ward
  on public.profiles (municipality_id, ward_id)
  where role = 'parshad' and ward_id is not null;
