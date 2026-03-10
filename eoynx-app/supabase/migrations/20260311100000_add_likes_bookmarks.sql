-- =========================================================
-- Likes & Bookmarks 테이블 추가 마이그레이션
-- =========================================================

-- LIKES 테이블
-- =========================================================
drop table if exists public.likes cascade;

create table public.likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  created_at timestamptz default now() not null,
  unique(user_id, item_id)
);

create index idx_likes_user_id on public.likes(user_id);
create index idx_likes_item_id on public.likes(item_id);

-- RLS: LIKES
-- =========================================================
alter table public.likes enable row level security;

-- 모두 조회 가능
drop policy if exists "likes_select_all" on public.likes;
create policy "likes_select_all"
on public.likes for select
using (true);

-- 본인만 추가 가능
drop policy if exists "likes_insert_self" on public.likes;
create policy "likes_insert_self"
on public.likes for insert
with check (auth.uid() = user_id);

-- 본인만 삭제 가능
drop policy if exists "likes_delete_self" on public.likes;
create policy "likes_delete_self"
on public.likes for delete
using (auth.uid() = user_id);


-- BOOKMARKS 테이블
-- =========================================================
drop table if exists public.bookmarks cascade;

create table public.bookmarks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  created_at timestamptz default now() not null,
  unique(user_id, item_id)
);

create index idx_bookmarks_user_id on public.bookmarks(user_id);
create index idx_bookmarks_item_id on public.bookmarks(item_id);

-- RLS: BOOKMARKS
-- =========================================================
alter table public.bookmarks enable row level security;

-- 본인만 조회 가능
drop policy if exists "bookmarks_select_self" on public.bookmarks;
create policy "bookmarks_select_self"
on public.bookmarks for select
using (auth.uid() = user_id);

-- 본인만 추가 가능
drop policy if exists "bookmarks_insert_self" on public.bookmarks;
create policy "bookmarks_insert_self"
on public.bookmarks for insert
with check (auth.uid() = user_id);

-- 본인만 삭제 가능
drop policy if exists "bookmarks_delete_self" on public.bookmarks;
create policy "bookmarks_delete_self"
on public.bookmarks for delete
using (auth.uid() = user_id);
