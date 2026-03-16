# WEB 댓글/알림 기능 적용 가이드 (2026-03-13)

이 문서는 WEB 기준으로 댓글 기능과 알림 기능(댓글/대댓글 좋아요 포함)을 반영하기 위한 작업 지침서입니다.

## 1) 목표 범위

- Feed 카드에서 댓글 작성/수정/삭제/좋아요
- 대댓글(답글) 구조 지원
- 댓글/대댓글 좋아요 시 알림 생성
- 댓글 삭제 정책:
  - 작성자 5분 이내 삭제: 완전 삭제
  - 작성자 5분 이후 삭제: `삭제된 메시지 입니다`
  - 게시글 작성자가 타인 댓글 삭제: `게시자에 의해 삭제됀 메시지 입니다`
- 알림 문구는 언어중립 키로 저장 후 클라이언트에서 i18n 처리

## 2) 필수 마이그레이션

아래 마이그레이션이 DB에 적용되어야 합니다.

1. `20260313190000_add_parent_id_to_comments.sql`
- `comments.parent_id` 추가 (대댓글 트리 저장)

2. `20260328140000_add_comment_like_notifications.sql`
- `comment_likes` INSERT 트리거로 `notifications` 생성
- `preview`는 언어중립 키 사용:
  - `comment_like`
  - `reply_like`

3. `20260328143000_add_comment_delete_policy_rpc.sql`
- `delete_comment_with_policy(p_comment_id uuid)` RPC 추가
- 삭제 규칙(5분/작성자/게시글 작성자) 중앙 처리

## 3) WEB 코드 반영 포인트

### 3-1. 댓글 액션

파일: `src/app/actions/comments.ts`

- `addComment(itemId, content, parentId?)`
  - `parent_id` 저장
- `deleteComment(commentId, itemId)`
  - 직접 `DELETE` 대신 RPC 호출:
    - `supabase.rpc("delete_comment_with_policy", { p_comment_id: commentId })`
  - RPC 반환 `mode`를 클라이언트가 활용 가능하게 반환

### 3-2. Feed 카드 댓글 UI

파일: `src/components/ui/feed-card.tsx`

- 댓글 삭제 시 `mode`별 UI 처리:
  - `hard`: 목록에서 제거, 카운트 감소
  - `soft_author`: 내용 치환 `삭제된 메시지 입니다`
  - `soft_owner`: 내용 치환 `게시자에 의해 삭제됀 메시지 입니다`

### 3-3. 알림 UI(i18n)

파일: `src/app/notifications/notifications-client.tsx`

- `preview`가 `comment_like/reply_like`면 언어별 문구 렌더
- 해당 타입은 미리보기 따옴표 표시 생략

## 4) 알림 설계 원칙

- DB에는 로컬라이즈된 완성 문장을 저장하지 않음
- DB에는 이벤트 키(`comment_like`, `reply_like`)만 저장
- 표시 시점에 locale 기반으로 문구 생성
- 장점:
  - 언어 추가/수정 시 데이터 마이그레이션 불필요
  - 웹/모바일 동일 이벤트를 각 UI 언어에 맞게 렌더 가능

## 5) 권한 정책 정리

- 댓글 수정: 작성자만 가능
- 댓글 삭제:
  - 작성자 가능
  - 해당 게시글 작성자 가능
- 트리거 알림:
  - 본인 행위(자기 댓글 좋아요) 알림 미생성

## 6) 수동 테스트 체크리스트

### A. 대댓글 저장
1. 댓글 작성
2. 댓글에 Reply 작성
3. DB에서 `comments.parent_id` 연결 확인

### B. 댓글 삭제 정책
1. 작성자 계정으로 댓글 생성 후 5분 이내 삭제
- 결과: 레코드 완전 삭제

2. 작성자 계정으로 댓글 생성 후 5분 이후 삭제
- 결과: 내용이 `삭제된 메시지 입니다`로 치환

3. 게시글 작성자 계정으로 타인 댓글 삭제
- 결과: 내용이 `게시자에 의해 삭제됀 메시지 입니다`로 치환

### C. 댓글 좋아요 알림
1. A가 댓글 작성
2. B가 A 댓글 좋아요
3. `notifications`에 A 대상으로 생성 확인
- `type = comment`
- `preview = comment_like` 또는 `reply_like`

### D. 다국어 알림 표시
1. 알림 생성 후 WEB locale `ko` 확인
2. WEB locale `en` 확인
3. 같은 알림이 각 언어에 맞는 텍스트로 렌더되는지 확인

## 7) 운영 시 주의사항

- RPC/트리거는 `SECURITY DEFINER`이므로 `search_path`를 고정하고, 함수 본문에서 테이블을 `public.` 스키마로 명시 유지
- 새 알림 타입을 추가할 때는:
  - DB 이벤트 키 정의
  - 웹/모바일 렌더 매핑 추가
  - 번역 리소스 업데이트

---

필요하면 다음 단계로 `댓글 soft-delete 전용 UI 배지(삭제됨/게시자 삭제)`까지 웹 컴포넌트 기준 세부 디자인 가이드를 추가할 수 있습니다.
