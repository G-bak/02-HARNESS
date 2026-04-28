# Generator FAIL 회복 흐름 — 한국어 운영 가이드

**버전:** 1.0 | **최종 수정:** 2026-04-28  
**대상:** 02-HARNESS 멀티 에이전트 시스템에서 Generator를 운영하는 Analyst·운영자  
**용도:** Validator FAIL 발생 시 (1) FAIL이 누구에게 어떻게 전달되는지, (2) Fresh execution(세션 비저장) 호출 모델에서 Generator가 이전 시도의 맥락을 어떻게 잃지 않는지를 설명한다.

---

## 0. 이 문서의 위치

이 문서는 **운영 가이드(Operational guide)** 클래스다. 권위 규칙을 새로 만들지 않고, 권위 문서를 해석하고 호출 흐름을 시각화한다. 본 가이드와 권위 문서가 충돌할 경우 권위 문서가 우선한다.

| 영역 | 권위 문서 |
|---|---|
| FAIL 라우팅·예외 통신 | `AGENTS.md` 절대 규칙 3 |
| Generator 동작·입출력 | `docs/agents/generator.md` |
| Validator 절차·evidence_type | `docs/agents/validator.md` |
| 재시도·Adjudication·Conflict Report | `docs/workflows/failure-handling.md` |
| Claude CLI 호출 옵션 | `docs/guides/claude-cli-options-ko.md` |

---

## 1. 핵심 통찰

> "세션을 이어가느냐 vs 비우느냐"는 **잘못된 이분법**이다.  
> 정확한 질문은 **"이전 시도의 상태를 모델 머릿속(암묵적)에 둘 것인가, 파일(명시적)에 둘 것인가"**다.

02-HARNESS는 후자를 택한다. 그 결과:

- Generator는 항상 **fresh Claude CLI execution**으로 호출된다 (`--continue`/`--resume` 금지).
- 이전 시도의 정보는 **`tasks/handoffs/TASK-{ID}/` 디렉토리의 입력 파일**에 명시적으로 박아 넣는다.
- 모든 시도가 재현 가능하고, 머신·시점에 독립적이며, 감사 가능하다.

---

## 2. Validator FAIL은 누구에게 전달되는가

### 2-1. Tier별 라우팅

| Tier | FAIL 전달 경로 | 근거 |
|---|---|---|
| **Tier 1** | Validator 없음 — Analyst 자체 검토 | `docs/agents/validator.md` Tier별 구성 |
| **Tier 2** | Validator-A → **Generator 직접 전달** (Analyst 경유 X) | `AGENTS.md` 절대 규칙 3 예외 2 |
| **Tier 3** | Validator-A/B → Analyst가 두 결과 취합 → 하나라도 FAIL이면 **Analyst가 두 리포트를 함께 Generator에게 전달** | `docs/agents/validator.md` Tier 3 절차 |

**Tier 2에서 V↔G 직접 통신을 허용하는 이유:** 매 FAIL마다 Analyst를 거치면 reaction time이 길어지고 Analyst가 단순 전달자로 전락한다. 단, **2회 연속 동일 오류**는 직접 전달이 끊기고 Analyst Adjudication으로 강제 전환된다 (다음 절).

### 2-2. 직접 통신이 끊기는 시점 — Conflict Report

다음 중 하나에 해당하면 Validator는 Generator 수정 요청 대신 **Analyst에게 직접 Conflict Report를 발행**한다:

```
1. 동일 오류가 2회 연속 반복됨
2. success_criteria 자체가 현재 코드 구조로는 달성 불가능하다고 판단
3. 수정 방향이 상충되는 두 개의 success_criteria가 존재
4. Generator가 Rebuttal을 제출했으나 Validator가 수용하지 못해 충돌 지속
```

(권위 문서: `docs/workflows/failure-handling.md` Conflict Report 발행 조건)

이 시점부터는 G↔V 루프가 멈추고, Analyst가 Adjudication 절차를 시작한다.

### 2-3. 라우팅 다이어그램

```
[Tier 2 정상 흐름]
Analyst ──지시서──▶ Generator(fresh) ──result──▶ Validator-A
                          ▲                           │
                          │  errors[]                 │
                          └──────── FAIL ◀────────────┘
                          (직접 전달, 최대 1회 더 시도)

[Tier 2 교착 흐름 — 2회 연속 동일 오류]
Validator-A ──Conflict Report──▶ Analyst ──Adjudication──▶ {유지|채택|기준 정정|사용자 질의}

[Tier 3 정상 흐름]
                  ┌──▶ Validator-A ─┐
Generator ─result─┤                 ├─▶ Analyst 취합 ─▶ {둘 다 PASS: 머지 / 하나라도 FAIL: G로 두 리포트 전달}
                  └──▶ Validator-B ─┘
                  (두 Validator는 서로의 존재·결과 모름)
```

---

## 3. Fresh execution에서 어떻게 같은 실수를 반복하지 않는가

### 3-1. 핵심 메커니즘 — Handoff 파일

**세션 메모리 = 암묵적 상태**, **handoff 파일 = 명시적 상태**.

```
tasks/handoffs/TASK-{ID}/
  generator-input.json       ← Analyst가 작성하는 입력
  generator-result.json      ← Generator가 출력하는 결과
  validation-1.json          ← 1차 Validator 결과 (FAIL이면 errors[] 포함)
  generator-input-retry-2.json  ← 2차 시도 입력 (1차 errors[]를 포함)
  generator-result-2.json
  validation-2.json
  ...
```

매 호출은 **fresh** Claude CLI execution이지만, 입력 파일에 이전 시도의 모든 결정적 정보가 들어 있다.

### 3-2. 재시도 입력 스키마 (권장)

```json
{
  "task_id": "TASK-20260428-001",
  "task_spec_path": "tasks/specs/TASK-20260428-001.json",
  "attempt_no": 2,
  "allowed_context": {
    "files_to_read": ["src/auth.js", "src/middleware/session.js"],
    "files_to_modify": ["src/auth.js"]
  },
  "previous_attempts": [
    {
      "attempt_no": 1,
      "generator_result_summary": "Implemented session token validation in auth.js handleLogin()",
      "validator_feedback": [
        {
          "severity": "HIGH",
          "evidence_type": "EXECUTION_PROVEN",
          "location": "src/auth.js:42",
          "description": "Token comparison uses == instead of constant-time compare",
          "suggestion": "Use crypto.timingSafeEqual or equivalent",
          "evidence": "test_security/auth.test.js:18 timing attack test failed: stddev 12.4ms"
        }
      ]
    }
  ],
  "retry_instruction": "이전 접근법은 성능 우려로 변수 비교를 사용했으나 timing attack에 취약. 다른 접근(상수 시간 비교)으로 시도할 것.",
  "forbidden_context": [
    "Analyst conversation log",
    "Researcher source documents (only summaries allowed)",
    "Other Validator's private context"
  ]
}
```

핵심 필드:

| 필드 | 역할 |
|---|---|
| `attempt_no` | 몇 번째 시도인지 (1=첫 시도, 2+=재시도) |
| `previous_attempts` | 직전 시도 결과 + Validator FAIL 리포트 그대로 (요약 X, 판정의 evidence는 그대로 보존) |
| `retry_instruction` | "이전 방식 X로 Y 실패. 다른 접근으로 시도" 명시 — 권위 문서 `failure-handling.md`의 "동일 방식 반복 금지" 조항 강제 |
| `allowed_context` / `forbidden_context` | Generator가 읽고 쓸 범위 + 절대 받지 말아야 할 컨텍스트 (보안·격리) |

### 3-3. 정책으로 "같은 실수" 차단

`docs/workflows/failure-handling.md` 28-32줄:

```
재시도 시 필수 조건:
  ① 이전 실패 원인을 이력에서 확인
  ② 접근 방식 변경 후 재시도   ← 동일 방식 반복 금지
  ③ 변경 내용을 지시서에 명시
```

또한 Validator의 `errors[]` 항목은 매번 다음을 강제한다 (`docs/agents/validator.md`):

- `evidence_type` (`EXECUTION_PROVEN` / `STATIC_PROVEN` / `SPEC_MISMATCH` / `INFERRED_RISK` / `SPEC_INTERPRETATION`)
- `location` (파일:줄)
- `description`
- `suggestion`
- `evidence` (재현 로그 또는 success_criteria 원문)

→ Generator가 받는 입력에 "**무엇이**, **어디서**, **왜**, **어떻게 고칠지**, **재현 근거**"가 모두 구조적으로 들어 있다.

---

## 4. 세션 이어가기 vs Handoff 명시 입력 — 비교

| 비교 축 | 세션 이어가기 (`--continue`/`--resume`) | Handoff 파일 명시 입력 (현 정책) |
|---|---|---|
| 재현 가능성 | 모델 내부 상태 의존 → 다음 실행에서 다른 결과 가능 | 같은 입력 = 같은 출력. 디버깅·롤백 가능 |
| 같은 함정 회피 | 직전 컨텍스트에 끌려 같은 발상 반복하기 쉬움 | "접근 방식 변경" 정책 + Validator suggestion이 입력에 박혀 있어 다른 접근 강제 |
| 감사 가능성 | 세션 통째로 봐야 함, 일부 발췌 어려움 | 1차/2차/3차 시도가 별도 파일로 분리 — 누가 무엇을 봤는지 추적 가능 |
| 머신 독립성 | 세션 저장된 머신에 묶임 | 입력 파일만 옮기면 어디서든 재현 |
| 컨텍스트 오염 | Analyst 잡담·hedging까지 묻어들어옴 | Analyst가 큐레이션한 최소 컨텍스트만 |
| 캐시 효율 | 직관과 달리 비효율 (옛 컨텍스트도 매번 처리) | 입력이 작고 정형이라 prompt cache 잘 맞음 |
| 보안 격리 | 다른 에이전트의 도구 권한이 의도치 않게 살아있을 수 있음 | 매 실행이 권한·도구를 새로 협상 |

---

## 5. 한계와 운영 보완

### 한계 1 — 재시도가 누적되면 입력이 커진다

- 3차 재시도면 입력에 1차·2차 시도 요약·FAIL 리포트가 모두 들어감.
- **보완:** Analyst가 발췌. `previous_attempts`에는 `evidence_type`, `location`, `suggestion`, `evidence` 핵심만 옮기고, 전체 코드 diff·전체 로그는 첨부하지 않는다.
- `CONTEXT_LIMIT` 도달 시 `failure-handling.md`의 Resource Failure 처리(`CONTEXT_LIMIT` 유형) → 컨텍스트 압축 또는 Task 분해.

### 한계 2 — Generator가 "이전 코드 상태"를 기억해야 하지 않나?

- 코드 자체는 git에 있고 Generator가 Read 도구로 읽을 수 있다. 이는 "세션 메모리"가 아니라 "저장소 상태"다.
- 입력에 "수정 대상 파일 경로" + Validator가 가리킨 `location`이 명시되니 Generator가 어디를 다시 봐야 할지 정확히 안다.

### 한계 3 — 모델이 입력의 `previous_attempts`를 무시하고 1차와 비슷하게 갈 위험

- **보완 1:** Validator가 동일 오류를 2회 연속 잡으면 Conflict Report 발행 → Adjudication 진입. 무한 루프 차단 장치가 정책 수준에 박혀 있음.
- **보완 2:** 재시도 카운트 최대 3회. 3회 모두 실패하면 Analyst 개입 (`failure-handling.md`).
- **보완 3:** Analyst는 `retry_instruction` 필드에 "이전 접근 X 금지" 등 부정 제약을 명시할 수 있다.

### 한계 4 — Tier 2에서 G↔V 직접 통신이 Analyst의 가시성을 떨어뜨리지 않나?

- **보완:** 모든 직접 통신은 `logs/tasks/TASK-{ID}.jsonl` 원장에 `INSTRUCTION_SENT` / `AGENT_RESULT_RECEIVED` / `VALIDATION_RESULT` 이벤트로 append-only 기록된다.
- Analyst는 사후 감사로 흐름을 재구성할 수 있고, 2회 연속 동일 오류 시점에 자동으로 통신권을 회수한다.

---

## 6. 실전 호출 예시 (재시도 시나리오)

### 6-1. 1차 시도 실행

```bash
# bash
cat tasks/handoffs/TASK-{ID}/generator-input.json | \
  claude --bare --print \
         --input-format text \
         --output-format json \
         --no-session-persistence \
         --permission-mode acceptEdits \
         --allowedTools "Read,Edit,Bash(npm test),Bash(git diff *)" \
  > tasks/handoffs/TASK-{ID}/generator-result.json
```

### 6-2. Validator-A FAIL 수신 → 2차 시도 입력 작성

Analyst가 `validation-1.json`의 `errors[]`를 그대로 발췌해 `generator-input-retry-2.json`의 `previous_attempts[0].validator_feedback`에 옮기고, `retry_instruction`을 추가한다.

### 6-3. 2차 시도 실행 (또 다른 fresh execution)

```bash
cat tasks/handoffs/TASK-{ID}/generator-input-retry-2.json | \
  claude --bare --print \
         --input-format text \
         --output-format json \
         --no-session-persistence \
         --permission-mode acceptEdits \
         --allowedTools "Read,Edit,Bash(npm test)" \
  > tasks/handoffs/TASK-{ID}/generator-result-2.json
```

### 6-4. 금지 플래그 (재확인)

어떤 시도에서도 다음 플래그는 사용하지 않는다:

```
--continue
--resume
--from-pr
--fork-session
--dangerously-skip-permissions
--allow-dangerously-skip-permissions
```

→ 자세한 옵션 설명은 `docs/guides/claude-cli-options-ko.md` 7-1·7-2절 참조.

---

## 7. 요약

1. **FAIL 전달** — Tier 2는 V↔G 직접, Tier 3은 Analyst가 V-A/B 결과를 취합 후 G에 전달, 2회 연속 동일 오류는 Conflict Report로 Adjudication 전환.
2. **Fresh execution + 명시적 handoff** — 모델 머릿속이 아니라 파일에 상태를 둔다. 재현 가능, 감사 가능, 머신 독립.
3. **같은 실수 차단** — Validator의 evidence_type + location + suggestion이 다음 시도 입력에 강제로 들어가고, "동일 방식 반복 금지" 정책이 더해진다.
4. **무한 루프 차단** — 동일 오류 2회 = Conflict Report, 3회 재시도 한도 = Analyst 개입.
5. **세션 이어가기는 Generator에게 잘못된 도구다.** 우월하다고 여겨지는 점(맥락 보존)은 명시적 handoff에서 더 안전하게 달성되고, 단점(재현 불가·오염·격리 실패)은 그대로 가져온다.

---

## 8. 현재 자동화 범위

`scripts/run-generator.mjs` 추가 이후 실제 파이프라인에 반영된 범위는 아래와 같다.

자동화됨:

- `generator-input*.json`을 받아 fresh Claude CLI Generator 실행
- `generator-result.json`, `generator-stderr.log`, `generator-run.json` 저장
- 실행 직전 `INSTRUCTION_SENT` 원장 기록
- 실행 결과 `AGENT_RESULT_RECEIVED` 또는 `RESOURCE_FAILURE` 원장 기록
- `generator-input-retry-{N}.json`처럼 재시도 입력 파일을 지정해 다시 실행 가능

아직 자동화되지 않음:

- Validator-A/B CLI 실행
- Validator FAIL 리포트에서 `previous_attempts[].validator_feedback` 자동 생성
- 동일 오류 2회 반복 감지
- Conflict Report 자동 작성
- Adjudication 판정 자동화

따라서 이 문서의 전략은 **정책과 handoff 구조에는 반영되어 있고**, 실행 자동화는 **Generator 호출 단계까지 반영**되어 있다. Validator 반복 루프 전체를 완전 자동화하려면 별도 wrapper가 필요하다.

---

## 9. 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| 1.0 | 2026-04-28 | 최초 작성 (TASK-20260428-001 후속 가이드) |
