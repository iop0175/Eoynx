# 소셜 회귀 자동 점검 실행 가이드 (2026-03-16)

## 목적
- 좋아요/댓글/알림 데이터 무결성 회귀를 일괄 점검
- 배포 전후 빠른 스모크 체크 용도

## 실행 스크립트
- `npm run qa:social-regression`
- 스크립트 파일: `scripts/social-regression-check.mjs`

## 필수 환경변수
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 체크 항목
- likes
  - 사용자-아이템 중복 여부
  - item/user 참조 고아 데이터 여부
- comments
  - item/user/parent comment 참조 고아 데이터 여부
- comment_likes
  - 사용자-댓글 중복 여부
  - comment/user 참조 고아 데이터 여부
- notifications
  - user/actor/item/comment/thread 참조 고아 데이터 여부
  - 허용 타입 외 레코드 여부

## 종료 코드
- `0`: 이상 없음
- `1`: 실행 실패(환경변수 누락, 조회 오류 등)
- `2`: 무결성 이슈 발견

## 참고
- row 수가 많아도 배치 조회(range)로 순차 점검됨
- 운영 DB에 쓰기 작업은 하지 않음(읽기 전용 점검)
