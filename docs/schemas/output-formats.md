# 에이전트 출력 형식

**버전:** 1.12 | **최종 수정:** 2026-04-26

이 문서는 각 에이전트가 어떤 형식으로 결과를 남겨야 하는지 정의한다.

## 기본 원칙

- 에이전트 간 전달은 JSON 중심으로 한다.
- 최종 사용자 보고는 Markdown 중심으로 한다.
- 세션 요약은 Markdown으로 남기되, 인라인 보고 원문을 우선한다.
- 민감 정보는 절대 출력에 포함하지 않는다.

## 출력 구분

| 구분 | 형식 | 사용 주체 |
|---|---|---|
| 에이전트 전달 | JSON | Analyst, Researcher, Generator, Validator |
| 최종 보고서 | Markdown | Analyst |
| 세션 로그 | Markdown | Analyst |

## 최종 보고서 작성 기준

`reports/TASK-{ID}.md`는 대표·관리자·기술 리드가 함께 보는 공식 기록으로 작성한다.

필수 원칙:

- 첫 섹션은 `Executive Summary`로 작성한다.
- `Executive Summary`에는 상태, 결론, 서비스 영향, 검증 결과, 남은 리스크, 조치 필요 여부를 포함한다.
- 기술 상세보다 의사결정 정보를 먼저 배치한다.
- 실패, 보류, Resource Failure, 미검증 항목은 숨기지 않고 원인·영향·다음 조치를 함께 쓴다.
- 민감 정보, 긴 로그 전문, 전체 diff는 포함하지 않는다.

표준 구조는 `reports/TASK-EXAMPLE.md`를 따른다.

## Analyst 지시문

Analyst는 다른 에이전트에게 작업을 지시할 때 아래 구조를 쓴다.

지시문을 만들기 전 Analyst는 아래 인수인계 소스를 이 순서로 확인한다.

```text
1. tasks/specs/TASK-{ID}.json
2. logs/tasks/TASK-{ID}.jsonl
3. logs/sessions/SESSION-{ID}.md
4. artifact_refs / changed_files / 실제 산출물
```

지시문에는 전체 파일 전문이 아니라 해당 에이전트에게 필요한 최소 내용만 넣는다.
다만 `success_criteria`와 `constraints.negative`는 의미가 바뀌지 않게 보존한다.

```json
{
  "agent": "Researcher | Generator | Validator-A | Validator-B",
  "task_id": "TASK-20260424-001",
  "instruction": "구체적인 실행 지시",
  "input": {
    "spec_ref": "tasks/specs/TASK-20260424-001.json",
    "ledger_ref": "logs/tasks/TASK-20260424-001.jsonl",
    "session_ref": "logs/sessions/SESSION-20260424-001.md",
    "spec": "작업에 필요한 핵심 요구사항",
    "context": "해당 에이전트가 꼭 알아야 할 추가 정보"
  },
  "expected_output": "원하는 출력 형식과 내용",
  "deadline": "선택 사항"
}
```

## Analyst 작업 기록

Analyst가 남기는 작업 기록은 `logs/tasks/TASK-{ID}.jsonl`에 append-only로 저장한다.

```json
{
  "task_id": "TASK-20260424-001",
  "agent": "Analyst",
  "started_at": "ISO8601",
  "completed_at": "ISO8601",
  "status": "COMPLETE | FAILED | RETRYING | HOLD",
  "phase": "SPEC | PLANNING | DIRECTING | CONTROLLING | REPORTING",
  "input_summary": "받은 요청 요약",
  "actions": [
    {
      "timestamp": "ISO8601",
      "action": "수행한 일",
      "result": "결과 요약",
      "notes": "추가 메모"
    }
  ],
  "output_summary": "사용자에게 남길 최종 요약",
  "tier_changes": "필요 시 기록",
  "errors": [],
  "insights": [
    {
      "tag": "[NEW_RULE] | [UPDATE_RULE] | [NEW_PATTERN] | [CAUTION]",
      "content": "관찰 내용"
    }
  ]
}
```

## 작업 원장 이벤트

`logs/tasks/TASK-{ID}.jsonl`에는 아래 형태의 이벤트를 append 한다.

```json
{
  "schema_version": "work-history.v1",
  "event_id": "TASK-20260426-007-0001",
  "task_id": "TASK-20260426-007",
  "task_tier": "Tier1 | Tier2 | Tier3",
  "session_id": "SESSION-20260426-001",
  "timestamp": "2026-04-26T00:55:00+09:00",
  "agent": "Analyst | Researcher | Generator | Validator-A | Validator-B",
  "phase": "SPEC | PLANNING | RESEARCH | GENERATION | VALIDATION | ADJUDICATION | REPORTING | NOTIFICATION | GUIDE_UPDATE",
  "event_type": "TASK_CREATED | INSTRUCTION_SENT | AGENT_RESULT_RECEIVED | GENERATION_COMPLETED | VALIDATION_RESULT | RESOURCE_FAILURE | REBUTTAL_SUBMITTED | ADJUDICATION_COMPLETED | NOTIFICATION_SENT | MERGE_COMPLETED | REPORT_WRITTEN | GUIDE_UPDATED | CORRECTION | AUDIT_NOTE | TASK_COMPLETED",
  "status": "ACTIVE | HOLD | PENDING_VALIDATION | RETRYING | COMPLETE | PARTIAL | FAILED",
  "summary": "한 줄 요약",
  "details": {},
  "artifact_refs": [],
  "redaction": {
    "applied": false,
    "notes": ""
  },
  "next_action": null
}
```

`작업 원장 이벤트.status`는 `task_status` 값만 사용한다. 알림 상태는 `notification_status` 필드에 기록한다.

## 세션 로그 형식

세션 로그는 `작업 요약`보다 `인라인 보고 원문`을 우선한다.

```markdown
# SESSION-YYYYMMDD-NNN

## 범위
- 작업 시간:
- 주요 TASK:
- 목적:

## 인라인 보고 원문
- [HH:MM] ...
- [HH:MM] ...

## 결정 사항
- ...

## 변경 파일
- ...

## 다음 단계
- ...
```

### 세션 로그 작성 원칙

- 세션 중 사용자를 향해 남긴 인라인 보고는 누락 없이 원문 그대로 옮긴다.
- 문장 의미를 요약·재작성하지 않는다. 오탈자, 어투, 세부 내용도 원문 보존을 우선한다.
- 필요하면 `결정 사항`에 별도 요약을 추가할 수 있으나, 원문 보고를 대체할 수 없다.
- 민감 정보가 포함된 경우에만 해당 값은 마스킹하고, `redaction` 메모에 마스킹 사실을 남긴다.
- `작업 요약` 섹션은 기본적으로 사용하지 않는다.

## Researcher 출력

```json
{
  "task_id": "TASK-20260424-001",
  "agent": "Researcher",
  "status": "COMPLETE | FAILED",
  "summary": "조사 결과 요약",
  "sources": [
    {
      "title": "문서명",
      "url": "출처 URL",
      "relevance": "HIGH | MEDIUM | LOW",
      "snippet": "핵심 발췌"
    }
  ],
  "confidence": "HIGH | MEDIUM | LOW | NONE",
  "confidence_rationale": "판단 근거",
  "unverified_claims": ["확인되지 않은 항목"],
  "log": [
    {
      "timestamp": "ISO8601",
      "action": "수행 내용",
      "result": "결과 요약"
    }
  ]
}
```

## Generator 출력

```json
{
  "task_id": "TASK-20260424-001",
  "agent": "Generator",
  "status": "PENDING_VALIDATION",
  "branch": "task/TASK-20260424-001",
  "artifacts": [
    {
      "type": "code | config | test | doc",
      "path": "파일 경로",
      "description": "변경 내용",
      "change_type": "CREATE | MODIFY | DELETE"
    }
  ],
  "change_summary": "변경 요약",
  "self_review": "자가 검토 내용",
  "tier_reclassification_needed": false,
  "tier_reclassification_reason": "필요 시 기록",
  "log": [
    {
      "timestamp": "ISO8601",
      "action": "수행 내용",
      "result": "결과 요약"
    }
  ]
}
```

## Validator 출력

```json
{
  "task_id": "TASK-20260424-001",
  "agent": "Validator-A | Validator-B",
  "tool": "Codex CLI | Gemini CLI",
  "tier": "Tier2 | Tier3",
  "verdict": "PASS | FAIL",
  "criteria_results": [
    {
      "criterion": "검증 항목",
      "result": "PASS | FAIL",
      "detail": "세부 내용"
    }
  ],
  "errors": [
    {
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "evidence_type": "EXECUTION_PROVEN | STATIC_PROVEN | SPEC_MISMATCH | INFERRED_RISK | SPEC_INTERPRETATION",
      "location": "파일 경로:줄번호",
      "description": "오류 설명",
      "suggestion": "수정 방향",
      "evidence": "근거"
    }
  ],
  "github_commit": "PASS일 때만 사용",
  "tier_reclassification_needed": false,
  "tier_reclassification_reason": "필요 시 기록",
  "log": [
    {
      "timestamp": "ISO8601",
      "action": "수행 내용",
      "result": "결과 요약"
    }
  ]
}
```

## 상태 코드

상태 값은 용도별로 분리한다. Task 상태, 알림 상태, 심각도를 한 필드에 섞지 않는다.

### task_status

| 코드 | 의미 |
|---|---|
| `ACTIVE` | 작업 진행 중 |
| `HOLD` | 보류 |
| `PENDING_VALIDATION` | 검증 대기 |
| `RETRYING` | 재시도 중 |
| `COMPLETE` | 완료 |
| `PARTIAL` | 일부 완료 |
| `FAILED` | 실패 |

### notification_status

| 코드 | 의미 |
|---|---|
| `RUNNING` | 진행 중 알림 |
| `HOLD` | 대기 알림 |
| `ACTION_REQUIRED` | 사용자 또는 운영자 조치 필요 |
| `COMPLETE` | 완료 알림 |
| `FAILED` | 실패 알림 |

### severity

| 코드 | 의미 |
|---|---|
| `INFO` | 안내 |
| `ACTION_REQUIRED` | 조치 필요 |
| `CRITICAL` | 긴급 |
