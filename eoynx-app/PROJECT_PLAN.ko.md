# EOYNX — 프로젝트 계획서 (MVP)

> 오너: 대장 (Las Vintkl)
>
> Repo: `C:\git\Eoynx\eoynx-app`
>
> 스택: Next.js (App Router) + Supabase (Postgres/Auth/Storage) + Vercel
>
> 원칙: **SEO 우선**(공개 프로필/아이템) → 바이럴(퍼센타일/공유) → 네이티브(Expo) 2차

## 0) 노스스타(North Star)
**프로필과 아이템이 검색에 걸리는(public-first) 럭셔리 컬렉션 커뮤니티**를 만든다.

### 성공 신호(MVP)
- 공개 프로필 페이지가 인덱싱되고 오가닉 노출이 발생
- 공개 아이템 페이지가 인덱싱되고 롱테일 유입이 발생
- 공유 링크로 재방문이 발생(바이럴 루프의 초기 신호)

## 1) 범위(Scope)

### MVP(현재)
- 공개 페이지(SEO):
  - 프로필: `/u/[handle]`
  - 아이템: `/i/[id]`
  - 컬렉션: `/u/[handle]/collections`, `/c/[id]`
  - 검색: `/search` (People + Items 섹션)
- 앱 페이지(noindex):
  - 피드: `/feed` (public-only feed)
  - Add 플로우: `/add`, `/add/details` (photos-first, visibility segmented)
  - DM: `/dm`, `/dm/requests`, `/dm/[threadId]` (스켈레톤)
  - 설정: `/settings`
  - 로그인 진입: `/auth`
- 가시성(Visibility):
  - `public` (SEO 인덱싱)
  - `unlisted` (링크 공개; **noindex**)
  - `private` (오너만)
- Value 모델(2트랙):
  - Unverified(셀프)
  - Verified(중앙값 + 범위 + 출처)

### Post-MVP
- Google + email/password 로그인 UX 완성
- DM 실제 구현(threads/messages, requests 게이팅)
- 댓글(Public + Unlisted)
- 퍼센타일/공유 카드(9:16) 생성
- 푸시 알림(DM/댓글/팔로우)
- 네이티브 앱(Expo)

## 2) 제품 정책(확정)
- 기본 아이템 가시성: **Public**
- Unlisted: 링크 있으면 열람 가능, 다만 `robots: noindex, nofollow`
- Private: RLS로 오너만, 페이지는 notFound 처리
- Feed: **Public only**
- Collections:
  - Public 컬렉션은 인덱싱 허용
  - Private 컬렉션은 오너만

## 3) 정보구조(라우트)

### Public/SEO
- `/` 마케팅 랜딩(인덱싱)
- `/u/[handle]` 공개 프로필(인덱싱)
- `/i/[id]` 아이템(공개일 때 인덱싱)
- `/u/[handle]/collections` (인덱싱)
- `/c/[id]` 컬렉션 디테일(공개 컬렉션만 인덱싱)
- `/search` (현재 인덱싱; 필요시 정책 변경 가능)

### App/noindex
- `/feed` 피드(noindex)
- `/add`, `/add/details` (noindex)
- `/dm`, `/dm/requests`, `/dm/[threadId]` (noindex)
- `/settings` (noindex)
- `/auth` (noindex)
- `/debug/supabase` (noindex)

## 4) 데이터 모델(Supabase)

### 테이블(현재 완전판 스키마)
- `profiles` (id=auth.users.id, handle, display_name, bio, avatar_url, timestamps)
- `items` (owner_id, title, description, visibility, image_url, timestamps)
- `item_values` (track, currency, minor_unit, value_minor, verified_*_minor, sources)
- `verified_sources` (item_value_id, label, url)
- `collections` (owner_id, name, description, is_public)
- `collection_items` (collection_id, item_id, position)
- `followers` (follower_id, following_id, created_at) ← **신규**

### 구현 메모
- 금액/가치는 **minor units(bigint)** + currency + minor_unit
- 가입 시 프로필 자동 생성: `on_auth_user_created` 트리거
- followers 테이블로 프로필 팔로우/팔로잉 카운트 가능

## 5) 보안/권한

### RLS 규칙(MVP)
- `profiles`: 모두 조회 가능, 본인만 수정
- `items`: public/unlisted는 모두 조회, private는 오너만 조회, 쓰기는 오너만
- `item_values`/`verified_sources`: 부모 아이템이 보이면 같이 보임
- `collections`: public은 모두 조회, private는 오너만, 쓰기는 오너만
- `collection_items`: 부모 컬렉션이 보이면 조회 가능, 쓰기는 오너만
- `followers`: 모두 조회 가능, 팔로워 본인만 생성/삭제

### SEO robots 규칙(앱 레벨)
- Unlisted: `noindex, nofollow`
- Private/NotFound: noindex + notFound
- Debug/Auth/Settings/Add/DM/Feed: noindex

## 6) 현재 구현 상태(코드)

### ✅ 빌드 상태
- `npm run lint` PASS
- `npm run build` PASS

### ✅ 핵심 시스템
- **i18n**: `next-intl` 한국어(ko) + 영어(en) 지원
  - 브라우저 언어 자동 감지
  - 설정 페이지에서 언어 전환
  - 번역 파일: `messages/ko.json`, `messages/en.json`
- **테마**: 다크/라이트 모드 토글 (Tailwind v4)
  - `@custom-variant dark` 클래스 기반 전환
  - localStorage 저장
  - 시스템 설정 감지

### ✅ 데이터베이스 연동
- 프로필 페이지: Stats (Items/Followers/Following) 실제 데이터 연동
- 프로필 페이지: 아이템 목록 DB 연동
- 아이템 상세: Verified value + sources
- 검색: 실시간 사용자 + 아이템 검색
- 피드: 공개 아이템 피드
- 컬렉션: 목록 + 상세 페이지

### ✅ 아이템 CRUD (완료)
- **Create**: 단일 폼 추가 페이지 + 멀티 이미지 업로드 (대표 이미지 + 서브 이미지)
- **Read**: 이미지 슬라이더가 있는 아이템 상세 페이지
- **Update**: 이미지 관리가 있는 수정 폼
- **Delete**: 삭제 확인 및 제거

### ✅ 피드 & 검색 UI
- 피드: 카테고리 탭 (For you, Luxury, Accessories, Cars, Real Estate)
- 피드: FeedCard (유저 헤더, 이미지 슬라이더, 좋아요/댓글/공유/북마크 버튼)
- 검색: FeedCard를 사용하여 피드 스타일로 아이템 표시

### ✅ 프로필 시스템
- 프로필 페이지: 아바타, 표시명, 소개, 팔로우/메시지 버튼
- 프로필 페이지: "Top X%" 통계 표시
- 프로필 페이지: 카테고리 탭 (Overall, Luxury, Accessories, Cars)
- 프로필 페이지: 2열 아이템 그리드 (좋아요/공유 포함)
- 프로필 설정: 아바타 업로드/삭제, 표시명 수정, 소개 수정 (160자)
- 네비게이션: 로그인 사용자 기반 동적 프로필 링크

### ✅ 이미지 관리
- 멀티 이미지 업로드 + 미리보기
- 이미지 슬라이더 (좌우 화살표 네비게이션)
- 대표 이미지 + 서브 이미지 지원
- 스토리지 버킷: `items` (이미지당 5MB 제한)
- 아바타 스토리지: `avatars` 버킷 (2MB 제한)

### ✅ Figma 기반 스켈레톤 커버리지
- Top bar: icon-only (Feed/Search/Add/DM/Settings/Profile)
- Search: People + Items 섹션 (현재 FeedCard 사용)
- Collections: 목록 + 디테일
- Item: Visibility + Verified value block + sources chips
- DM: inbox/requests/thread 스켈레톤
- Add: 단일 폼 (사진 + 세부정보 통합)

## 7) 해야 할 일 (To-Do List)

### 우선순위 1 — 소셜 기능
- [ ] 팔로우/언팔로우 기능 (followers 테이블 insert/delete)
- [ ] 좋아요 기능 (아이템)
- [ ] 북마크/저장 기능 (아이템)
- [ ] 팔로워/팔로잉 수 실시간 업데이트

### 우선순위 2 — SEO & 마케팅
- [ ] 프로필/아이템 OG 이미지
- [ ] 메타 태그 및 설명 설정
- [ ] sitemap.xml 생성
- [ ] robots.txt 설정
- [ ] 랜딩 페이지 (/) 디자인

### 우선순위 3 — 컬렉션
- [ ] 컬렉션 생성 플로우
- [ ] 아이템을 컬렉션에 추가
- [ ] 아이템이 포함된 컬렉션 상세 페이지
- [ ] 공개/비공개 컬렉션 토글

### 우선순위 4 — 댓글 ✅
- [x] 데이터베이스에 댓글 모델
- [x] 아이템 상세에서 댓글 목록
- [x] 댓글 추가 기능
- [x] 댓글 수 표시

### 우선순위 5 — DM 시스템 ✅
- [x] 실제 메시지 스레드 (스켈레톤 아님)
- [x] 메시지 보내기/받기
- [x] 비팔로워 DM 요청
- [x] 읽지 않은 메시지 표시

### 우선순위 6 — 알림 ✅
- [x] 알림 시스템 설계
- [x] 새 팔로워 알림
- [x] 좋아요/댓글 알림
- [x] DM 알림

### 추후 (Post-MVP)
- [ ] 퍼센타일 랭킹 시스템
- [ ] 공유 카드 (9:16 포맷)
- [ ] 푸시 알림
- [ ] 네이티브 앱 (Expo)
- [ ] 출처가 있는 검증된 가치 시스템

## 8) 마일스톤(권장)

### M1 — Public SEO 루프
- `/u/[handle]`, `/i/[id]`, `/search`를 실제 데이터로 안정화
- OG/metadata 최종
- sitemap/robots.txt

### M2 — Create 플로우
- Storage 업로드 + `items` insert
- visibility 변경 UI

### M3 — Social primitives
- 컬렉션 저장 플로우
- likes/bookmarks

### M4 — DM + 알림
- threads/messages 실구현 + requests
- 푸시 알림

## 8) 리스크/가드레일
- 토큰은 repo 밖(`.env.local`, Vercel secrets)
- RLS 검증(Private 유출 금지)
- abuse 대응(block/report/레이트리밋)

## 9) 배포
- Vercel
- 도메인:
  - `eoynx.com` (마케팅/SEO)
  - `app.eoynx.com` (앱 셸, 추후)

---

## 부록 — Figma 레퍼런스
Figma file: `2xEA9d6UMcgA1UyHWKZQWl`
- Mobile/Web 핵심 화면 세트(v20260309-1649)
