-- =========================================================
-- Add DM openness setting to profiles
-- =========================================================

alter table public.profiles
  add column if not exists dm_open boolean not null default true;

comment on column public.profiles.dm_open is 'If true, anyone can DM directly. If false, request must be accepted first.';
