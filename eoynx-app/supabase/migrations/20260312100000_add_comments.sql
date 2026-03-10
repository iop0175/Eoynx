-- =========================================================
-- Comments 테이블 추가 마이그레이션
-- =========================================================

-- COMMENTS 테이블
-- =========================================================
drop table if exists public.comments cascade;

create table public.comments (
  id uuid default gen_random_uuid() primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_comments_item_id on public.comments(item_id);
create index idx_comments_user_id on public.comments(user_id);
create index idx_comments_created_at on public.comments(created_at);

-- RLS: COMMENTS
-- =========================================================
alter table public.comments enable row level security;

-- 아이템이 public/unlisted면 댓글 조회 가능
drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public"
on public.comments for select
using (
  exists (
    select 1 from public.items 
    where items.id = comments.item_id 
    and items.visibility in ('public', 'unlisted')
  )
);

-- 로그인한 사용자만 댓글 추가 가능
drop policy if exists "comments_insert_auth" on public.comments;
create policy "comments_insert_auth"
on public.comments for insert
with check (auth.uid() = user_id);

-- 본인 댓글만 수정 가능
drop policy if exists "comments_update_self" on public.comments;
create policy "comments_update_self"
on public.comments for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 본인 댓글 또는 아이템 오너만 삭제 가능
drop policy if exists "comments_delete_self_or_owner" on public.comments;
create policy "comments_delete_self_or_owner"
on public.comments for delete
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.items 
    where items.id = comments.item_id 
    and items.owner_id = auth.uid()
  )
);

-- Updated_at trigger
create trigger update_comments_updated_at
  before update on public.comments
  for each row execute function update_updated_at_column();
