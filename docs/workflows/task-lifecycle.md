# Task Lifecycle

**버전:** 1.16 | **최종 수정:** 2026-04-26

이 문서는 요청이 들어온 뒤 작업이 어떻게 시작되고, 검증되고, 종료되는지 정의한다.

## 전체 흐름

```text
세션 재진입이면 CURRENT_STATE.md 체크리스트 수행 및 결과 보고
  -> 사용자 요청
  -> Analyst가 TASK 생성
  -> Tier 분류
  -> 필요 시 Researcher 호출
  -> Generator 구현
  -> Validator 검증
  -> 필요 시 재수정 또는 Adjudication
  -> Analyst 최종 보고
```

## Phase -1: 세션 재진입 게이트

새 세션이 이전 작업을 이어받는 경우, Analyst는 요청 처리 전에 `CURRENT_STATE.md`의 세션 재진입 체크리스트를 수행한다.

이 단계는 선택 사항이 아니다. 재진입 상황에서는 Phase 0보다 먼저 끝나야 한다.

중요: 이 단계는 `TASK_CREATED`보다 앞선다. 절대 규칙의 "신규 요청 즉시 TASK 생성"은 일반 작업 요청 기준이며,
세션 재진입 요청은 이전 상태 무결성 확인이 먼저다.

필수 작업:

1. `CURRENT_STATE.md`를 읽는다.
2. 권위 문서 표의 버전·날짜와 실제 파일 헤더를 대조한다.
3. 활성 Task와 남은 작업을 확인한다.
4. 체크리스트 결과를 사용자에게 먼저 보고한다.
5. 불일치가 있으면 일반 작업을 진행하기 전에 `CURRENT_STATE.md` 갱신 또는 사용자 확인을 처리한다.

완료 기준:

- 사용자에게 재진입 체크 결과가 보고되어야 한다.
- 불일치가 있으면 목록과 조치가 명시되어야 한다.
- `CURRENT_STATE.md`를 수정했다면 해당 Task 원장에 기록되어야 한다.

## Phase 0: 요청 수신과 작업 시작

새 요청이 들어오면 가장 먼저 작업 이력을 만든다.

단, 아래 요청은 Phase -1을 먼저 수행한다.

- `CURRENT_STATE.md`를 읽고 이어서 진행하라는 요청
- 이전 세션의 활성 Task를 재개하는 요청
- 권위 문서 버전 무결성 확인이 필요한 재진입 요청

1. `TASK-{ID}`를 만든다.
2. `logs/tasks/TASK-{ID}.jsonl`을 생성한다.
3. `TASK_CREATED` 이벤트를 기록한다.
4. Task Spec 원본을 `tasks/specs/TASK-{ID}.json` 또는 `TASK_CREATED.details.spec` 중 하나에 반드시 저장한다.
5. 작업 목적, 범위, 예상 산출물을 간단히 정리한다.
6. 현재 세션 로그가 없으면 `logs/sessions/SESSION-{YYYYMMDD}-{NNN}.md`를 생성하고, 이미 있으면 해당 세션 로그에 Task를 연결한다.

권장 SSOT:

```text
tasks/specs/TASK-{ID}.json
```

`TASK_CREATED.details.spec_path`에 위 경로를 기록한다.  
이 경로 또는 `TASK_CREATED.details.spec`가 없으면 신규 strict Task는 원장 감사에서 실패한다.

이 단계의 원칙은 간단하다.

- 작업을 하기 전에 기록부터 남긴다.
- 원본 Task Spec 없는 요약만으로 작업을 시작하지 않는다.
- 세션 로그는 요청 종료 후가 아니라 세션 시작 시점에 열어둔다.
- 세션 로그를 생략하는 초소형 Task는 `TASK_COMPLETED.details.session_log_skipped_reason`에 사유를 남긴다.

## Phase 1: 분류

Analyst가 다음을 판단한다.

- 작업 난이도
- Tier 1 / Tier 2 / Tier 3 여부
- Researcher 필요 여부
- 병렬로 처리할 수 있는 하위 작업 존재 여부

## Phase 2: 조사

필요할 때만 Researcher를 사용한다.

- 공식 문서, 코드베이스, 외부 근거를 확인한다.
- 확인되지 않은 추정은 구분해서 기록한다.
- 민감 정보는 수집하지 않는다.

## Phase 3: 구현

Generator가 실제 변경을 수행한다.

구현 지시 전 Analyst는 인수인계 기준 순서를 확인한다.

1. `tasks/specs/TASK-{ID}.json` 또는 `TASK_CREATED.details.spec`
2. `logs/tasks/TASK-{ID}.jsonl`
3. 관련 `logs/sessions/SESSION-{ID}.md`
4. `artifact_refs`와 실제 수정 대상 파일

Generator에게는 위 자료 전체를 그대로 던지지 않고, 필요한 부분만 추려 전달한다.
단, 성공 기준과 negative constraints는 의미가 바뀌지 않게 원문 보존을 우선한다.

1. `task/{TASK-ID}` 브랜치에서 작업한다.
2. 작은 단위로 수정한다.
3. 자기 점검을 먼저 한다.
4. 필요 시 Validator를 요청한다.

### Tier 기준

| Tier | 의미 | 검증 |
|---|---|---|
| Tier 1 | 단일 파일, 영향 범위 작음 | Analyst 중심 확인 |
| Tier 2 | 복수 파일, 기능 수정 | Validator-A 필요 |
| Tier 3 | 보안, 스키마, 복합 영향 | Validator-A + Validator-B 필요 |

## Phase 4: 검증

검증 결과는 `logs/tasks/TASK-{ID}.jsonl`에 남긴다.

Validator 지시 전 Analyst는 아래를 확인한다.

1. Task Spec 원본의 `success_criteria`
2. 변경 파일과 산출물
3. 재시도/이전 FAIL이 있으면 해당 원장 이벤트
4. Tier 3인 경우 Validator-A/B 독립성 보장 여부

Validator에게 전달되는 PASS/FAIL 기준은 Task Spec 원본과 의미가 같아야 한다.

- `PASS`면 다음 단계로 진행한다.
- `FAIL`이면 Generator가 수정한다.
- 같은 오류가 반복되면 Analyst가 판단한다.

### 반복 실패 처리

동일한 실패가 연속으로 발생하면 다음 순서로 처리한다.

1. Generator가 1차 수정
2. 재검증
3. 다시 실패하면 Analyst가 Adjudication
4. 필요하면 Tier 재분류 또는 사용자 확인

## Phase 5: 세션 로그 갱신

세션 로그는 작업이 끝난 뒤 한 번만 쓰는 파일이 아니다.

- 세션 시작 시 생성하거나 이미 열린 세션 로그를 재사용한다.
- 작업 중 중요한 결정, 실패, 재시도, 배포 결과를 계속 추가한다.
- 세션 종료 시 최종 요약을 반영한다.
- 사용자를 향해 보낸 인라인 보고는 원문 그대로 누적한다.
- `## 다음 단계`는 현재 남은 작업만 남긴다. 완료된 항목은 삭제하거나 완료 사실로 갱신하고, 남은 작업이 없으면 `없음`으로 적는다.

세션 종료 요약은 사용자에게 전달한 최종 설명과 같은 결론이어야 한다.

권장 방식:

- 작업 중에는 짧은 인라인 업데이트를 남긴다.
- 세션 종료 시 그 내용을 정리해서 세션 로그에 옮긴다.
- 사용자에게 보낸 최종 요약과 세션 로그의 결론은 의미가 일치해야 한다.
- 세션 로그는 `작업 요약`보다 `인라인 보고 원문`을 우선한다.
- 기본 템플릿에서는 별도의 `작업 요약` 섹션을 사용하지 않는다.

## Phase 6: 최종 보고

작업이 끝나면 Analyst가 다음을 정리한다.

- 핵심 요약
- 변경 요약
- 검증 결과
- 배포 결과
- 남은 리스크
- 다음에 할 일
- Git 저장소 모드라면 현재 브랜치, 커밋, main/origin ahead 상태, push 수행 여부

### 보고서 및 품질 점수 게이트

작업 완료 전 Analyst는 아래 게이트를 확인한다.

| 상황 | `reports/TASK-{ID}.md` | `logs/quality-scores.jsonl` |
|---|---|---|
| Tier 1 일반 작업 | 선택 | 선택 |
| Tier 1 운영 규칙/가이드 변경 | 권장 | 필수 |
| Tier 1 사용자 보고서 요청 | 필수 | 권장 |
| Tier 2 완료 | 필수 | 필수 |
| Tier 3 완료 | 필수 | 필수 |
| HOLD | 필수. 상태 보고서로 작성 | 보류. 완료 시 채점 |
| Resource Failure | 필수. 원인·영향·재개 조건 포함 | 보류. 품질 실패로 채점하지 않음 |
| Adjudication 진입 또는 완료 | 필수. 판정 근거 포함 | 완료 시 필수 |
| FAILED | 필수. 원인·영향·재시작 조건 포함 | 필수. 실패 원인 반영 |

규칙:

- Tier 2/3 보고서는 대표 보고용으로 작성하며, 첫 화면에서 상태·결론·영향·검증·리스크·조치 필요 여부가 드러나야 한다.
- 품질 점수 생략 시 `TASK_COMPLETED.details.quality_score_skipped_reason`에 사유를 남긴다.
- 필수 보고서를 작성하지 못하면 `TASK_COMPLETED`로 종료하지 않고 `HOLD` 또는 `PARTIAL`로 남긴다.
- 보고서를 작성했다면 `REPORT_WRITTEN` 이벤트를 원장에 기록한다.
- 품질 점수를 기록했다면 `TASK_COMPLETED.details.quality_score` 또는 `artifact_refs`에 `logs/quality-scores.jsonl`을 연결한다.

## 완료 조건

작업 완료 전에는 아래가 충족되어야 한다.

- `TASK_COMPLETED`가 기록되어야 한다.
- 위 보고서 및 품질 점수 게이트가 충족되어야 한다.
- 세션 로그가 존재하면 요약이 반영되어야 한다.
- 세션 로그를 생략했다면 생략 사유가 `TASK_COMPLETED.details.session_log_skipped_reason`에 있어야 한다.
- 최신 세션 로그의 `## 다음 단계`가 현재 완료 상태와 모순되지 않아야 한다.
- Git 저장소 모드에서는 커밋/머지/push 상태가 최종 보고와 `CURRENT_STATE.md`에 반영되어야 한다.
- 사용자가 push까지 요청했거나 success_criteria에 push가 포함된 경우 `git push origin main` 완료와 push 후 상태 확인까지 완료 조건에 포함한다.

### 완료 전 표준 감사

가이드 유지보수 또는 Tier 2/3 작업 완료 전에는 단일 명령을 우선 사용한다.

```bash
npm run audit:harness
```

이 명령은 아래 검사를 순서대로 실행한다.

```text
node scripts/check-doc-headers.mjs
node scripts/validate-ledger.mjs
node scripts/check-completion-gates.mjs
node scripts/check-quality-scores.mjs
```

## 요약

- 요청 직후: `TASK` 원장 생성
- 작업 시작 시: `TASK_CREATED`
- 작업 중: 세션 로그 누적 갱신
- 작업 종료 시: `TASK_COMPLETED`와 최종 요약
