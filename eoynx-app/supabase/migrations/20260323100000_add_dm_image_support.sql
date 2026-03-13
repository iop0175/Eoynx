-- =========================================================
-- DM 이미지 전송 지원
-- =========================================================

-- dm_messages에 이미지 URL 필드 추가
ALTER TABLE public.dm_messages
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- DM 이미지 스토리지 버킷 (이미 dm-attachments가 있을 수 있음)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dm-attachments',
  'dm-attachments',
  false,  -- 비공개 버킷 (인증된 사용자만 접근)
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 스토리지 정책: 참가자만 업로드/조회 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'DM participants can upload attachments' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "DM participants can upload attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'dm-attachments');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'DM participants can view attachments' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "DM participants can view attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'dm-attachments');
  END IF;
END $$;
