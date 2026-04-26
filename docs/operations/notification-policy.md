# Notification Policy — 장기 작업 알림 정책

**버전:** 1.6 | **최종 수정:** 2026-04-26  
**원칙:** 사용자가 자리를 비워도 Task 상태 전환과 사용자 판단 필요 상황을 놓치지 않게 한다.

---

## 권위 범위

이 문서는 하네스의 외부 알림 채널, 알림 트리거, 메시지 형식, 비밀값 관리 기준의 단일 기준이다.

기본 채널은 **Slack Incoming Webhook**이다.  
이메일은 향후 fallback 채널로만 사용한다.

Slack Webhook 최초 설정 및 노출 복구 절차: [docs/guides/slack-webhook-setup.md](../guides/slack-webhook-setup.md)

---

## 비밀값 관리 규칙

Slack webhook URL은 API key와 동일한 민감 정보로 취급한다.

금지:
- 문서, Task Spec, 보고서, 작업 이력에 webhook URL 원문 기록
- 코드에 webhook URL 하드코딩
- Slack 응답 오류에 포함된 민감 URL을 그대로 출력

허용:
- `SLACK_WEBHOOK_URL` 환경변수 키 이름 참조
- 승인된 secret store에 webhook URL 저장
- 민감 URL을 마스킹한 연결 상태 보고

---

## 알림 트리거

| 트리거 | 심각도 | 알림 시점 |
|---|---|---|
| Task 시작 후 장기 실행 임계값 초과 | `INFO` | 기본 10분 초과 시 1회 |
| 사용자 판단 필요 | `ACTION_REQUIRED` | 즉시 |
| Task HOLD 발생 | `ACTION_REQUIRED` | 즉시 |
| Resource Failure 발생 | `ACTION_REQUIRED` | 즉시 |
| Validator FAIL 2회 반복 | `ACTION_REQUIRED` | Conflict Report 또는 Adjudication 진입 시 |
| Tier 3 Analyst 승인 필요 | `ACTION_REQUIRED` | Validator-A/B 둘 다 PASS 후 |
| Task COMPLETE | `INFO` | 완료 즉시 |
| Task FAILED | `CRITICAL` | 실패 확정 즉시 |

장기 실행 임계값은 Task Spec 또는 Agent 지시서에서 `notification_timeout_minutes`로 조정할 수 있다. 명시가 없으면 10분을 사용한다.

---

## 알림 메시지 원칙

Slack 메시지는 짧고 행동 가능해야 한다.

필수 포함:
- `task_id`
- `notification_status`: `RUNNING | HOLD | ACTION_REQUIRED | COMPLETE | FAILED`
- `severity`: `INFO | ACTION_REQUIRED | CRITICAL`
- 한 줄 요약
- 관련 보고서 경로

금지:
- API key, webhook URL, password, token
- PII
- 긴 로그 전문
- 전체 diff
- 외부 콘텐츠 원문

### 표시 라벨

내부 이벤트 값은 영어로 유지하되, Slack에 보이는 표시는 한국어를 사용한다.

| 내부 값 | Slack 표시 |
|---|---|
| `INFO` | 안내 |
| `ACTION_REQUIRED` | 조치 필요 |
| `CRITICAL` | 긴급 |
| `RUNNING` | 진행 중 |
| `HOLD` | 대기 |
| `COMPLETE` | 완료 |
| `FAILED` | 실패 |

---

## 표준 이벤트 모델

```json
{
  "type": "NOTIFICATION_EVENT",
  "task_id": "TASK-20260425-001",
  "severity": "INFO | ACTION_REQUIRED | CRITICAL",
  "notification_status": "RUNNING | HOLD | ACTION_REQUIRED | COMPLETE | FAILED",
  "title": "짧은 제목",
  "summary": "알림 요약",
  "report_path": "reports/TASK-20260425-001.md",
  "provider": "slack",
  "dedupe_key": "TASK-20260425-001:COMPLETE"
}
```

---

## 전송 방식

```bash
node scripts/notify-slack.mjs --title "TASK 완료" --summary "검증과 머지가 완료되었습니다." --task-id "TASK-20260425-001" --notification-status "COMPLETE" --severity "INFO"
```

CLI는 기존 호환성을 위해 `--status`도 받지만, 새 지시서와 예시는 `--notification-status`를 사용한다.  
내부 이벤트 필드명은 항상 `notification_status`다.

환경변수 `SLACK_WEBHOOK_URL`이 없으면 전송하지 않고 실패 처리한다.

---

## 실패 처리

Slack 알림 실패는 Task 결과물의 실패로 처리하지 않는다.

| 실패 | 처리 |
|---|---|
| webhook URL 없음 | 알림 실패 기록, 사용자에게 설정 필요 보고 |
| Slack 429 | backoff 후 최대 2회 재시도 |
| Slack 4xx | 설정 오류로 보고, 자동 재시도 금지 |
| Slack 5xx | backoff 후 최대 2회 재시도 |

알림 실패로 main 머지를 막지는 않는다. 단, `ACTION_REQUIRED` 알림 실패는 최종 보고서에 반드시 기록한다.
