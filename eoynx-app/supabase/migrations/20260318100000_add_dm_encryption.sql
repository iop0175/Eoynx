-- =========================================================
-- E2E 암호화를 위한 DM 스키마 변경
-- =========================================================

-- 1. profiles 테이블에 encryption_public_key 컬럼 추가
alter table public.profiles
  add column if not exists encryption_public_key text;

comment on column public.profiles.encryption_public_key is 'RSA 공개키 (Base64 인코딩) - E2E 암호화용';

-- 2. dm_messages 테이블에 암호화 관련 컬럼 추가
-- encrypted_content: AES로 암호화된 메시지 내용
-- encrypted_key: RSA로 암호화된 AES 키
-- iv: 암호화에 사용된 IV
-- is_encrypted: 암호화 여부 플래그 (마이그레이션 호환성)

alter table public.dm_messages
  add column if not exists encrypted_content text,
  add column if not exists encrypted_key text,
  add column if not exists iv text,
  add column if not exists is_encrypted boolean default false not null;

comment on column public.dm_messages.encrypted_content is 'AES-GCM 암호화된 메시지 (Base64)';
comment on column public.dm_messages.encrypted_key is 'RSA-OAEP 암호화된 AES 키 (Base64)';
comment on column public.dm_messages.iv is '암호화 IV (Base64)';
comment on column public.dm_messages.is_encrypted is 'E2E 암호화 여부';

-- 3. 암호화된 메시지용 인덱스 추가
create index if not exists idx_dm_messages_encrypted on public.dm_messages(is_encrypted);
