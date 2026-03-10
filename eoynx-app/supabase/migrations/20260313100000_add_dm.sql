-- =========================================================
-- DM (Direct Messages) 테이블 추가 마이그레이션
-- =========================================================

-- DM_THREADS 테이블 (대화 스레드)
-- =========================================================
drop table if exists public.dm_threads cascade;

create table public.dm_threads (
  id uuid default gen_random_uuid() primary key,
  participant1_id uuid not null references auth.users(id) on delete cascade,
  participant2_id uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  -- Ensure participants are ordered to prevent duplicate threads
  constraint unique_participants unique (participant1_id, participant2_id),
  constraint different_participants check (participant1_id < participant2_id)
);

create index idx_dm_threads_participant1 on public.dm_threads(participant1_id);
create index idx_dm_threads_participant2 on public.dm_threads(participant2_id);
create index idx_dm_threads_last_message on public.dm_threads(last_message_at desc);

-- DM_MESSAGES 테이블 (메시지)
-- =========================================================
drop table if exists public.dm_messages cascade;

create table public.dm_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  read_at timestamptz,
  created_at timestamptz default now() not null
);

create index idx_dm_messages_thread on public.dm_messages(thread_id);
create index idx_dm_messages_sender on public.dm_messages(sender_id);
create index idx_dm_messages_created on public.dm_messages(thread_id, created_at desc);

-- DM_REQUESTS 테이블 (비팔로워 DM 요청)
-- =========================================================
drop table if exists public.dm_requests cascade;

create table public.dm_requests (
  id uuid default gen_random_uuid() primary key,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  status text default 'pending' not null check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now() not null,
  constraint unique_request unique (from_user_id, to_user_id)
);

create index idx_dm_requests_to_user on public.dm_requests(to_user_id);
create index idx_dm_requests_status on public.dm_requests(status);

-- RLS: DM_THREADS
-- =========================================================
alter table public.dm_threads enable row level security;

-- 참가자만 조회 가능
drop policy if exists "dm_threads_select_participant" on public.dm_threads;
create policy "dm_threads_select_participant"
on public.dm_threads for select
using (
  auth.uid() = participant1_id or auth.uid() = participant2_id
);

-- 참가자만 생성 가능
drop policy if exists "dm_threads_insert_participant" on public.dm_threads;
create policy "dm_threads_insert_participant"
on public.dm_threads for insert
with check (
  auth.uid() = participant1_id or auth.uid() = participant2_id
);

-- RLS: DM_MESSAGES
-- =========================================================
alter table public.dm_messages enable row level security;

-- 스레드 참가자만 조회 가능
drop policy if exists "dm_messages_select_participant" on public.dm_messages;
create policy "dm_messages_select_participant"
on public.dm_messages for select
using (
  exists (
    select 1 from public.dm_threads
    where dm_threads.id = dm_messages.thread_id
    and (dm_threads.participant1_id = auth.uid() or dm_threads.participant2_id = auth.uid())
  )
);

-- 스레드 참가자만 메시지 추가 가능
drop policy if exists "dm_messages_insert_sender" on public.dm_messages;
create policy "dm_messages_insert_sender"
on public.dm_messages for insert
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.dm_threads
    where dm_threads.id = dm_messages.thread_id
    and (dm_threads.participant1_id = auth.uid() or dm_threads.participant2_id = auth.uid())
  )
);

-- RLS: DM_REQUESTS
-- =========================================================
alter table public.dm_requests enable row level security;

-- 보낸 사람 또는 받는 사람만 조회 가능
drop policy if exists "dm_requests_select_participant" on public.dm_requests;
create policy "dm_requests_select_participant"
on public.dm_requests for select
using (
  auth.uid() = from_user_id or auth.uid() = to_user_id
);

-- 본인만 요청 생성 가능
drop policy if exists "dm_requests_insert_sender" on public.dm_requests;
create policy "dm_requests_insert_sender"
on public.dm_requests for insert
with check (auth.uid() = from_user_id);

-- 받는 사람만 상태 변경 가능
drop policy if exists "dm_requests_update_receiver" on public.dm_requests;
create policy "dm_requests_update_receiver"
on public.dm_requests for update
using (auth.uid() = to_user_id)
with check (auth.uid() = to_user_id);
