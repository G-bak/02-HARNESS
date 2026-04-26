# Failure Handling — 실패 처리 전략

**버전:** 1.3 | **최종 수정:** 2026-04-25

---

## 실패 유형별 대응

| 실패 유형 | 대응 방법 | 에스컬레이션 기준 |
|---|---|---|
| Generator 생성 오류 | 즉시 재시도 (최대 3회, 매번 접근 방식 변경) | 3회 모두 실패 → Analyst 보고 |
| Validator FAIL | Generator 수정 요청 후 재검증 | 2회 연속 동일 오류 → Conflict Report |
| Validator 판정 충돌 | Adjudication 단계 진입 | 증거 기반 중재 후에도 unresolved → 사용자 질의 |
| Tool/Model Resource Failure | Task를 HOLD 또는 PENDING_VALIDATION 유지, 리소스 회복 후 재개 | quota 소진·장기 장애 시 사용자 보고 |
| Researcher 탐색 실패 | 탐색 범위 조정 후 1회 재시도 | 재시도 실패 → 가용 정보로 진행 (명시) |
| Researcher confidence NONE | Analyst에게 보고 | Analyst가 사용자에게 질의 |
| 컨텍스트 부족 | Analyst가 사용자에게 질의 | — |
| 요구사항 모순 | Analyst가 사용자에게 확인 | — |
| Task HOLD (의존성) | 선행 Task 해결 대기 | Analyst가 사용자에게 HOLD 상태 즉시 보고 |

---

## 재시도 정책

```
최대 재시도 횟수: 3회
재시도 간격: 즉시 (단, 동일 방식 반복 금지)

재시도 시 필수 조건:
  ① 이전 실패 원인을 이력에서 확인
  ② 접근 방식 변경 후 재시도
  ③ 변경 내용을 지시서에 명시

Self-Refinement 자체 수정 1회는 재시도 카운트에 포함되지 않는다.
재시도 카운트는 Validator FAIL 시점부터 시작한다.

Tool/Model Resource Failure는 Validator FAIL 재시도 카운트에 포함하지 않는다.
```

---

## Tool/Model Resource Failure 처리

Codex, Gemini, Claude 등 모델/도구가 토큰·쿼터·rate limit·context limit 때문에 실행되지 못한 경우는 결과물 품질 실패가 아니다.  
따라서 **Validator FAIL, Generator 생성 오류, Conflict Report, Adjudication으로 처리하지 않는다.**

### Resource Failure 유형

| resource_error_type | 의미 | 기본 조치 |
|---|---|---|
| `RATE_LIMIT` | 일시적 요청 제한 또는 429 | backoff 후 최대 2회 재시도 |
| `QUOTA_EXHAUSTED` | 일/월 사용량 또는 결제 한도 소진 | Task HOLD, 사용자 보고 |
| `CONTEXT_LIMIT` | 입력 컨텍스트가 모델 한도를 초과 | 컨텍스트 압축 또는 Task 분해 후 재시도 |
| `TOOL_UNAVAILABLE` | CLI/API 장애, 인증 외 도구 장애 | 대기 후 재시도, 장기화 시 사용자 보고 |
| `AUTH_OR_BILLING` | 인증 만료, 결제 설정 문제 | Task HOLD, 사용자 조치 필요 보고 |

### 상태 처리

- Generator 단계에서 발생: `ACTIVE` 유지 또는 `HOLD`
- Validator 단계에서 발생: `PENDING_VALIDATION` 유지 또는 `HOLD`
- Tier 2: Validator-A PASS 전까지 main 머지 금지
- Tier 3: Validator-A와 Validator-B 둘 다 PASS + Analyst 최종 승인 전까지 main 머지 금지

### 대체 검증 제한

리소스 제한으로 필수 Validator가 실행되지 못한 경우, 다른 에이전트의 검토를 **최종 PASS 대체로 사용하지 않는다.**  
대체 검토는 preliminary review로만 기록하며, 원래 요구된 Validator PASS가 확보되기 전까지 머지하지 않는다.

### 사용자 보고 조건

Analyst는 다음 상황에서 즉시 사용자에게 보고한다:

1. `QUOTA_EXHAUSTED` 또는 `AUTH_OR_BILLING` 발생
2. `RATE_LIMIT` 재시도 2회 실패
3. `TOOL_UNAVAILABLE`이 10분 이상 지속
4. `CONTEXT_LIMIT` 해결을 위해 Task 분해나 성공 기준 조정이 필요한 경우

보고 시에는 현재 Task 상태, 막힌 에이전트, 재개 조건, 가능한 선택지를 명확히 제시한다.

---

## 교착 상태 (Deadlock) 해결

Generator-Validator 루프에서 **동일한 오류가 2회 이상 반복**되는 경우, 단순 구현 오류가 아닌 설계 수준의 문제를 의미한다.  
→ 재시도 한도를 소진하지 않고 **즉시 루프를 중단하고 Adjudication 단계로 진입**한다.

---

## 판정 충돌 처리 (Adjudication)

동일 오류 반복이 반드시 Generator 구현 실패를 의미하지는 않는다.  
Validator의 오검증, success_criteria 해석 차이, 재현 절차 오류가 원인일 수도 있다.  
따라서 **2회 연속 동일 FAIL은 세션 종료가 아니라 판정 충돌 중재 신호**로 취급한다.

### Adjudication 진입 조건

다음 중 하나라도 해당하면 Analyst는 즉시 Adjudication을 시작한다:

1. 동일 오류가 2회 연속 반복됨
2. Generator가 수정 대신 `REBUTTAL`을 제출함
3. Validator의 FAIL 근거가 실행 재현이 아닌 추론/해석 중심임

### Adjudication 절차

1. Analyst가 Validator FAIL 근거를 검토한다
2. 근거를 아래 `evidence_type` 중 하나로 분류한다
3. Generator가 수정 대신 `REBUTTAL`을 제출할 기회를 1회 갖는다
4. Analyst가 증거 우선순위에 따라 채택 여부를 판정한다
5. 판정 결과에 따라 다음 중 하나를 선택한다:
   - Validator 판정 유지 → Generator 수정 재개
   - Generator 반박 채택 → FAIL 철회 또는 success_criteria 해석 정정
   - 명세 모호성 확인 → Task Spec 보완 후 재검증
   - 기술적 불확실성 지속 → 사용자 질의

### Validator 증거 타입

Validator는 FAIL을 보고할 때 오류마다 다음 증거 타입 중 하나를 명시해야 한다:

- `EXECUTION_PROVEN`: 테스트·실행 로그로 실제 실패 재현됨
- `STATIC_PROVEN`: 정적 분석 규칙 위반이 명확함
- `SPEC_MISMATCH`: success_criteria 원문과 직접 불일치
- `INFERRED_RISK`: 코드상 위험이 추론되나 재현되지는 않음
- `SPEC_INTERPRETATION`: 명세 해석 차이 가능성이 있음

### Analyst 판정 우선순위

Adjudication 시 Analyst는 아래 순서로 근거를 채택한다:

1. `EXECUTION_PROVEN` 실행 로그
2. success_criteria 원문과 직접 대응되는 `SPEC_MISMATCH`
3. `STATIC_PROVEN` 규칙 위반
4. `INFERRED_RISK`
5. `SPEC_INTERPRETATION`

하위 우선순위 근거만으로 상위 근거를 뒤집지 않는다.

### Conflict Report 발행 조건

Validator는 다음 중 하나라도 해당하면 Generator 수정 요청 대신 **Analyst에게 Conflict Report를 직접 발행**한다:

1. 2회 연속 동일 오류 코드 또는 동일 실패 항목 발생
2. 성공 기준 자체가 현재 코드 구조로는 달성 불가능하다고 판단
3. 수정 방향이 상충되는 두 개의 성공 기준이 존재

---

## Analyst 개입 프로세스 (Conflict Report 수신 후)

Analyst는 아래 기준에 따라 선택지를 **순서대로 검토**한다.  
상위 선택지로 해결 가능하면 사용자 질의로 에스컬레이션하지 않는다.  
선택 없이 방치하는 것은 허용되지 않는다.

| 우선순위 | 선택지 | 적용 조건 |
|---|---|---|
| 1 | **Adjudication 수행** | Validator 오검증, 재현 절차 오류, success_criteria 해석 차이 가능성이 있는 경우 |
| 2 | **성공 기준 완화 또는 재정의** | 반복 오류의 원인이 기준 자체의 모순이거나 현재 구조로 달성 불가능한 경우. Conflict Report의 `blocking_criterion`이 명확히 지목된 경우 우선 적용 |
| 3 | **Researcher 재투입** | 동일 접근법으로 2회 이상 실패했고, 대안 기술·라이브러리·설계 패턴 탐색이 필요한 경우 |
| 4 | **Task 분해** | 오류가 Task 범위 전체에 걸쳐 있거나 Generator가 단일 패스로 처리하기에 책임이 과중한 경우 |
| 5 | **사용자 질의** | 기술적 판단이 아닌 비즈니스·설계 방향 결정이 필요한 경우. 1~4 선택지로도 방향을 정할 수 없는 경우 |

---

## 전략 변경 조건 (3회 재시도 후 모두 실패)

Analyst는 다음을 수행한다:

1. 실패 이력 전체 분석
2. Task Spec 재검토 (목표 또는 제약 조건 문제 여부)
3. 에이전트 전략 변경 또는 작업 분해
4. 필요 시 사용자에게 현황 보고 및 방향 확인

---

## 불확실성 처리

다음 상황에서는 추측하지 않고 사용자에게 명확히 질의한다:

- 요구사항의 의미가 두 가지 이상으로 해석되는 경우
- 성공 기준을 정의할 수 없는 경우
- 보안 또는 데이터 처리 관련 결정이 필요한 경우

---

## Conflict Report 형식

```json
{
  "task_id": "TASK-20260424-001",
  "agent": "Validator-A | Validator-B",
  "type": "CONFLICT_REPORT",
  "loop_count": 2,
  "recurring_error": "반복 발생한 오류 내용",
  "root_cause_hypothesis": "단순 구현 오류가 아닌 근본 원인 추정",
  "blocking_criterion": "현재 구조로 달성 불가능한 성공 기준 항목",
  "escalation_options": [
    "성공 기준 X를 완화하거나 재정의",
    "Researcher 재투입하여 대안 구조 탐색",
    "사용자에게 설계 방향 확인 필요"
  ]
}
```

---

## Generator Rebuttal 형식

Generator가 Validator FAIL을 수용하지 못할 경우, 수정 대신 아래 형식으로 1회 반박할 수 있다.

```json
{
  "task_id": "TASK-20260424-001",
  "agent": "Generator",
  "type": "REBUTTAL",
  "target_error": "Validator가 제기한 오류 요약",
  "claim": "왜 이 FAIL이 잘못되었는지에 대한 핵심 주장",
  "evidence": [
    {
      "kind": "test_log | spec_quote | code_path | static_result",
      "detail": "반박 근거"
    }
  ],
  "requested_action": "FAIL 철회 | success_criteria 해석 정정 | 재현 절차 재실행"
}
```
