-- =====================================================
-- Eoynx Supabase 데이터베이스 스키마 (완전판)
-- =====================================================

-- =====================================================
-- ⚠️ 기존 테이블/트리거/함수 삭제 (순서 중요!)
-- =====================================================

-- 테이블 삭제 (CASCADE로 관련 트리거, 정책, 인덱스 자동 삭제)
drop table if exists public.collection_items cascade;
drop table if exists public.collections cascade;
drop table if exists public.verified_sources cascade;
drop table if exists public.item_values cascade;
drop table if exists public.items cascade;
drop table if exists public.profiles cascade;

-- auth.users 트리거 삭제 (별도 처리)
drop trigger if exists on_auth_user_created on auth.users;

-- 함수 삭제 (CASCADE로 의존성 포함 삭제)
drop function if exists public.is_owner(uuid) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.update_updated_at_column() cascade;

-- ENUM 삭제
drop type if exists public.visibility cascade;
drop type if exists public.value_track cascade;

-- =====================================================
-- 0. ENUMS
-- =====================================================
do $$ begin
  create type public.visibility as enum ('public', 'unlisted', 'private');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.value_track as enum ('unverified', 'verified');
exception when duplicate_object then null;
end $$;

-- =====================================================
-- 0. HELPER FUNCTIONS
-- =====================================================
create or replace function public.is_owner(profile_id uuid)
returns boolean
language sql
stable
as $$
  select auth.uid() = profile_id;
$$;

-- =====================================================
-- 1. PROFILES 테이블
-- =====================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  dm_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_handle on public.profiles(handle);

-- =====================================================
-- 2. ITEMS 테이블
-- =====================================================
create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  visibility public.visibility not null default 'private',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_items_owner_id on public.items(owner_id);
create index idx_items_visibility on public.items(visibility);

-- =====================================================
-- 3. ITEM_VALUES 테이블 (아이템 가치)
-- =====================================================
create table public.item_values (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,

  track public.value_track not null,

  -- Money storage (minor units): ex) USD cents, KRW won
  currency text not null default 'USD',
  minor_unit int not null default 2, -- USD=2, KRW=0

  -- unverified: value_minor
  value_minor bigint,

  -- verified: median/min/max in minor units
  verified_median_minor bigint,
  verified_min_minor bigint,
  verified_max_minor bigint,

  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- sanity checks
  check (
    (track = 'unverified' and value_minor is not null)
    or
    (track = 'verified' and verified_median_minor is not null and verified_min_minor is not null and verified_max_minor is not null)
  ),
  check (
    verified_min_minor is null
    or verified_max_minor is null
    or verified_min_minor <= verified_median_minor and verified_median_minor <= verified_max_minor
  )
);

create index idx_item_values_item_id on public.item_values(item_id);
create index idx_item_values_track on public.item_values(track);

-- =====================================================
-- 4. VERIFIED_SOURCES 테이블 (검증 출처)
-- =====================================================
create table public.verified_sources (
  id uuid primary key default gen_random_uuid(),
  item_value_id uuid not null references public.item_values(id) on delete cascade,
  label text not null,
  url text,
  created_at timestamptz not null default now()
);

create index idx_verified_sources_value_id on public.verified_sources(item_value_id);

-- =====================================================
-- 5. COLLECTIONS 테이블 (컬렉션)
-- =====================================================
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default false,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_collections_owner_id on public.collections(owner_id);
create index idx_collections_is_public on public.collections(is_public);

-- =====================================================
-- 6. COLLECTION_ITEMS 테이블 (컬렉션-아이템 관계)
-- =====================================================
create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique(collection_id, item_id)
);

create index idx_collection_items_collection_id on public.collection_items(collection_id);
create index idx_collection_items_item_id on public.collection_items(item_id);

-- =====================================================
-- 7. TRIGGERS: updated_at 자동 업데이트
-- =====================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function update_updated_at_column();

create trigger update_items_updated_at
  before update on public.items
  for each row execute function update_updated_at_column();

create trigger update_item_values_updated_at
  before update on public.item_values
  for each row execute function update_updated_at_column();

create trigger update_collections_updated_at
  before update on public.collections
  for each row execute function update_updated_at_column();

-- =====================================================
-- 8. TRIGGER: 회원가입 시 자동 프로필 생성
-- =====================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    lower(split_part(new.email, '@', 1)) || '_' || substr(new.id::text, 1, 8),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================
-- 9. RLS: PROFILES
-- =====================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (public.is_owner(id))
with check (public.is_owner(id));

-- =====================================================
-- 10. RLS: ITEMS
-- =====================================================
alter table public.items enable row level security;

drop policy if exists "items_select_public_unlisted_or_owner" on public.items;
create policy "items_select_public_unlisted_or_owner"
on public.items for select
to anon, authenticated
using (
  visibility in ('public', 'unlisted')
  or public.is_owner(owner_id)
);

drop policy if exists "items_insert_owner" on public.items;
create policy "items_insert_owner"
on public.items for insert
to authenticated
with check (public.is_owner(owner_id));

drop policy if exists "items_update_owner" on public.items;
create policy "items_update_owner"
on public.items for update
to authenticated
using (public.is_owner(owner_id))
with check (public.is_owner(owner_id));

drop policy if exists "items_delete_owner" on public.items;
create policy "items_delete_owner"
on public.items for delete
to authenticated
using (public.is_owner(owner_id));

-- =====================================================
-- 11. RLS: ITEM_VALUES
-- =====================================================
alter table public.item_values enable row level security;

drop policy if exists "item_values_select_if_item_visible" on public.item_values;
create policy "item_values_select_if_item_visible"
on public.item_values for select
to anon, authenticated
using (
  exists (
    select 1
    from public.items i
    where i.id = item_values.item_id
      and (
        i.visibility in ('public','unlisted')
        or public.is_owner(i.owner_id)
      )
  )
);

drop policy if exists "item_values_insert_owner_only" on public.item_values;
create policy "item_values_insert_owner_only"
on public.item_values for insert
to authenticated
with check (
  exists (
    select 1
    from public.items i
    where i.id = item_values.item_id
      and public.is_owner(i.owner_id)
  )
);

-- =====================================================
-- 12. RLS: VERIFIED_SOURCES
-- =====================================================
alter table public.verified_sources enable row level security;

drop policy if exists "verified_sources_select_if_value_visible" on public.verified_sources;
create policy "verified_sources_select_if_value_visible"
on public.verified_sources for select
to anon, authenticated
using (
  exists (
    select 1
    from public.item_values v
    join public.items i on i.id = v.item_id
    where v.id = verified_sources.item_value_id
      and (
        i.visibility in ('public','unlisted')
        or public.is_owner(i.owner_id)
      )
  )
);

drop policy if exists "verified_sources_insert_owner_only" on public.verified_sources;
create policy "verified_sources_insert_owner_only"
on public.verified_sources for insert
to authenticated
with check (
  exists (
    select 1
    from public.item_values v
    join public.items i on i.id = v.item_id
    where v.id = verified_sources.item_value_id
      and public.is_owner(i.owner_id)
  )
);

-- =====================================================
-- 13. RLS: COLLECTIONS
-- =====================================================
alter table public.collections enable row level security;

drop policy if exists "collections_select_public_or_owner" on public.collections;
create policy "collections_select_public_or_owner"
on public.collections for select
to anon, authenticated
using (
  is_public = true
  or public.is_owner(owner_id)
);

drop policy if exists "collections_write_owner" on public.collections;
create policy "collections_write_owner"
on public.collections for insert
to authenticated
with check (public.is_owner(owner_id));

drop policy if exists "collections_update_owner" on public.collections;
create policy "collections_update_owner"
on public.collections for update
to authenticated
using (public.is_owner(owner_id))
with check (public.is_owner(owner_id));

drop policy if exists "collections_delete_owner" on public.collections;
create policy "collections_delete_owner"
on public.collections for delete
to authenticated
using (public.is_owner(owner_id));

-- =====================================================
-- 14. RLS: COLLECTION_ITEMS
-- =====================================================
alter table public.collection_items enable row level security;

drop policy if exists "collection_items_select_if_collection_visible" on public.collection_items;
create policy "collection_items_select_if_collection_visible"
on public.collection_items for select
to anon, authenticated
using (
  exists (
    select 1 from public.collections c
    where c.id = collection_items.collection_id
      and (c.is_public = true or public.is_owner(c.owner_id))
  )
);

drop policy if exists "collection_items_write_owner" on public.collection_items;
create policy "collection_items_write_owner"
on public.collection_items for insert
to authenticated
with check (
  exists (
    select 1 from public.collections c
    where c.id = collection_items.collection_id
      and public.is_owner(c.owner_id)
  )
);

drop policy if exists "collection_items_delete_owner" on public.collection_items;
create policy "collection_items_delete_owner"
on public.collection_items for delete
to authenticated
using (
  exists (
    select 1 from public.collections c
    where c.id = collection_items.collection_id
      and public.is_owner(c.owner_id)
  )
);

-- =====================================================
-- 15. STORAGE BUCKETS (대시보드에서 생성 또는 아래 SQL 사용)
-- =====================================================
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
-- insert into storage.buckets (id, name, public) values ('items', 'items', true);
