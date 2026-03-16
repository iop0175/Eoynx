# Search Console 제출 전 점검 체크리스트 (2026-03-13)

이 체크리스트는 현재 정책(로그인 사용자는 /feed 이동, 비로그인/크롤러는 SEO 랜딩 유지)을 기준으로 작성되었습니다.

## 0) 우선 색인 URL 목록 (제출 순서)

1. 1순위 핵심 허브
- /
- /search

2. 2순위 대표 엔티티
- /u/[실제공개핸들] (대표 공개 프로필)
- /i/[실제공개아이템ID] (대표 공개 아이템)

3. 3순위 카테고리 유입 랜딩
- /search?category=Luxury
- /search?category=Accessories
- /search?category=Cars
- /search?category=Real-Estate

4. 4순위 대량 제출(자동)
- sitemap.xml 기반 공개 프로필 /u/[handle]
- sitemap.xml 기반 공개 아이템 /i/[id]
- sitemap.xml 기반 공개 컬렉션 /c/[id]

권장 제출 전략:
- 먼저 1순위 2개 URL을 수동 제출해 크롤링 반응을 확인합니다.
- 다음 2순위 2개 URL을 제출해 엔티티 페이지 색인 품질을 확인합니다.
- 이후 sitemap 재제출로 3순위/4순위를 일괄 확장합니다.

## 1) 루트 URL(/) 응답 검증

1. 비로그인 브라우저로 / 접속 시 200 응답 + 랜딩 HTML 렌더 확인
2. 로그인 브라우저로 / 접속 시 /feed 이동 확인
3. Googlebot UA로 / 요청 시 200 응답 + 랜딩 HTML 확인
4. Bingbot, Twitterbot UA에서도 200 랜딩 확인

권장 확인 명령(예시):
- curl -A "Mozilla/5.0" https://도메인/
- curl -A "Googlebot/2.1 (+http://www.google.com/bot.html)" https://도메인/

## 2) 색인 가능성

1. / 페이지가 robots 차단(noindex/disallow) 상태가 아닌지 확인
2. canonical이 /로 정확히 설정되는지 확인
3. 랜딩 내 핵심 텍스트가 서버 렌더 결과에 포함되는지 확인
4. JS 의존 없이 기본 콘텐츠가 확인 가능한지 확인

## 3) sitemap/robots

1. sitemap.xml에 / 포함 여부 확인
2. robots.txt에서 / 차단 규칙 없는지 확인
3. /feed 등 인증 필요 페이지는 색인 제외 정책 점검

### 3-1) 응답 검증 시나리오 (실행용)

1. robots.txt 응답 상태/본문 확인
- curl -i https://도메인/robots.txt
- 기대값: HTTP 200, sitemap 경로 포함, /feed /auth /api 등 차단 규칙 포함

2. sitemap.xml 응답 상태/본문 확인
- curl -i https://도메인/sitemap.xml
- 기대값: HTTP 200, urlset 내 /, /search, /u/, /i/, /c/ URL 포함

3. robots 규칙 일관성 확인
- robots에서 허용된 경로(/, /search, /u/, /i/, /c/)가 sitemap에 실제 존재하는지 확인
- robots에서 차단된 경로(/auth, /feed, /settings, /dm, /api, /debug)가 sitemap에 없어야 함

4. 캐시/CDN 영향 확인
- curl -I https://도메인/robots.txt
- curl -I https://도메인/sitemap.xml
- 기대값: 비정상 캐시(오래된 Last-Modified, 잘못된 Content-Type, 3xx 루프) 없음

5. Search Console 재수집 트리거
- robots/sitemap 변경 후 Search Console에서 sitemap.xml 재제출
- URL 검사에서 /, /search를 실시간 테스트 후 색인 생성 요청

### 3-2) 문제 발생 시 즉시 조치

1. robots.txt가 404/5xx면 배포 라우팅과 빌드 산출물 우선 점검
2. sitemap.xml이 404/5xx면 데이터 접근 권한 및 서버 런타임 오류 확인
3. sitemap에 차단 URL이 포함되면 생성 로직에서 즉시 제외 필터 추가
4. robots와 sitemap 정책 충돌 시 robots를 기준으로 sitemap를 재정렬

## 4) 리다이렉트 정책 검증

1. 로그인 사용자에만 리다이렉트가 적용되는지 확인
2. 크롤러 UA는 리다이렉트 대상에서 제외되는지 확인
3. 리다이렉트 체인(다중 3xx) 없는지 확인
4. 불필요한 301/302 반복이 없는지 확인

## 5) Search Console 실검증

1. URL 검사: / 입력 -> 실시간 테스트 실행
2. 크롤링 가능 여부 확인(robots, 접근성, 렌더링)
3. "색인 생성 요청" 제출
4. 커버리지 보고서에서 제외/오류 원인 확인

## 6) 성능/품질(권장)

1. 모바일 친화성 테스트 통과
2. Core Web Vitals(특히 LCP) 점검
3. 주요 랜딩 이미지 alt/title 점검
4. 구조화 데이터(있다면) 유효성 점검

## 7) 문제 발생 시 우선 대응

1. /가 3xx로 크롤러에 응답하면 즉시 분기 로직 점검
2. robots/noindex 문제면 메타/robots 설정 우선 수정
3. 렌더링 이슈면 서버 렌더 HTML에 핵심 카피 포함되도록 수정
4. 캐시/CDN 룰로 크롤러 응답이 바뀌는지 확인

## 8) Search Console 제출 당일 실행 순번표

1. 사전 상태 점검 (5분)
- [x] /robots.txt, /sitemap.xml HTTP 200 확인
- [x] /, /search 렌더 및 canonical 확인

2. 우선 URL 수동 제출 1차 (10분)
- [x] / URL 검사 -> 실시간 테스트 -> 색인 생성 요청
- [x] /search URL 검사 -> 실시간 테스트 -> 색인 생성 요청

3. 우선 URL 수동 제출 2차 (10분)
- [ ] /u/[실제공개핸들] URL 검사 -> 실시간 테스트 -> 색인 생성 요청
- [ ] /i/[실제공개아이템ID] URL 검사 -> 실시간 테스트 -> 색인 생성 요청

4. 카테고리 랜딩 제출 (10분)
- [ ] /search?category=Luxury
- [ ] /search?category=Accessories
- [ ] /search?category=Cars
- [ ] /search?category=Real-Estate

5. sitemap 재제출 (5분)
- [ ] Search Console Sitemaps에서 sitemap.xml 재제출
- [ ] 처리 상태가 가져올 수 있음으로 표시되는지 확인

6. 당일 확인 포인트 기록 (5분)
- [ ] 제출한 URL 목록과 제출 시각 기록
- [ ] 실시간 테스트 결과(크롤링 가능/불가) 기록
- [ ] 발생한 경고/오류 메시지 스냅샷 저장

7. 제출 후 모니터링
- [ ] +24시간: 커버리지/페이지 인덱싱 상태 확인
- [ ] +72시간: 우선 URL 색인 여부 재확인
- [ ] +7일: 노출/클릭 추세 확인 후 내부 링크 조정 여부 판단

## 9) 체크박스 실행 로그 템플릿

### 9-1) 사전 점검
- [x] /robots.txt HTTP 200 확인
- [x] /sitemap.xml HTTP 200 확인
- [x] / canonical 확인
- [x] /search canonical 확인

### 9-2) URL 검사/제출
- [x] / 제출 완료 (시간: 사용자 완료)
- [x] /search 제출 완료 (시간: 사용자 완료)
- [ ] /u/[실제공개핸들] 제출 완료 (시간: ____)
- [ ] /i/[실제공개아이템ID] 제출 완료 (시간: ____)
- [ ] /search?category=Luxury 제출 완료 (시간: ____)
- [ ] /search?category=Accessories 제출 완료 (시간: ____)
- [ ] /search?category=Cars 제출 완료 (시간: ____)
- [ ] /search?category=Real-Estate 제출 완료 (시간: ____)

### 9-3) sitemap 재제출
- [ ] sitemap.xml 재제출 완료 (시간: ____)
- [ ] 가져올 수 있음 상태 확인

### 9-4) 오류/경고 기록
- [ ] 실시간 테스트 경고 없음
- [ ] 경고/오류 스냅샷 저장
- [ ] 조치 내용 기록

메모:
- 발생 이슈:
- 조치 내용:
- 재검증 결과:

### 9-5) 사후 모니터링
- [ ] +24시간 점검 완료
- [ ] +72시간 점검 완료
- [ ] +7일 점검 완료
- [ ] 추가 내부링크/콘텐츠 조정 여부 결정

---

필요하면 다음 단계로 실제 운영 도메인 기준 "검증용 curl 스크립트"와 "제출 후 모니터링 플랜(7일/30일)"도 작성 가능합니다.
