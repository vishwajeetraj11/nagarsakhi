-- Preserve existing photo/audio records while allowing uploaded videos to be
-- represented accurately in the public issue record.
alter table public.issue_media
  drop constraint if exists issue_media_kind_check;

alter table public.issue_media
  add constraint issue_media_kind_check
  check (kind in ('photo', 'video', 'audio'));
