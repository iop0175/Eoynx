# 모바일 DM 저사양 검증 체크리스트 (2026-03-16)

## 목적
- 15분 실사용 기준 발열/배터리/스크롤/복호화 안정성 점검
- 동일 절차 재실행 가능하도록 데이터(로그/메모리/프레임) 자동 수집

## 준비
- Android 디바이스 USB 연결 및 `adb devices` 인식 확인
- 앱 패키지명 확인
- DM 테스트 계정 2개 준비

## 자동 수집 실행
- 스크립트: `scripts/mobile-dm-lowend-check.ps1`
- 예시 실행:
  - `powershell -ExecutionPolicy Bypass -File scripts/mobile-dm-lowend-check.ps1 -PackageName com.your.app -DurationMinutes 15 -SampleIntervalSeconds 30`

## 수동 시나리오(15분)
1. DM 인박스 진입 -> 스레드 목록 스크롤 2분
2. DM 스레드 2~3개 왕복 이동 3분
3. 텍스트 메시지 송수신 5분
4. 이미지 첨부 송수신 3분
5. 백그라운드/포그라운드 전환 2분

## 판정 기준
- 치명 오류
  - 앱 크래시/멈춤 없음
  - 복호화 실패 고정 상태 없음
- 성능
  - 스크롤 체감 드랍 심각 구간 없음
  - 메모리 급증(지속 증가) 패턴 없음
- 배터리/발열
  - 짧은 시간 과도 발열 재현 없음
  - 배터리 소모 비정상 급증 없음

## 산출물
- `perf-artifacts/dm_lowend_타임스탬프/`
  - `logcat.txt`
  - `sample_XXX-meminfo.txt`
  - `sample_XXX-gfxinfo.txt`
  - `sample_XXX-battery.txt`
  - `session-meta.txt`

## 후속 처리
- 이슈 발견 시
  - 재현 시각/동작/로그 구간 기록
  - requestPolicy/폴링/리스트 virtualization 우선순위로 원인 분류
