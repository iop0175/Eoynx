-- =========================================================
-- DM방 room_key 컬럼 추가 (평문 AES 키)
-- =========================================================

alter table public.dm_threads
add column if not exists room_key text;
