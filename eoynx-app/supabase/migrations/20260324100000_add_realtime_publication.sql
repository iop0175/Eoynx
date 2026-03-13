-- =========================================================
-- Realtime Publication 추가 마이그레이션
-- DM, Likes, Notifications 테이블에 실시간 구독 활성화
-- =========================================================

-- 테이블 replica identity 설정 (UPDATE/DELETE 이벤트를 위해 필요)
alter table public.dm_messages replica identity full;
alter table public.dm_threads replica identity full;
alter table public.likes replica identity full;
alter table public.notifications replica identity full;

-- supabase_realtime publication에 테이블 추가
-- (이미 있으면 무시)
do $$
begin
  -- dm_messages
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'dm_messages'
  ) then
    alter publication supabase_realtime add table public.dm_messages;
  end if;

  -- dm_threads
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'dm_threads'
  ) then
    alter publication supabase_realtime add table public.dm_threads;
  end if;

  -- likes
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'likes'
  ) then
    alter publication supabase_realtime add table public.likes;
  end if;

  -- notifications
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
