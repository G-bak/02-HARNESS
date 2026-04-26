# Work History Policy

**버전:** 1.9 | **최종 수정:** 2026-04-27

이 문서는 작업 이력의 저장 위치, 기록 시점, 책임 주체를 정의한다.

## 목적

- 모든 작업의 시작, 진행, 종료를 추적할 수 있게 한다.
- 세션 단위 요약과 작업 단위 원장을 분리한다.
- 사용자에게 보여준 설명과 기록을 최대한 같은 흐름으로 유지한다.

## 저장 위치

```text
logs/
  tasks/
    TASK-YYYYMMDD-NNN.jsonl
  sessions/
    SESSION-YYYYMMDD-NNN.md
  insights.jsonl

reports/
  TASK-YYYYMMDD-NNN.md

CURRENT_STATE.md
```

| 위치 | 용도 | 형식 | 작성 주체 |
|---|---|---|---|
| `logs/tasks/TASK-{ID}.jsonl` | 작업 원장, 이벤트 append-only | JSON Lines | Analyst |
| `logs/sessions/SESSION-{YYYYMMDD}-{NNN}.md` | 세션 요약, 진행 중 갱신 | Markdown | Analyst |
| `logs/insights.jsonl` | 장기 인사이트 누적 | JSON Lines | Analyst |
| `reports/TASK-{ID}.md` | 최종 보고서 | Markdown | Analyst |
| `CURRENT_STATE.md` | 현재 세션의 기준 상태 | Markdown | Analyst |

## 핵심 규칙

1. 새 요청이 들어오면 가장 먼저 `TASK-{ID}.jsonl`을 만든다.
2. `TASK_CREATED` 이벤트를 작업 시작 전에 기록한다.
3. 작업 중 발생한 중요한 상태 변화는 같은 `TASK` 원장에 append 한다.
4. `TASK_COMPLETED` 이후에는 신규 작업 이벤트를 추가하지 않는다. 단, 기록 오류 정정이나 감사 메모는 `CORRECTION` 또는 `AUDIT_NOTE` 성격으로만 append 할 수 있다.
5. 기존 이벤트는 수정하지 않고 append-only로 유지한다.
6. 민감 정보는 원장이나 세션 로그에 남기지 않는다.
7. Tier 1 단순 작업(문구 수정, 헤더 포맷 통일 등)은 TASK 원장 파일 생략 가능.
   이 경우 세션 로그에 `[TASK-{ID}] {변경 요약} → PASS` 형식 단일 라인 기록 필수.
   단, 신규 정책 결정·보안 관련 변경·복수 파일에 걸친 정책 변경은 경량화 불가 — 원장 필수.

## 활성 Task와 작업공간 상태

작업 중 생성되는 원장, 세션 로그, Task Spec 파일은 정상적인 dirty worktree를 만든다.
따라서 완료 게이트는 `CURRENT_STATE.md`만 보지 않고 `logs/tasks/*.jsonl`에서 아직 `TASK_COMPLETED`가 없는 활성 Task도 함께 확인한다.

규칙:

- `TASK_CREATED`가 있고 `TASK_COMPLETED`가 없는 원장은 활성 Task로 본다.
- 활성 Task가 있으면 현재 dirty worktree를 직전 완료 Task의 누락으로 오판하지 않는다.
- Task 완료 직전에는 여전히 clean/dirty 상태를 보고해야 하며, 미커밋 상태로 완료하려면 명시적 사유가 필요하다.
- `CURRENT_STATE.md`는 세션 인수인계 기준이므로 장기 작업에서는 활성 Task와 다음 단계를 갱신한다.

## 세션 로그 생성 시점

세션 로그는 작업이 끝난 뒤에만 만드는 파일이 아니다.

- 작업을 수행하는 세션에는 `logs/sessions/SESSION-YYYYMMDD-NNN.md`를 하나 생성하거나, 이미 열린 세션 로그를 재사용한다.
- 새 Task를 시작할 때 현재 세션 로그가 없으면 Phase 0에서 생성한다.
- 동일 세션의 여러 Task는 같은 세션 로그에 누적할 수 있다.
- 세션이 진행되는 동안 중요한 결정, 실패, 재시도, 배포 결과를 계속 추가한다.
- 세션이 끝나면 최종 요약과 다음 행동을 정리한다.
- 세션 로그와 최종 보고서는 한국어로 작성한다. 영어는 코드 조각, 경로, 식별자처럼 꼭 필요한 경우만 허용한다.

즉, 세션 로그는 다음처럼 동작한다.

- 시작 시 생성
- 진행 중인 로그가 있으면 재사용
- 진행 중 누적 갱신
- 종료 시 마무리 정리

생략 가능 예외:

```text
단일 명령 출력 확인처럼 사용자 업데이트가 거의 없고 파일 변경이 없는 초소형 Task
```

이 경우에도 `TASK_COMPLETED.details.session_log_skipped_reason`에 생략 사유를 남긴다.

생략 절대 금지:

```text
파일 변경이 1건이라도 있으면 session_log_skipped_reason 사용 불가 — 세션 로그 필수
```

## 세션 로그 우선순위

세션 로그는 `작업 요약`보다 `인라인 보고 원문`을 우선한다.

- 세션 중 사용자에게 보낸 인라인 보고를 누락 없이 원문 그대로 옮긴다.
- 요약, 문장 재작성, 세부 내용 삭제로 원문 보고를 대체하지 않는다.
- 세션 종료 시에는 그 보고를 짧게 정리해서 `결정 사항`에 반영한다.
- 기본 템플릿에서는 별도의 `작업 요약` 섹션을 두지 않는다.

### 인라인 보고 원문 보존 규칙

Analyst가 사용자에게 보낸 중간 보고는 운영 기록의 일부다.

필수:

```
[ ] 사용자에게 보낸 모든 commentary/inline update를 세션 로그에 원문 그대로 기록
[ ] 시간 순서를 유지
[ ] 최종 요약과 별개로 보존
[ ] 민감 정보가 있으면 값만 마스킹하고 문맥은 보존
```

금지:

```
[ ] "검토 진행함"처럼 축약해서 대체
[ ] 사용자의 판단에 영향을 준 세부 설명 삭제
[ ] 최종 보고만 남기고 중간 보고 누락
```

## 세션 종료 요약 규칙

세션이 끝날 때 작성하는 최종 요약은, 사용자에게 전달한 최종 설명과 같은 흐름이어야 한다.

권장 방식:

- 작업 중에는 짧고 정확한 인라인 업데이트를 남긴다.
- 세션 종료 시에는 그 내용을 정리해서 세션 로그에 반영한다.
- 사용자에게 보낸 최종 요약과 세션 로그의 결론은 의미가 일치해야 한다.
- 인라인 보고 원문 섹션은 결론 일치 여부와 별개로 원문 보존을 우선한다.

이 규칙의 목적은 말한 내용과 기록된 내용이 따로 놀지 않게 하는 것이다.

### 다음 단계 정합성 규칙

세션 로그의 `## 다음 단계`는 현재 남은 작업만 적는다.

필수:

```
[ ] Task 완료 전, 세션 로그의 `## 다음 단계`를 현재 상태와 대조한다
[ ] 이미 완료한 항목은 삭제하거나 완료 사실로 갱신한다
[ ] 남은 작업이 없으면 `- 없음`으로 명시한다
[ ] `CURRENT_STATE.md`에 활성 Task 없음으로 기록할 경우, 최신 세션 로그의 다음 단계도 남은 작업 없음과 일치해야 한다
```

금지:

```
[ ] 이미 완료한 작업을 다음 단계로 남겨두기
[ ] 예전 평가 결과의 다음 단계 목록을 그대로 방치하기
[ ] 최종 보고와 세션 로그의 다음 단계가 서로 다른 상태를 가리키게 하기
```

완료 직전 자동 감사에서 최신 세션 로그의 `## 다음 단계`가 stale 상태이면 `TASK_COMPLETED`를 기록하지 않는다.

## Git 상태 인수인계 규칙

Git 저장소 모드에서 작업한 경우 세션 로그와 최종 보고는 아래 상태를 반드시 남긴다.

필수:

```
[ ] 현재 브랜치
[ ] 워킹트리 clean/dirty 여부
[ ] main과 origin/main의 ahead/behind 상태
[ ] task 브랜치 커밋 여부 (Tier 2/3)
[ ] main squash merge 여부 (Tier 2/3)
[ ] push 완료 여부 (미완료 = 작업 미완료)
```

금지:

```
[ ] main에 반영하지 않았는데 완료로 표현
[ ] push하지 않았는데 원격 반영 완료로 표현
[ ] push 없이 작업 완료로 처리
[ ] dirty worktree를 정상 완료처럼 숨기기
```

commit/merge/push는 항상 세트다. 모든 작업은 push까지 완료해야 `TASK_COMPLETED`를 기록할 수 있다.

필수:

```
[ ] push 전 `git status --short --branch` 기록
[ ] `git push origin main` 수행
[ ] push 후 `git status --short --branch` 기록
[ ] `TASK_COMPLETED.details.push_status`를 `PUSHED`로 기록
[ ] push 실패 시 `TASK_COMPLETED` 대신 HOLD/PARTIAL/FAILED 중 하나로 상태 처리
```

## `TASK` 원장에 기록하는 시점

아래 이벤트는 원칙적으로 `logs/tasks/TASK-{ID}.jsonl`에 기록한다.

| 시점 | 이벤트 |
|---|---|
| 작업 시작 | `TASK_CREATED` |
| 지시 전달 | `INSTRUCTION_SENT` |
| 중간 결과 수신 | `AGENT_RESULT_RECEIVED` |
| 생성 완료 | `GENERATION_COMPLETED` |
| 검증 결과 | `VALIDATION_RESULT` |
| 도구/할당/쿼터 문제 | `RESOURCE_FAILURE` |
| 반박 제출 | `REBUTTAL_SUBMITTED` |
| 판단 완료 | `ADJUDICATION_COMPLETED` |
| 알림 발송 | `NOTIFICATION_SENT` |
| 배포/병합 완료 | `MERGE_COMPLETED` |
| 보고서 작성 | `REPORT_WRITTEN` |
| 가이드 갱신 | `GUIDE_UPDATED` |
| 기록 정정 | `CORRECTION` |
| 감사 메모 | `AUDIT_NOTE` |
| 작업 종료 | `TASK_COMPLETED` |

## 세션 로그에 기록하는 내용

세션 로그는 작업의 흐름을 사람이 빠르게 이해할 수 있도록 적는다.

- 세션 시작 시간
- 주요 TASK 목록
- 중요한 결정 사항
- 검증 또는 배포 결과
- 사용자에게 보낸 최종 요약과 같은 결론
- 다음 세션에서 이어갈 일

## 책임 분리

| 주체 | 책임 |
|---|---|
| Analyst | TASK 원장 생성, 세션 로그 갱신, 최종 보고서 작성 |
| Researcher | 조사 결과를 Analyst에게 전달 |
| Generator | 코드/문서 변경 결과를 Analyst에게 보고 |
| Validator-A/B | 검증 결과를 Analyst에게 보고 |

## 완료 조건

작업을 완료로 처리하려면 아래가 충족되어야 한다.

- `logs/tasks/TASK-{ID}.jsonl`에 `TASK_COMPLETED`가 존재해야 한다.
- 보고서 게이트에 따라 `reports/TASK-{ID}.md`가 작성되어야 한다.
- 품질 점수 게이트에 따라 `logs/quality-scores.jsonl`에 점수가 기록되어야 한다.
- 파일 변경이 1건이라도 있으면 `logs/sessions/SESSION-{YYYYMMDD}-{NNN}.md` 갱신이 **commit보다 먼저** 완료되어야 한다.

**세션 로그 갱신은 git add/commit 이전 마지막 단계다. 순서를 바꾸지 않는다.**

```
올바른 순서:
1. TASK_COMPLETED 기록
2. 세션 로그 갱신  ← 여기를 빠뜨리지 않는다
3. git add (세션 로그 포함)
4. git commit
5. git push

금지:
TASK_COMPLETED → git commit → 세션 로그 (순서 역전)
TASK_COMPLETED → git commit → 세션 로그 생략
```

Tier 2/3 추가 완료 조건:

- `VALIDATION_RESULT`가 존재해야 한다. 가이드 유지보수나 legacy 보정처럼 Validator를 생략한 경우 `TASK_COMPLETED.details.validation_omission_reason`에 사유를 남긴다.
- git 저장소 모드에서 완료하는 경우 `MERGE_COMPLETED`가 존재해야 한다. 머지를 수행하지 않은 로컬/가이드 보정 작업은 `TASK_COMPLETED.details.merge_omission_reason`에 사유를 남긴다.
- 완료 시점에 작업공간이 dirty라면 `TASK_COMPLETED.details.git_dirty_allowed_reason`에 사유를 남긴다. 이 사유는 임시 허용이며, 제품 코드 작업에서는 사용할 수 없다.
- Task Spec SSOT가 `tasks/specs/TASK-{ID}.json`, `TASK_CREATED.details.spec`, `TASK_CREATED.details.spec_path` 중 하나로 존재해야 한다. Legacy 작업은 `CORRECTION.details.legacy_spec_omission_reason`이 있어야 감사 통과가 가능하다.

### 보고서 게이트

| 상황 | 보고서 처리 |
|---|---|
| Tier 1 일반 작업 | 파일 보고서 선택. 인라인 보고와 원장으로 완료 가능 |
| Tier 1 운영 규칙/가이드 변경 | 보고서 권장. 변경 근거가 남아야 하는 경우 작성 |
| Tier 1 사용자 요청 | 사용자가 보고서를 요청하면 필수 |
| Tier 2 | `reports/TASK-{ID}.md` 필수 |
| Tier 3 | `reports/TASK-{ID}.md` 필수 |
| HOLD / Resource Failure / FAILED | 상태·원인·영향·다음 조치 보고서 필수 |
| Adjudication | 판정 근거와 채택/기각 사유 보고서 필수 |

보고서가 필수인 상황에서 보고서를 작성하지 못하면 `TASK_COMPLETED`를 기록하지 않는다.

### 품질 점수 게이트

| 상황 | 품질 점수 처리 |
|---|---|
| Tier 1 일반 작업 | 선택 |
| Tier 1 운영 규칙/가이드 변경 | 필수 |
| Tier 2 | 필수 |
| Tier 3 | 필수 |
| HOLD / Resource Failure | 완료 전까지 보류. Resource Failure 자체는 품질 실패로 채점하지 않음 |
| FAILED | 필수. 실패 원인과 프로세스 점수를 반영 |

품질 점수를 생략하는 경우:

```json
{
  "quality_score_skipped_reason": "Tier 1 trivial local-only task; no report requested"
}
```

위 사유를 `TASK_COMPLETED.details`에 기록한다.

## 보존 원칙

- `logs/tasks/*.jsonl`은 append-only로 유지한다.
- `logs/sessions/*.md`는 세션별 기록으로 보존한다.
- 민감 정보가 들어가면 즉시 마스킹하고, 마스킹 사실을 메타데이터에 남긴다.
