# 모바일 소셜 회귀 자동 점검 가이드 (2026-03-16)

## 실행 명령
- `npm run qa:social-regression`
- 스크립트: `scripts/social-regression-check.mjs`

## 필수 환경변수
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 점검 범위
- likes: 중복(user_id+item_id), 고아 참조(item/user)
- comments: 고아 참조(item/user/parent)
- comment_likes: 중복(user_id+comment_id), 고아 참조(comment/user)
- notifications: 고아 참조(user/actor/item/comment/thread), 타입 유효성

## 종료 코드
- `0`: 통과
- `1`: 실행 실패(환경변수/조회 오류)
- `2`: 무결성 이슈 발견
