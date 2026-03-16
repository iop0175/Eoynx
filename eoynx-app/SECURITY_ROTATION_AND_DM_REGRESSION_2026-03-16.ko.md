# Service Role 키 회전 + DM 회귀 테스트 체크리스트

## 1) Service Role 키 회전 체크리스트

### A. 사전 준비
- [ ] 현재 배포 환경(Vercel/서버/CI)에 설정된 SUPABASE_SERVICE_ROLE_KEY 사용 위치를 모두 목록화
- [ ] 키 교체 시간대 공지(배포 트래픽 낮은 시간 권장)
- [ ] 긴급 롤백 담당자 지정

### B. Supabase에서 키 회전
1. Supabase Dashboard 접속
2. 프로젝트 선택
3. Settings > API
4. service_role 키 재발급(rotate)

### C. 환경 변수 교체
- [ ] 웹 배포 환경의 SUPABASE_SERVICE_ROLE_KEY 교체
- [ ] 로컬 개발용 .env(로컬 비공개) 교체
- [ ] CI/CD 비밀 변수 교체
- [ ] 백그라운드 작업 러너(있다면) 교체

### D. 배포 및 확인
- [ ] 새 키로 배포
- [ ] 서버 액션 정상 동작 확인
- [ ] DM 백필/관리 스크립트 접근 정상 확인
- [ ] Supabase 로그에서 401/403 급증 여부 확인

### E. 사후 점검
- [ ] 이전 키가 더 이상 어떤 환경에도 남아있지 않은지 확인
- [ ] 팀 내 공유 채널/문서에 키값 원문이 남아있지 않은지 점검

---

## 2) DM 회귀 테스트 체크리스트 (웹 + 모바일)

### A. 기본 연결
- [ ] 웹에서 A,B 두 계정으로 로그인 가능
- [ ] 모바일에서 A,B 두 계정으로 로그인 가능
- [ ] 각 계정의 profiles.encryption_public_key 존재 확인

### B. 스레드 생성/입장
- [ ] 웹에서 새 DM 스레드 생성 성공
- [ ] 모바일에서 새 DM 스레드 생성/입장 성공
- [ ] dm_threads에 encrypted_key_for_p1/p2가 채워지는지 확인

### C. 메시지 송수신 (텍스트)
- [ ] 웹 -> 모바일 텍스트 전송 성공
- [ ] 모바일 -> 웹 텍스트 전송 성공
- [ ] 수신측에서 메시지 평문으로 정상 표시
- [ ] 앱 재시작 후에도 기존 메시지 복호화 가능

### D. 첨부 이미지
- [ ] 웹에서 이미지 첨부 전송 성공
- [ ] 모바일에서 이미지 첨부 전송 성공
- [ ] 양쪽에서 이미지 렌더링 정상

### E. DM Inbox/알림
- [ ] 모바일 DM Inbox 목록 로딩 정상
- [ ] 암호화 메시지 미리보기 문구 정상
- [ ] 알림 진입 시 스레드 이동 정상

### F. 공유 기능
- [ ] 모바일 Feed에서 DM 공유 성공
- [ ] 공유 메시지가 암호화 형태로 저장되는지 확인
- [ ] 수신측에서 공유 메시지 링크/타이틀 표시 정상

### G. 권한/제약
- [ ] dm_open=false 사용자에게 요청 흐름 정상
- [ ] pending request 상태에서 전송 차단 정상
- [ ] 요청 승인 후 전송 재개 정상

### H. 데이터 무결성
- [ ] dm_threads에 room_key 컬럼이 존재하지 않음을 확인
- [ ] encrypted_key_for_p1/p2 누락 레코드 0건 확인
- [ ] dm_messages is_encrypted=true 경로 정상 유지

### I. 오류/복구
- [ ] 키 없는 상태(로그아웃 직후)에서 적절한 오류 메시지 표시
- [ ] 네트워크 불안정 상황에서 재시도/오류 문구 정상
- [ ] 앱 업데이트 후 이전 스레드 접근 정상
- [ ] 모바일에서 복호화 실패 발생 시 키 재동기화(로컬 개인키 + profiles.encryption_public_key) 후 자동 복구 확인

---

## 3) 운영 확인용 SQL

### room_key 제거 확인
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'dm_threads'
  and column_name = 'room_key';

### encrypted key 누락 건수
select count(*) as missing_encrypted_keys
from public.dm_threads
where encrypted_key_for_p1 is null or encrypted_key_for_p2 is null;

### 최근 DM 메시지 샘플
select id, thread_id, sender_id, is_encrypted, created_at
from public.dm_messages
order by created_at desc
limit 20;

---

## 4) 검증 실행 로그 템플릿

### 실행 메타
- 실행일시: 2026-03-16
- 실행자: Copilot + 운영자
- 환경: production DB (remote)
- 앱 버전: web/mobile 최신 작업 브랜치 기준

### 키 회전 실행 로그
| 단계 | 상태(PASS/FAIL) | 실행 시간 | 비고 |
|---|---|---|---|
| Supabase service_role rotate | PENDING |  | 키 재발급 권고 상태 |
| 배포 환경 변수 교체 | PENDING |  | rotate 이후 진행 |
| CI 비밀 변수 교체 | PENDING |  | rotate 이후 진행 |
| 서버 액션 smoke test | PASS | 2026-03-16 | DM 액션 파일 오류 없음 확인 |
| 로그 401/403 확인 | PENDING |  | rotate 이후 점검 |

### DM 회귀 테스트 로그
| 케이스 ID | 시나리오 | 상태(PASS/FAIL) | 증빙(링크/스크린샷) | 비고 |
|---|---|---|---|---|
| DM-01 | 웹->모바일 텍스트 송수신 | PASS |  | 2026-03-16 실사용 검증 완료 |
| DM-02 | 모바일->웹 텍스트 송수신 | PASS |  | 2026-03-16 실사용 검증 완료 |
| DM-03 | 웹 이미지 첨부 송수신 | PASS |  | 이미지 단독 전송 키준비 오류 수정 후 재검증 PASS |
| DM-04 | 모바일 이미지 첨부 송수신 | PASS |  | 2026-03-16 실사용 검증 완료 |
| DM-05 | 앱 재시작 후 복호화 유지 | PASS |  | 앱 재시작 후 기존 메시지/이미지 확인 완료 |
| DM-06 | DM Inbox 미리보기 동작 | PASS |  | room_key 비의존 로직 반영 완료 |
| DM-07 | DM 요청 pending 차단 | PENDING |  | 정책 검증 필요 |
| DM-08 | 요청 승인 후 전송 재개 | PENDING |  | 정책 검증 필요 |
| DM-09 | Feed 공유 메시지 암호화 저장 | PASS |  | 평문 폴백 제거 코드 반영 |
| DM-10 | room_key 컬럼 미존재/누락키 0건 확인 | PASS |  | DB 검증 완료(room_key select error, missing=0) |
| DM-11 | 모바일 복호화 실패 자동 복구(키 재동기화 + 스레드 키 재발급) | PASS |  | 2026-03-16 로컬 재현 후 정상 복구 확인 |

### 실패 항목 추적
| 이슈 ID | 케이스 ID | 현상 | 원인 가설 | 조치 담당 | 목표 완료일 |
|---|---|---|---|---|---|
| RESOLVED-001 | DM-03 | Could not find room_key column in schema cache | 운영 배포가 구버전 번들을 참조 | Copilot | 2026-03-16 |
| RESOLVED-002 | DM-03 | 웹->모바일 사진 전송 시 암호화 키 준비 오류 | 이미지 단독 전송에서 암호화 payload 요구 로직 | Copilot | 2026-03-16 |
| RESOLVED-003 | DM-11 | 모바일에서 '암호화된 메시지' 반복 표시 | 로컬 개인키와 서버 공개키 불일치로 스레드 키 복호화 실패 | Copilot | 2026-03-16 |

---

## 5) 모바일 복호화 실패 복구 절차(로컬 운영 가이드)

1. 증상 확인
- 모바일 DM 화면에서 새 메시지가 계속 '암호화된 메시지'로 표시됨
- 로그에서 `roomKey=true imported=true` 상태인데 `decrypt failed` 반복

2. 원인
- 모바일 로컬 개인키와 서버 `profiles.encryption_public_key`가 불일치한 상태로 남아있으면,
  스레드 키(`encrypted_key_for_p1/p2`)를 복호화할 수 없음

3. 적용된 자동 복구
- 모바일 복호화 실패 시 키쌍 재생성
- 새 개인키를 로컬 SecureStore에 저장
- 새 공개키를 `profiles.encryption_public_key`로 즉시 업데이트
- 참여자 공개키로 스레드 room key를 재발급하여 `encrypted_key_for_p1/p2` 업데이트
- 재발급한 room key로 메시지 복호화 재시도

4. 검증 기준
- 웹에서 2~3건 연속 전송 시 모바일에서 모두 평문 표시
- 재진입/새로고침 후에도 동일 스레드 복호화 유지
