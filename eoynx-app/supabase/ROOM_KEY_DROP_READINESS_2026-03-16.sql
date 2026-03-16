-- DM room_key 제거 전 점검 쿼리
-- 1) room_key가 남아있는 스레드 수
select count(*) as room_key_remaining
from public.dm_threads
where room_key is not null;

-- 2) encrypted key가 없는 스레드 수
select count(*) as missing_encrypted_keys
from public.dm_threads
where encrypted_key_for_p1 is null or encrypted_key_for_p2 is null;

-- 3) 앱 코드에서 room_key 참조 제거 여부는 별도 코드 검색으로 확인 필요
--    예: rg "room_key" eoynx-app/src eoynx-mobile/src
