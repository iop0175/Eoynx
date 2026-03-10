-- =====================================================
-- Followers 테이블 추가 마이그레이션
-- =====================================================

-- 테이블 삭제 (이미 존재할 경우)
drop table if exists public.followers cascade;

-- =====================================================
-- FOLLOWERS 테이블
-- =====================================================
create table public.followers (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id),
  check (follower_id != following_id) -- 자기 자신 팔로우 방지
);

create index idx_followers_follower_id on public.followers(follower_id);
create index idx_followers_following_id on public.followers(following_id);

-- =====================================================
-- RLS: FOLLOWERS
-- =====================================================
alter table public.followers enable row level security;

-- 모든 사용자가 팔로우 관계 조회 가능
drop policy if exists "followers_select_all" on public.followers;
create policy "followers_select_all"
on public.followers for select
to anon, authenticated
using (true);

-- 인증된 사용자만 팔로우 생성 가능 (자신이 follower인 경우만)
drop policy if exists "followers_insert_self" on public.followers;
create policy "followers_insert_self"
on public.followers for insert
to authenticated
with check (public.is_owner(follower_id));

-- 팔로우 취소는 follower만 가능
drop policy if exists "followers_delete_self" on public.followers;
create policy "followers_delete_self"
on public.followers for delete
to authenticated
using (public.is_owner(follower_id));
