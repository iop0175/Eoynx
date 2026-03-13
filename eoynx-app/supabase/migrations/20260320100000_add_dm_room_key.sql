-- =========================================================
-- DM방별 대칭키 암호화 마이그레이션
-- =========================================================

-- dm_threads에 방 암호화 키 저장 (Base64 인코딩)
alter table public.dm_threads
add column if not exists room_key text,  -- AES 256-bit 키 (Base64)
add column if not exists encrypted_key_for_p1 text,  -- deprecated (기존 호환용)
add column if not exists encrypted_key_for_p2 text,  -- deprecated (기존 호환용)
add column if not exists key_iv text;                -- deprecated (기존 호환용)
