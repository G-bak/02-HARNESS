# Slack Webhook 설정 가이드

**버전:** 1.1 | **최종 수정:** 2026-04-26  
**목적:** 하네스 알림 채널(Slack Incoming Webhook) 최초 설정 및 장애 복구  
**대상:** 저장소 관리자 (에이전트 아님)

---

## 1. Slack App 생성 및 Webhook URL 발급

1. 알림용 채널을 만든다.
   - 권장 이름: `#agent-harness-alerts`
   - 운영 Task 알림과 일반 대화 채널을 분리한다.

2. Slack App을 생성한다.
   - https://api.slack.com/apps 접속
   - `Create New App` → `From scratch`

3. Incoming Webhooks를 활성화한다.
   - App 설정 → `Incoming Webhooks`
   - `Activate Incoming Webhooks` 켜기

4. Webhook URL을 발급한다.
   - `Add New Webhook to Workspace`
   - 알림 받을 채널 선택
   - 생성된 Webhook URL 복사 (`https://hooks.slack.com/services/...`)

---

## 2. 로컬 환경 설정

로컬에서는 `.env` 파일에 저장한다. 저장소에 커밋하지 않는다.

```text
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

`.gitignore`에 `.env`가 포함되어 있는지 확인한다.

---

## 3. 배포 환경 설정

Cloudflare Worker 또는 기타 배포 환경에서는 secret store에 등록한다.

```bash
wrangler secret put SLACK_WEBHOOK_URL
# 프롬프트에 webhook URL 붙여넣기
```

PowerShell 환경에서 임시 세션 변수로 사용할 경우:

```powershell
$env:SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/..."
```

---

## 4. 연결 테스트

```bash
node scripts/notify-slack.mjs --title "테스트" --summary "연결 확인" --task-id "TEST-001" --notification-status "COMPLETE" --severity "INFO"
```

Slack 채널에 메시지가 도착하면 정상이다.

---

## 5. Webhook URL 노출 시 복구 절차

URL이 코드, 로그, 문서에 노출된 경우:

1. Slack App 설정에서 기존 Webhook URL 폐기
2. 새 Webhook URL 발급 (위 1~4단계 반복)
3. secret store의 `SLACK_WEBHOOK_URL` 값 교체
4. `.env` 파일 값 교체
5. 노출된 URL이 포함된 로그·문서·커밋을 확인하고 마스킹 처리

> 에이전트가 직접 조치하지 않는다 — 관리자가 수행한다.
