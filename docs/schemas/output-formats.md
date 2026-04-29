# 에이전트 출력 형식

**버전:** 1.19 | **최종 수정:** 2026-04-29

이 문서는 각 에이전트가 어떤 형식으로 결과를 남겨야 하는지 정의한다.

## 기본 원칙

- 에이전트 간 전달은 JSON 중심으로 한다.
- 최종 사용자 보고는 Markdown 중심으로 한다.
- 세션 요약은 Markdown으로 남기되, 인라인 보고 원문을 우선한다.
- 세션 로그와 최종 보고서는 한국어로 작성한다. 영어는 코드 조각, 경로, 식별자처럼 꼭 필요한 경우만 허용한다.
- `tasks/specs/*.json`과 `logs/tasks/*.jsonl`은 구조화 데이터이므로 영어로 작성할 수 있다. 에이전트 전달·감사·자동 파싱을 위해 영어 사용을 권장한다.
- JSON/JSONL의 enum, phase, status, event_type, schema field는 영어를 유지한다.
- 민감 정보는 절대 출력에 포함하지 않는다.

## 출력 구분

| 구분 | 형식 | 사용 주체 |
|---|---|---|
| 에이전트 전달 | JSON | Analyst, Researcher, Generator, Validator |
| Task Spec | JSON | Analyst |
| 작업 원장 | JSON Lines | Analyst |
| 최종 보고서 | Markdown | Analyst |
| 세션 로그 | Markdown | Analyst |

언어 기준:

| 위치 | 언어 기준 | 이유 |
|---|---|---|
| `tasks/specs/*.json` | 영어 가능, 권장 | 에이전트 전달·자동 파싱 중심 |
| `logs/tasks/*.jsonl` | 영어 가능, 권장 | 이벤트 감사·자동 파싱 중심 |
| `logs/sessions/*.md` | 한국어 | 사용자가 직접 읽는 세션 기록 |
| `reports/*.md` | 한국어 | 대표·관리자·기술 리드가 읽는 최종 보고 |

## 최종 보고서 작성 기준

`reports/TASK-{ID}.md`는 대표·관리자·기술 리드가 함께 보는 공식 기록으로 작성한다. 본문은 한국어로 작성하고, 영어는 코드 조각, 경로, 식별자처럼 꼭 필요한 경우만 허용한다.

필수 원칙:

- 첫 섹션은 `핵심 요약`으로 작성한다.
- `핵심 요약`에는 상태, 결론, 서비스 영향, 검증 결과, 남은 리스크, 조치 필요 여부를 포함한다.
- 기술 상세보다 의사결정 정보를 먼저 배치한다.
- 실패, 보류, Resource Failure, 미검증 항목은 숨기지 않고 원인·영향·다음 조치를 함께 쓴다.
- 민감 정보, 긴 로그 전문, 전체 diff는 포함하지 않는다.

표준 구조는 `reports/TASK-EXAMPLE.md`를 따른다.

### 에이전트별 활동 이력 섹션 (Tier 2/3 필수)

Tier 2/3 보고서는 기존의 일반화된 "수행 결과 / 수행 과정" 묶음 대신 **에이전트별 활동 이력** 섹션을 본문 중심으로 둔다. 운영자가 "어느 에이전트가 무엇을 결정하고 어떤 도구로 어떻게 산출물을 만들었는지" 추적할 수 있어야 한다.

본문 구조 (이 순서를 따른다):

```markdown
## 에이전트별 활동 이력

### 🔵 Generator (Claude Code CLI)
- 실제 호출 여부: ✅ / ❌ (호출 안 했으면 사유 명시)
- 호출 횟수: N (시도 단위)
- 런타임 메타: claude.exe / duration / cost / turns / models / exit_status
- **실제 한 일** (substance, 1~3 문단):
  - 무엇을 받았고 어떻게 해석했나
  - 어떤 도구를 어떤 순서로 어떻게 썼나
  - 무엇을 만들었고 본문 핵심이 무엇이었나
  - 어떻게 자기 작업을 보고했나
  - 어떤 경계를 지켰나 (예: 자기-검증 안 함, target_files 외 미수정)
- 시도별 여정:
  | # | 결과 | 원인·진단·fix |

### 🟢 Validator-A (Codex CLI)
- 같은 형식. Tier 2/3 모두 적용.
- "실제 한 일"에는 어떤 파일을 어떤 목적으로 읽었는지, evidence를 어떻게 확보했는지를 narrative로 기록.

### 🟣 Validator-B (Gemini CLI)
- Tier 3에서만 등장. Validator-A와 동일 형식.
- 보안·설계 관점 검증의 substance를 강조.

### 🟡 Researcher
- 투입된 경우만. execution_mode (in-session / delegated / external_cli_fallback) 명시.
- Research Summary 핵심: 질문, 출처, confidence, snippets 요약.

### 🟠 Analyst (Orchestration)
- 모든 Task에 등장. spec 작성·handoff 발행·재시도 결정·Adjudication·머지·인사이트 캡처 활동.
- 기술 작업 자체가 아니라 흐름 관리 측면 기록.
```

각 에이전트 섹션의 작성 톤:

- "파일 X를 읽음" 같은 단순 행동 나열이 아니라 **그 행동의 의도와 의미**를 한 문장 더 붙인다. 예: "validator.md를 매 호출마다 재로드해 자기 역할 정의를 fresh execution에 박아넣었다."
- "실제 한 일"은 작업 결과가 아니라 **작업의 substance**를 보여줘야 한다. 산출 파일 경로보다 "그 파일에 무슨 내용을 어떻게 담았는지, 그 결정에 어떤 제약이 작용했는지"가 본문이다.
- 시도 여정 표는 **각 실패가 새 정보를 어떻게 생성했는지**를 보여준다. 동일 실패의 단순 재시도라면 그건 별개 이슈로 회고에 적는다.
- 외부 모델 호출이 발생한 에이전트는 actual numbers (cost, duration, turns)를 반드시 적는다. 시뮬레이션·dry-run·self-validation은 그 사실을 명시한다.

이 섹션이 최소 한 에이전트 이상에 대해 작성되지 않은 Tier 2/3 보고서는 완료 게이트에서 차단 대상이다 (보고서 stale wording 검사와 같은 수준의 강제). 제거 대안: 에이전트가 정말 투입되지 않았으면 그 에이전트 섹션을 통째로 생략하지 말고 "투입 없음 — 사유: ..." 한 줄로 명시한다.

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

Analyst가 남기는 작업 기록은 `logs/tasks/TASK-{ID}.jsonl`에 append-only 이벤트로 저장한다. 아래 `작업 원장 이벤트` 형식이 표준이다.
레거시 요약 객체를 사용할 수는 있지만, 새 작업은 `schema_version`, `event_id`, `event_type`, `task_tier`, `session_id`를 포함한 표준 이벤트 형식을 사용한다.
작업 원장 JSONL의 `summary`, `details`, `next_action`은 영어로 작성할 수 있으며, 자동 파싱과 에이전트 전달을 위해 영어 사용을 권장한다.

```json
{
  "schema_version": "work-history.v1",
  "event_id": "TASK-20260424-001-0001",
  "task_id": "TASK-20260424-001",
  "task_tier": "Tier1 | Tier2 | Tier3",
  "session_id": "SESSION-20260424-001",
  "agent": "Analyst",
  "timestamp": "ISO8601",
  "phase": "SPEC | PLANNING | DIRECTING | CONTROLLING | REPORTING",
  "event_type": "TASK_CREATED | AUDIT_NOTE | REPORT_WRITTEN | TASK_COMPLETED",
  "status": "ACTIVE | HOLD | PENDING_VALIDATION | RETRYING | COMPLETE | PARTIAL | FAILED",
  "summary": "한 줄 요약",
  "details": {},
  "artifact_refs": [],
  "redaction": {"applied": false, "notes": ""},
  "next_action": null
}
```

## 작업 원장 이벤트

`logs/tasks/TASK-{ID}.jsonl`에는 아래 형태의 이벤트를 append 한다.
이벤트 필드명과 enum 값은 항상 영어로 유지한다. 자유 텍스트 필드는 영어를 기본으로 하되, 사용자 원문 인용이 필요한 경우에만 한국어를 포함할 수 있다.

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

세션 로그는 `작업 요약`보다 `인라인 보고 원문`을 우선한다. 본문은 한국어로 작성하고, 영어는 코드 조각, 경로, 식별자처럼 꼭 필요한 경우만 허용한다.

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
- 남은 작업이 있으면 현재 기준으로 적는다.
- 남은 작업이 없으면 `없음`이라고 적는다.
```

### 세션 로그 작성 원칙

- 세션 중 사용자를 향해 남긴 인라인 보고는 누락 없이 원문 그대로 옮긴다.
- 문장 의미를 요약·재작성하지 않는다. 오탈자, 어투, 세부 내용도 원문 보존을 우선한다.
- 필요하면 `결정 사항`에 별도 요약을 추가할 수 있으나, 원문 보고를 대체할 수 없다.
- 민감 정보가 포함된 경우에만 해당 값은 마스킹하고, `redaction` 메모에 마스킹 사실을 남긴다.
- `작업 요약` 섹션은 기본적으로 사용하지 않는다.
- `다음 단계`에는 이미 완료한 항목을 남기지 않는다. 완료 전 최신 세션 로그와 최종 보고의 다음 조치가 일치해야 한다.

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

## Generator Handoff 입력

Analyst가 Claude CLI 기반 Generator를 호출할 때는 Task 단위 handoff 입력을 만든다.
이 입력은 전체 대화가 아니라 필요한 최소 컨텍스트만 포함한다.

권장 저장 위치:

```text
tasks/handoffs/TASK-{ID}/generator-input.json
```

기계 검증용 스키마:

```text
docs/schemas/generator-handoff.schema.json
```

```json
{
  "schema_version": "generator-handoff.v1",
  "task_id": "TASK-20260424-001",
  "agent": "Generator",
  "invocation": {
    "runtime": "Claude CLI",
    "fresh_session_required": true,
    "forbid_resume_or_continue": true,
    "recommended_flags": [
      "--bare",
      "--print",
      "--input-format text",
      "--output-format json",
      "--no-session-persistence"
    ]
  },
  "refs": {
    "spec": "tasks/specs/TASK-20260424-001.json",
    "ledger": "logs/tasks/TASK-20260424-001.jsonl",
    "session": "logs/sessions/SESSION-20260424-001.md"
  },
  "allowed_context": {
    "goal": "작업 목표",
    "target_files": ["수정 대상 파일"],
    "success_criteria": ["검증 가능한 완료 기준"],
    "constraints": {
      "positive": [],
      "negative": []
    },
    "research_summary": {
      "summary": "필요 시 포함",
      "confidence": "HIGH | MEDIUM | LOW | NONE",
      "snippets": [],
      "unverified_claims": []
    },
    "ledger_events": ["관련 이벤트 요약만"],
    "session_excerpts": ["필요한 사용자 의도 원문만"]
  },
  "forbidden_context": [
    "Full Analyst conversation",
    "Full CURRENT_STATE.md",
    "Unrelated ledgers or sessions",
    "Full external source documents",
    "Validator private context",
    "Secrets, credentials, PII, or environment variable values"
  ],
  "expected_output_path": "tasks/handoffs/TASK-20260424-001/generator-result.json",
  "expected_output_schema": "Generator 출력 형식"
}
```

Analyst는 `INSTRUCTION_SENT` 이벤트에 입력 경로와 Claude CLI 명령 형태를 기록한다.
Generator 결과 수신 후에는 `AGENT_RESULT_RECEIVED` 또는 `GENERATION_COMPLETED` 이벤트에 결과 경로를 기록한다.

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

## 인코딩 및 복구 규칙

- 이 문서가 정의하는 세션 로그와 최종 보고서는 UTF-8 기준으로 저장한다.
- 한글이 깨진 상태로 보이면 내용을 추측해 다시 저장하지 말고, 원본 또는 정상 커밋에서 복구한 뒤에만 수정한다.
- PowerShell로 파일을 다시 쓰기 전에 인코딩이 명시적으로 보장되는지 확인한다. 보장할 수 없으면 사용하지 않는다.
