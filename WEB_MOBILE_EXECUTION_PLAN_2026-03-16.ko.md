# 웹/모바일 통합 실행 계획 (단일 운영본)

기준일: 2026-03-16
우선순위: 웹 -> 모바일
관리 원칙: 이 문서를 실행 단일 소스로 유지하고, eoynx-app의 PROJECT_PLAN(ko/en)은 제품 비전/백로그 문서로 역할 분리

## 통합 상태 요약 (2026-03-16 최신)

완료
- 웹 성능/품질 루틴 1~2단계(검색/컬렉션, 번들 루틴, 접근성 보강) 완료
- DM room_key 평문 의존 제거 및 encrypted_key_for_p1/p2 기반 전환 완료
- 웹 DM 전송 멈춤 이슈 1차 해소(정책/상태/UI 피드백 경로 정리)
- 웹 피드 공유 -> DM 회귀 수정 완료 (암호화 전송 경로 반영, 오류/성공 피드백 보강, 재빌드/재시작 검증)
- 로컬 OAuth 리다이렉트 이슈 해소(로컬 유지)
- 모바일 DM 복호화 실패 자동 복구 반영
	- 복호화 실패 시 키 재동기화(로컬 개인키 + 서버 공개키)
	- 스레드 키 재발급 후 복호화 재시도
	- 실사용 검증 PASS
- 모바일 DM 로그 스팸 축소(메시지 단위 로그 -> 요약 경고)
- 모바일 DM 폴링 완화 및 앱 비활성 시 폴링 중지, 이미지 캐시 정책 강화
- 웹/모바일 DM 인덱스 미리보기 복구 완료
	- 웹: 전송 멈춤 해결 + 인덱스 클라이언트 복호화 미리보기 적용
	- 모바일: 인덱스/알림 preview 복구 및 decrypt failed 로그 디듀프
	- 알림 Clear All 이후 모바일 인덱스 회귀(암호화된 메시지 고정) 수정 완료
- 웹 Search/Feed 성능 1차 최적화 재개
	- Search People 링크 prefetch 제어
	- Feed likes realtime 이벤트 디바운스 적용
- 모바일 FeedScreen requestPolicy 잔여 구간 보강 완료 (DM 공유 분기 누락 에러 처리 정리)
- 웹/모바일 소셜 무결성 자동 점검 스크립트 추가 및 통합 실행 PASS
	- eoynx-app: qa:social-regression
	- eoynx-mobile: qa:social-regression
	- 루트 통합 실행: run-social-regression-all.ps1

진행 중
- 모바일 성능/배터리 최적화 2차(리스트 가상화 미세 튜닝, 저사양 기기 체감 검증)
- 웹 Search/Feed 성능 재측정 및 2차 병목 제거

남은 핵심
- requestPolicy 잔여 경로 최종 감사 + 회귀 자동화(CI 연결)
- 기존(과거) DM 알림/인덱스 preview 백필 또는 점진 치환 정책 정리
- 랜딩 페이지/공유 카드/푸시(Post-MVP 진입 전 우선순위 재평가)

## 진행 현황 업데이트 (2026-03-16)

완료
- Search 결과 카드 동적 분리 적용
- Search 필터 패널 분리 로딩 적용
- middleware -> proxy 마이그레이션 완료
- Search People 섹션 nested anchor 하이드레이션 오류 수정
- 실제 DB에 PERF DEMO 아이템 20개 삽입 완료
- 실제 DB에 PERF DEMO Collection + collection_items 20개 연결 완료
- 컬렉션 목록 링크 prefetch 비활성화 적용
- Lighthouse 안정화 스크립트 추가 (EPERM 비치명 처리 + JSON 요약)
- 모바일 App 부팅 경량화 1차 적용 (테마 즉시 반영, 랜딩 1회화, 푸시 후처리 지연)
- 모바일 Feed 리스트 virtualization / 이미지 캐시 1차 적용
- 모바일 Search/Notifications/App 요청 타임아웃·재시도·에러 메시지 공통화 1차 적용
- 웹 ShareModal DM 전송 회귀 수정 (NEXT_REDIRECT 대응 가시화, 암호화 전송 적용, 사용자 피드백 보강)
- 모바일 FeedScreen DM 공유 requestPolicy 에러 처리 누락 보강
- 소셜 회귀 자동 점검 스크립트 도입 (웹/모바일/루트 통합)

최근 측정 요약
- Search (실데이터, q=PERF): perf 75, LCP 8.2s, TBT 80ms, unused JS 약 292KiB
- Search (프로덕션, q=PERF): perf 93, LCP 3.3s, TBT 20ms, unused JS 약 26KiB
- Collection (실데이터 20개 연결 직후): perf 67, LCP 6.1s, TBT 360ms
- Collection (prefetch off 적용 후): perf 72, LCP 6.2s, TBT 290ms
- Search (프로덕션 재측정): perf 91, accessibility 93, LCP 3.6s, TBT 40ms
- Collection (프로덕션 재측정): perf 96, accessibility 98, LCP 2.7s, TBT 20ms

결정 사항
- Search는 Legacy UI 유지
- Lite 토글 실험 코드는 제거 완료

웹 2단계 착수
- 번들/성능 루틴 스크립트 추가 완료 (analyze, lh:*:prod)
- chunk 증가 알림 기준 문서화 완료 (BUNDLE_BUDGET_POLICY_2026-03-16.ko.md)

## 0) 현재 진단 요약

- 웹(Search): Lighthouse Performance 75
- 핵심 병목: LCP 6.7s, unused JS 약 328KiB
- 구조 이슈: Next middleware deprecation 경고 존재
- 모바일: Expo + Supabase 기반, 기능 범위는 확보되어 있으나 성능/안정성/운영 자동화 여지 큼

## 1) 웹 1단계 (이번 주 즉시 착수)

목표: 검색 페이지 체감 속도 개선 + 기술 부채 1건 제거

### 작업

1. 검색 페이지 JS 절감
- 검색 화면의 무거운 클라이언트 컴포넌트를 지연 로딩(dynamic import)으로 분리
- 초기 렌더에 필수 아닌 기능(부가 패널, 보조 위젯) 후순위 로딩
- 아이콘/유틸 import 범위를 최소화
- 상태: 일부 완료 (동적 분리/패널 분리 완료, 큰 단위 unused JS 절감은 진행 중)

2. LCP 단축
- 검색 결과 상단의 LCP 후보(대표 이미지/헤드라인) 우선 렌더 경로 정리
- Above-the-fold 리소스 우선도 재조정(중요 이미지/텍스트 우선)
- 상태: 진행 중 (첫 카드 이미지 우선 로딩 반영)

3. middleware -> proxy 마이그레이션
- deprecated 경고 제거
- 기존 canonical redirect + session update 동작 동일성 유지
- 상태: 완료

4. 측정 안정화
- Lighthouse 스크립트 실행 조건 고정(포트/환경/대상 URL)
- 0점 리포트 발생 시 실패 처리(리포트 품질 게이트)
- 상태: 완료 (scripts/lighthouse-run.mjs + npm scripts 적용)

### 완료 기준 (Definition of Done)

- Search Performance 85+ (최소)
- LCP 4.0s 이하
- middleware deprecation 경고 제거
- Lighthouse 측정 실패(0점) 재발 방지

## 2) 웹 2단계 (다음 주)

목표: 신뢰성/운영성 강화

### 작업

1. 번들 가시성 강화
- analyze 리포트 주간 확인 루틴 확립
- 페이지별 chunk 증가 알림 기준 설정
- 상태: 진행 중 (analyze 및 prod Lighthouse 스크립트 표준화 완료)

2. 캐시/데이터 패칭 정책 정교화
- 검색/피드 경로의 revalidate 전략 분리
- 불필요한 재요청 제거
- 상태: 1차 완료 (search: revalidate=60, feed: force-dynamic/revalidate=0)

3. 접근성 보강
- Search 입력/결과 영역 키보드 동선 최적화
- 알림/토스트 role, label 검증
- 상태: 완료 (Search ARIA 보강 + 프로덕션 접근성 재측정)

### 완료 기준

- Search Performance 90 내외 유지
- 주요 화면 AXE/Lighthouse 접근성 95+

## 3) 모바일 1단계 (웹 1단계 완료 후)

목표: 앱 초기 반응성 + 네트워크 안정성 개선

### 작업

1. 앱 부팅 경량화
- App 진입 시 동기/대기 작업 최소화
- 세션/테마/푸시 처리 순서 재정렬(초기 페인트 우선)
- 상태: 1차 완료 (themeReady 대기 제거, 랜딩 최초 1회만 재생, 푸시 등록/최근 응답 처리를 첫 인터랙션 이후로 지연)

2. 목록 렌더 성능 개선
- 리스트 virtualization 튜닝
- 이미지 컴포넌트 캐시 전략 통일
- 상태: 1차 완료 (Feed FlatList window/batch 튜닝, expo-image cachePolicy 통일 적용)

3. API/에러 처리 표준화
- Supabase 요청 공통 에러 매핑
- 재시도/타임아웃 정책 통일
- 상태: 1차 완료 (requestPolicy 유틸 추가, App/Search/Notifications 주요 경로 공통 적용)

### 완료 기준

- 첫 화면 진입 시간 유의미 개선
- 피드 스크롤 드랍 프레임 감소
- 주요 에러 케이스 사용자 메시지 일관화

### 현재 판단

- 첫 화면 진입 시간: 개선 반영 완료, 기기 체감/계측 확인 필요
- 피드 스크롤 드랍 프레임: Feed 기준 1차 개선 반영 완료, 저사양/실데이터 확인 필요
- 주요 에러 메시지 일관화: App/Search/Notifications 1차 완료, 나머지 Add/DM/Profile 계열 확장 필요

## 4) 모바일 2단계

목표: 제품 완성도 강화

### 작업

1. 딥링크/푸시 라우팅 안정화
- 알림 유형별 이동 경로 회귀 테스트

2. 오프라인/저연결 UX
- 재시도, 임시 저장, 실패 복구 UX 정의

3. 관측성(Observability)
- 크래시/네트워크 실패 지표 대시보드화

### 완료 기준

- 푸시 클릭 후 목적 화면 도달률 개선
- 저연결 환경 이탈률 감소

## 5) 바로 실행할 체크리스트 (오늘)

1. [완료] 웹 Search 경로에서 지연 로딩 후보 식별/적용
2. [완료] middleware -> proxy 전환
3. [완료] Lighthouse 실행 스크립트/품질 게이트 정리 (EPERM cleanup 대응)
4. [완료] 변경 전/후 성능 비교표 1차 작성

## 6) 다음 작업 (즉시)

1. [완료] Search unused JS 상위 청크 분해 계획 수립 및 1차 적용
2. [완료] Collection 페이지 TBT 추가 하향(목표 250ms 이하)
3. [완료] Lighthouse 재현성 확보를 위한 단일 실행 스크립트 추가
4. [완료] 웹 1단계 종료 기준 재평가 (프로덕션 기준 목표 충족)
5. [진행 예정] 소셜 회귀 자동 점검을 CI에 연결 (실패 시 배포 차단)
6. [진행 예정] DM preview 과거 데이터 정책(백필 vs 점진 갱신) 확정

## 7) 통합 백로그 (실행용)

P0
- [ ] requestPolicy 잔여 경로 최종 감사 및 CI 회귀 게이트 연결
- [ ] 모바일 DM 화면 저사양 기기에서 배터리/발열/스크롤 체감 재검증
- [ ] DM preview 과거 데이터 표시 정책 확정 (백필 vs 점진 갱신)

P1
- [ ] 모바일 리스트 가상화 추가 튜닝(초기 렌더량/윈도우 사이즈 실측 기반)
- [ ] Search/Feed 프로덕션 재측정 후 2차 최적화 항목 확정

P2
- [ ] 랜딩 페이지(SEO 카피/구조 확정)
- [ ] 9:16 공유 카드 생성 파이프라인
- [ ] 푸시(FCM/APNs) 도입 설계

## 8) 다음 스프린트 실행표 (통합)

기간: 2026-03-17 ~ 2026-03-23

| 우선순위 | 작업 | 담당 | 완료조건(DoD) |
|---|---|---|---|
| P0 | requestPolicy 확장 (Add/DM/Profile) | Copilot | 3경로 타임아웃/재시도/오류문구 통일 + 타입체크 통과 |
| P0 | 모바일 DM 저사양 성능 검증 | 운영자 | 15분 사용 시 과열/과배터리 이슈 미재현, 복호화/수신 안정성 유지 |
| P0 | DM preview 과거 데이터 정책 확정 | Copilot + 운영자 | 백필/점진갱신 중 1안 확정 + 적용 절차 문서화 |
| P1 | 모바일 리스트 가상화 2차 튜닝 | Copilot | 스크롤 프레임 드랍 체감 개선 + 주요 화면 회귀 없음 |
| P1 | Search/Feed 2차 성능 조정 | Copilot | 프로덕션 재측정 후 LCP/TBT 개선 항목 2건 이상 반영 |
| P2 | 랜딩 페이지 IA/카피 확정 | 운영자 | 섹션 구조/핵심 카피/CTA 확정안 문서화 |
| P2 | 공유 카드 9:16 스펙 정의 | Copilot + 운영자 | 템플릿 규격/데이터 소스/생성 트리거 정의 완료 |

리스크
- 정책 회귀: DM canSend 계산과 서버 차단 로직 불일치 재발 가능
- 성능 회귀: 폴링/실시간 조합 변경 시 일부 기기에서 알림 지연 체감 가능

---

## 참고 파일

- eoynx-app/next.config.ts
- eoynx-app/src/proxy.ts
- eoynx-mobile/App.tsx
- eoynx-app/SECURITY_ROTATION_AND_DM_REGRESSION_2026-03-16.ko.md
