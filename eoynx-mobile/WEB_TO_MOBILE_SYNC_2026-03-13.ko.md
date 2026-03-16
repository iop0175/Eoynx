# WEB -> MOBILE 적용 가이드 (2026-03-13)

이 문서는 오늘 WEB에 추가/변경된 기능을 MOBILE(React Native)에도 동일하게 반영하기 위한 작업 지침서입니다.

## 1) 회원가입 동의 플로우

### 1-1. 이메일 회원가입
- 요구사항:
  - 회원가입 시 개인정보 수집/이용 동의 체크 필수
  - 동의 문서 열람 링크 제공
  - 동의 미체크 시 가입 요청 차단
- 모바일 구현 포인트:
  - SignUp 화면에 필수 체크박스 추가
  - 동의서 보기 버튼 추가 (앱 내 웹뷰 또는 외부 브라우저)
  - submit payload에 privacyConsent 포함

### 1-2. Google 가입/로그인
- 현재 WEB 동작:
  - 기존 로그인 사용자는 추가 동의 없이 로그인 가능
  - Google로 신규 계정 생성되는 경우에만 OAuth 직후 동의 화면으로 이동
  - 동의 후에만 최종 진입
- 모바일 구현 포인트:
  - Google OAuth 완료 후 user metadata의 privacy_consent 확인
  - false/null이면 Consent Gate 화면으로 라우팅
  - Consent Gate에서 동의 시 updateUser metadata 저장 후 메인 진입

### 1-3. 저장해야 하는 메타데이터
- privacy_consent: true
- privacy_consent_version: "2026-03-13"
- privacy_consent_at: ISO timestamp

## 2) 회원 탈퇴 플로우

### 2-1. UX
- 설정 화면에 회원 탈퇴 버튼 추가
- 탈퇴 실행 전 "DELETE" 문자열 입력 필수
- 입력값 불일치 시 실행 차단

### 2-2. 서버/API
- WEB은 Supabase RPC delete_my_account 호출 방식
- MOBILE도 동일 RPC 호출 권장

### 2-3. 에러/성공 처리
- 실패: 설정 화면에 에러 표시
- 성공: 로그아웃 처리 후 인증 화면으로 이동
- 재가입 테스트: 동일 이메일 재가입 가능해야 함

## 3) 네비게이션 정책 변경

### 3-1. Settings 진입 위치
- 상단 공통 내비게이션에서 Settings 분리
- 내 프로필 화면 내부에 Settings 바로가기 배치

### 3-2. 모바일 반영
- Bottom/Top 탭에서 Settings 항목 제거(사용 중이면)
- 내 프로필 액션 영역에 Settings 버튼 추가

## 4) Supabase 마이그레이션 확인

모바일 동작 일치 위해 아래 DB 상태가 반영되어 있어야 함:
- delete_my_account RPC 존재
- 최신 delete_my_account 함수(폴백 로직 포함) 적용

체크 방법:
- Supabase SQL Editor에서 함수 존재 여부 확인
- 또는 로컬에서 migration 상태 확인

## 5) 모바일 작업 체크리스트

1. Auth SignUp UI에 동의 체크 + 동의서 링크 추가
2. Email SignUp 요청 시 privacyConsent 필드 전달
3. Google OAuth 후 privacy_consent 검사 로직 추가
4. Consent Gate 화면(동의 강제) 추가
5. 동의 완료 시 metadata 업데이트 API 연결
6. Settings에 회원 탈퇴 섹션 추가
7. DELETE 확인 입력 + 탈퇴 실행 + 로그아웃 연결
8. 내비게이션에서 Settings 제거(해당 시)
9. 프로필 화면에 Settings 바로가기 추가
10. 재가입 시나리오 수동 테스트 (Email/Google 각각)

## 6) 권장 테스트 시나리오

### A. 이메일 회원가입
1. 동의 미체크 -> 가입 실패 확인
2. 동의 체크 -> 가입 성공 확인

### B. Google 신규 가입
1. OAuth 성공 후 Consent Gate 진입 확인
2. 동의 후 메인 진입 확인

### C. 기존 Google 로그인
1. Consent Gate 없이 로그인되는지 확인

### D. 회원 탈퇴
1. DELETE 미입력 -> 차단 확인
2. DELETE 입력 -> 탈퇴/로그아웃 확인
3. 동일 이메일 재가입 가능 확인

---

필요하면 다음 단계로 MOBILE 기준 상세 구현안(화면별 상태관리, API 호출 예시, 에러코드 매핑표)까지 이어서 작성 가능.
