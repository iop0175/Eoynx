-- =========================================================
-- dm_messages.content 컬럼 삭제
-- 모든 메시지는 encrypted_content에만 저장
-- =========================================================

-- content 컬럼 삭제
ALTER TABLE public.dm_messages DROP COLUMN IF EXISTS content;
