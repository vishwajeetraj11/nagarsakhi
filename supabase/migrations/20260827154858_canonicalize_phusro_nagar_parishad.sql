-- Keep Phusro's legal entity name consistent in the live public record.
-- This is a forward-only correction; historical migrations are intentionally
-- left unchanged so their checksums remain valid.
do $$
declare
  legacy_id uuid;
  canonical_id uuid;
begin
  select id
  into legacy_id
  from public.municipalities
  where name = 'Phusro Municipal Corporation'
    and district = 'Bokaro'
    and state = 'Jharkhand';

  select id
  into canonical_id
  from public.municipalities
  where name = 'Phusro Nagar Parishad'
    and district = 'Bokaro'
    and state = 'Jharkhand';

  if legacy_id is not null and canonical_id is not null and legacy_id <> canonical_id then
    raise exception 'Both legacy and canonical Phusro municipality rows exist; manual reconciliation is required';
  elsif legacy_id is not null then
    update public.municipalities
    set name = 'Phusro Nagar Parishad'
    where id = legacy_id;
  end if;
end;
$$;
