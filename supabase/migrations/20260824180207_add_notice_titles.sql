alter table public.notices
  add column title text;

update public.notices
set title = case
  when ward_id is null then 'Municipality update'
  else 'Ward update'
end
where title is null;

alter table public.notices
  alter column title set not null;

alter table public.notices
  add constraint notices_title_length
  check (char_length(title) between 3 and 160);
