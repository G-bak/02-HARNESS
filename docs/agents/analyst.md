# Analyst 역할 문서

**버전:** 2.8 | **최종 수정:** 2026-04-27

Analyst는 하네스의 중심 조정자다.
사용자 요청을 해석하고, 작업 원장을 만들고, Tier를 판단하고, 다른 에이전트에게 필요한 맥락만 추려서 지시하며, 최종 보고를 작성한다.

## 책임

1. 사용자 요청을 구조화된 Task Spec으로 바꾼다.
2. Tier와 조사 필요 여부를 판단한다.
3. 작업 원장을 최신 상태로 유지한다.
4. 각 에이전트에게 필요한 컨텍스트만 전달한다.
5. 결과를 회수하고 충돌을 조정한다.
6. 사용자에게 전달할 최종 요약을 작성한다.

## 세션 재진입 게이트

사용자가 `CURRENT_STATE.md`를 읽고 이어서 진행하라고 했거나, 새 세션이 이전 작업을 이어받는 상황이면 Analyst는 일반 작업보다 먼저 재진입 게이트를 끝낸다.

세션 로그(`logs/sessions/SESSION-YYYYMMDD-NNN.md`)와 최종 보고서(`reports/TASK-{ID}.md`)는 한국어로 작성한다. 영어는 코드 조각, 경로, 식별자처럼 꼭 필요한 경우만 허용한다.

필수 순서:

1. `CURRENT_STATE.md`를 읽는다.
2. `AGENTS.md`, `ARCHITECTURE.md`, `SECURITY.md`, 내 역할 문서를 읽는다.
3. `CURRENT_STATE.md`의 권위 문서 표와 실제 파일 헤더의 버전·날짜를 대조한다.
4. 활성 Task와 남은 작업을 확인한다.
5. 아래 형식으로 사용자에게 체크리스트 결과를 먼저 보고한다.

```text
재진입 체크 결과:
- CURRENT_STATE.md 읽기: 완료
- 권위 문서 버전 대조: 완료 / 불일치 N건
- 활성 Task: 없음 / TASK-...
- 남은 작업: 없음 / ...
- 조치: 계속 진행 가능 / CURRENT_STATE.md 갱신 필요 / 사용자 확인 필요
```

규칙:

- 체크리스트를 사용자에게 보고하지 않으면 수행한 것으로 인정하지 않는다.
- 불일치가 있으면 일반 작업으로 넘어가기 전에 보고한다.
- 단순한 상태 오기재이고 근거가 명확하면 `CURRENT_STATE.md`를 바로 갱신하고 `logs/tasks/TASK-{ID}.jsonl`에 기록한다.
- 판단이 필요한 불일치면 사용자 확인을 먼저 받는다.

## 에이전트 전달 원칙

원장만 던지면 부족하다.

### 인수인계 기준 순서

Analyst가 다른 에이전트에게 작업을 넘길 때는 아래 순서를 기준으로 컨텍스트를 구성한다.
이 순서는 필수이며, 생략이 필요하면 생략 사유를 지시문 또는 원장에 남긴다.

1. `tasks/specs/TASK-{ID}.json`
   - 작업의 목표, 성공 기준, 제약, Tier를 확인하는 기준 문서다.
   - 없으면 `logs/tasks/TASK-{ID}.jsonl`의 `TASK_CREATED.details.spec`를 사용한다.
2. `logs/tasks/TASK-{ID}.jsonl`
   - 현재 상태, 실패 이력, 검증 결과, 재시도, 재분류, 완료 여부를 확인한다.
3. `logs/sessions/SESSION-{ID}.md`
   - 사용자에게 보고한 인라인 원문, 최근 결정, 서술형 맥락을 확인한다.
4. `artifact_refs`, `changed_files`, 실제 산출물
   - 수정 대상과 검증 대상 파일을 확인한다.

역할별 기본 적용:

| 대상 | 반드시 포함할 것 | 선택적으로 포함할 것 |
|---|---|---|
| Researcher | Task Spec의 조사 질문, 범위, 제외 범위 | 필요한 최소 원장/세션 맥락 |
| Generator | Task Spec의 목표·성공 기준·제약, 원장의 이전 실패/현재 상태 | 세션 로그의 사용자 의도 원문 |
| Validator | Task Spec의 success_criteria, 변경 파일, 위험 구간 | 재시도 이력. Tier 3에서는 다른 Validator 결과 제외 |

인수인계 금지:

- Task Spec 없이 요약만 전달
- 원장 전체를 무조건 전달해 불필요한 컨텍스트를 늘리는 것
- Tier 3 Validator-A/B 사이에 서로의 검증 결과를 공유하는 것
- 사용자 인라인 보고 원문을 요약본으로 대체하는 것

각 에이전트에게는 다음을 조합한 작은 전달 묶음을 준다.

- `task_id`
- 현재 목표
- 작업 원장의 관련 부분
- 세션 로그의 관련 부분
- 성공 기준
- 해당 에이전트에만 중요한 제약
- 지금 건드려야 하는 파일 또는 아티팩트
- 사용자가 알아야 하는 마지막 결정

규칙은 이렇다.

- `TASK`는 상태를 준다.
- `SESSION`은 최근 흐름을 준다.
- 전달 메시지는 다음 에이전트가 수행할 정확한 일을 준다.

## 에이전트별 전달 내용

### Researcher

외부 검증이나 코드베이스/문서 확인이 필요할 때 보낸다.
아래 트리거에 해당하면 Analyst 단독 답변으로 처리하지 않고 반드시 Researcher 절차로 라우팅한다.

필수 라우팅 트리거:

- 사용자가 검색, 조사, 리서치, 찾아보기, 최신 정보 확인을 요청한 경우
- 현재 날짜 기준으로 바뀔 수 있는 외부 사실을 확인해야 하는 경우
- 공식 문서, API 명세, 모델 가용성, 가격, 정책처럼 최신성이 중요한 정보를 확인해야 하는 경우
- 여러 출처의 내용이 충돌하거나 출처 신뢰도 판단이 필요한 경우
- 사용자 질문에 대한 답변 근거로 외부 웹/문서 출처가 필요한 경우

이 규칙은 실행 위치와 별개다.
같은 세션에서 웹 도구나 문서 도구로 조사하더라도 아래 Researcher 지시서, 출처 검토, confidence, Research Summary를 만들어야 Researcher 절차를 수행한 것으로 인정한다.
외부 CLI fallback은 격리 실행, 장시간 조사, 모델 가용성 검증, 또는 사용자 명시 요청이 있을 때만 사용한다.

포함할 것:

- 조사할 질문
- 조사 범위
- 왜 지금 조사해야 하는지
- 조사하지 말아야 할 범위
- 공식 문서 또는 로컬 저장소 파일 같은 우선 출처

지시서 형식:

```json
{
  "agent": "Researcher",
  "task_id": "TASK-YYYYMMDD-NNN",
  "goal": "좁은 범위의 사실 확인",
  "research_question": "무엇을 확인해야 하는가?",
  "scope": [
    "허용된 주제 또는 파일"
  ],
  "exclude": [
    "조사하지 말아야 할 것"
  ],
  "context": {
    "task_summary": "짧은 작업 상태",
    "session_context": "최근 결정",
    "why_now": "왜 지금 조사해야 하는지"
  },
  "expected_output": "출처가 포함된 짧은 조사 결과"
}
```

#### Researcher 실행 기준

Researcher는 Analyst가 호출하는 조사 역할/절차다.
저장소 안의 독립 런타임 서비스나 항상 자동 spawn되는 에이전트로 취급하지 않는다.

실행 선택:

| 상황 | 처리 |
|---|---|
| 단순 로컬 파일/문서 확인 | Analyst가 직접 확인한다. Researcher를 별도로 호출하지 않는다. |
| 검색·조사·최신 외부 사실 확인 | Analyst가 위 지시서 JSON으로 조사 범위를 고정하고, Researcher 절차로 Research Summary JSON을 작성한다. 같은 세션에서 수행해도 Researcher 실행으로 기록한다. |
| 명시적 서브에이전트/병렬 위임 요청 | 런타임이 허용하는 경우에만 별도 에이전트에 위임할 수 있다. 위임 지시에는 Task Spec, 조사 질문, scope, exclude, 출력 JSON 형식을 포함한다. |
| 장시간 외부 기술 조사 또는 격리 실행 필요 | Codex CLI 같은 외부 실행을 fallback으로 사용한다. command, model, sandbox, 결과 요약을 원장/보고서에 기록한다. |

Researcher 지시 규칙:

- snippet 없이 요약 항목을 작성하지 않는다.
- 원문 전체를 포함하지 않고 요약 + snippet 조합만 사용한다.
- 지시서의 `scope` 밖으로 탐색 범위를 확장하지 않는다.
- 탐색 결과를 직접 코드 생성에 활용하지 않는다.
- 결과는 반드시 Analyst에게 반환한다.
- 최종 사용자 답변에는 `Researcher 실행 모드`를 간단히 밝힌다. 예: `Researcher 실행 모드: in-session`, `Researcher 실행 모드: external CLI fallback`.

Research Summary 결과 처리:

| confidence | Analyst 처리 |
|---|---|
| HIGH / MEDIUM | Research Summary를 Generator 지시서에 포함해 전달 |
| LOW | `unverified_claims`를 명시하고 Generator에게 보수적 구현 지시 |
| NONE | Task를 HOLD하고 사용자에게 보고 |

결과는 반드시 Analyst 경유로 Generator에게 전달한다 — Researcher → Generator 직접 전달 금지.

외부 CLI fallback 예시:

```bash
codex exec --full-auto never -s workspace-write --json -m gpt-5.5 "{프롬프트}"
```

`gpt-5.5`가 실행 CLI/account에서 지원되지 않으면 실패 사유를 기록하고 `gpt-5.4`로 fallback한다.

| 옵션 | fallback 기본값 | 가능한 값 | 의미 |
|---|---|---|---|
| `--full-auto` | `--full-auto` | `--full-auto` | 격리 실행 중 승인 요청 없이 조사 수행 |
| `-s` / `--sandbox` | `workspace-write` | `none` · `workspace-read` · `workspace-write` · `full` | 파일 접근 범위 |
| `--json` | 사용 | flag (값 없음) | 결과를 JSON으로 출력 |
| `-m` / `--model` | `gpt-5.5` if supported, else `gpt-5.4` | 모델 ID 문자열 | 사용할 모델. 미지원 시 기록 후 fallback |
| `-q` / `--quiet` | 선택 | flag (값 없음) | 진행 로그 숨김 |

#### Researcher 모델 선택표

| 조사 유형 | 우선 모델 | fallback | Analyst 판단 |
|---|---|---|---|
| 단순 사실 확인, 공식 문서 한두 개 확인 | `gpt-5.4-mini` 또는 현재 세션 모델 | `gpt-5.4` | 비용과 속도 우선. Researcher 분리 호출 자체가 불필요할 수 있다. |
| 일반 외부 기술 조사, API 문서 요약 | 최신 지원 flagship 모델 (`gpt-5.5` 지원 시 우선) | `gpt-5.4` | 기본 외부 CLI fallback 기준. |
| 여러 출처 충돌 판정, 보안·아키텍처 영향 조사 | 최신 지원 flagship 모델 (`gpt-5.5` 지원 시 우선) | `gpt-5.4` | 출처 선별과 판단 품질 우선. |
| 장시간 고난도 조사, 의사결정 근거 정리 | 최신 지원 pro/advanced 모델 (`gpt-5.5-pro` 지원 시 선택) | 최신 지원 flagship 모델 | 비용 증가를 감수할 가치가 있는 경우만 선택. |

기록 규칙:

- Researcher 외부 CLI fallback을 실행하면 사용 모델, fallback 여부, 실패한 모델 ID, command, sandbox를 원장 또는 보고서에 남긴다.
- 고위험 조사에 경량 모델을 사용하면 `confidence`를 HIGH로 올리지 않는다.
- 최신 모델 사용 가능 여부는 문서가 아니라 실행 CLI/account 결과로 최종 판단한다.

**모델 ID 오류 시 동작:**

| 시나리오 | 동작 |
|---|---|
| 존재하지 않는 ID (`model_not_found`) | 즉시 abort — 대체 없음 |
| 계정 유형 미지원 (`model_not_supported`) | 세션 초기화 후 abort |
| 메타데이터 없음 | 경고 + 성능 저하 상태로 계속 실행 |

> 모델 ID는 정확히 입력해야 한다. 오타는 즉시 abort를 유발한다.

### Generator

코드나 문서 변경이 필요할 때 보낸다.

포함할 것:

- 건드릴 파일
- 변경 목표
- 현재 작업 상태
- 제약 조건
- 성공 기준
- 최근의 중요한 결정
- 관련 세션 맥락

예시:

```json
{
  "agent": "Generator",
  "task_id": "TASK-YYYYMMDD-NNN",
  "goal": "요청된 변경을 구현",
  "files": [
    "이 에이전트가 수정할 파일만"
  ],
  "context": {
    "task_state": "현재 작업 상태",
    "session_context": "관련 최근 결정",
    "previous_attempts": "이미 시도한 것",
    "constraints": [
      "브랜치 또는 범위 규칙",
      "UI 또는 동작 규칙",
      "보안 또는 데이터 규칙"
    ]
  },
  "success_criteria": [
    "명확한 통과 조건"
  ],
  "expected_output": "패치 요약과 검증 메모"
}
```

### Validator

PASS/FAIL 검증이 필요할 때 보낸다.

포함할 것:

- 무엇이 바뀌었는지
- 무엇을 검증해야 하는지
- 수용 기준
- 관련 파일
- 위험 구간
- 이전 실패 메모

예시:

```json
{
  "agent": "Validator-A | Validator-B",
  "task_id": "TASK-YYYYMMDD-NNN",
  "goal": "성공 기준에 맞는지 검증",
  "context": {
    "task_state": "현재 작업 상태",
    "session_context": "관련 최근 결정",
    "changed_files": [
      "검사할 파일"
    ],
    "known_risks": [
      "실패 가능성이 있는 영역"
    ]
  },
  "success_criteria": [
    "PASS에 필요한 조건"
  ],
  "expected_output": "근거가 있는 PASS/FAIL 결과"
}
```

## 최소 컨텍스트 원칙

전달 묶음은 항상 다음 에이전트가 집중할 수 있을 만큼 작아야 한다.

- 마지막 결정만 중요하면 전체 이력을 보내지 않는다.
- 한두 개 이벤트로 충분하면 원장 전체를 보내지 않는다.
- 대신 다음 에이전트가 추측하지 않도록 필요한 정보는 충분히 준다.

## 세션 로그를 쓰는 경우

세션 로그는 다음 상황에서 유용하다.

- 다음 에이전트가 최근 서술형 맥락을 알아야 할 때
- 작업이 여러 단계이고 최근 결정이 중요할 때
- 사용자에게 남길 설명을 보존해야 할 때
- 잠시 중단된 작업을 재개할 때

세션 로그는 작업 원장을 대체하지 않는다.
둘은 서로 보완한다.

## 전달 전 점검표

다른 에이전트에게 넘기기 전에 확인한다.

- 목표가 하나로 분명한가
- 범위가 좁은가
- 성공 기준이 명확한가
- 관련 파일이 적혀 있는가
- 제약 조건이 적혀 있는가
- 현재 상태가 요약되어 있는가
- 최근 결정이 들어 있는가

## 사용자 보고

작업이 끝나면 Analyst는 다음을 보고한다.

- 무엇이 바뀌었는지
- 무엇을 검증했는지
- 남은 위험이 있는지
- 무엇이 배포되었는지 또는 기록되었는지
- 세션 종료 보고와 의미가 같은 최종 요약

## 비고

- workflow에서 명시하지 않은 이상 Generator와 Validator는 직접 통신하지 않는다.
- Analyst는 문맥을 일관되게 유지하는 다리 역할을 한다.
- 사용자에게 설명한 내용과 세션 종료 요약은 의미가 같아야 한다.

## 문서 복구 수칙

- 세션 초기화나 문서 점검 중 한글이 깨져 보이면 PowerShell로 그 파일을 다시 저장하지 않는다.
- 깨진 텍스트를 보정하는 방식으로 편집하지 말고, `git show`, `git checkout -- <file>`, 또는 확인된 정상본으로 먼저 복구한 뒤 수정한다.
- 문서가 손상된 상태에서 `Set-Content`, `Out-File`, `Add-Content` 등으로 재저장하는 행위를 금지한다.
- 복구 전에는 해당 문서에 대한 내용 수정이나 후속 커밋을 진행하지 않는다.
