-- =========================================================
-- DM 나가기 기능 추가 마이그레이션
-- =========================================================

-- dm_threads 테이블에 나간 시간 컬럼 추가
alter table public.dm_threads
add column if not exists participant1_left_at timestamptz,
add column if not exists participant2_left_at timestamptz;

-- 나가기 허용 (UPDATE 정책)
-- 참가자만 자신의 left_at 컬럼 업데이트 가능
drop policy if exists "dm_threads_update_leave" on public.dm_threads;

create policy "dm_threads_update_leave"
on public.dm_threads for update
using (
  auth.uid() = participant1_id or auth.uid() = participant2_id
);
