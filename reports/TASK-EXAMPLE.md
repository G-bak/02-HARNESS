# TASK-EXAMPLE.md — 보고서 예시 파일

**버전:** 1.7 | **최종 수정:** 2026-04-29

> 실제 운영 시 이 구조를 따른다. Tier 1은 인라인 보고만 사용하고, Tier 2/3부터 `reports/TASK-{ID}.md` 상세 보고서를 작성한다.  
> 본 버전부터 Tier 2/3 보고서 본문은 **에이전트별 활동 이력** 형식이 표준이다. 단순 "수행 결과 / 수행 과정" 묶음으로 적지 않고, 각 에이전트가 무엇을 결정·수행·산출했는지를 행위 주체별로 기록한다.

---

## 공통 작성 원칙

- `task_id`는 `TASK-{YYYYMMDD}-{001부터 순번}` 형식만 사용한다.
- Tier 2/3, HOLD, Resource Failure, FAILED, Adjudication 보고서는 필수다.
- Tier 1 일반 작업은 인라인 보고로 충분하지만, 사용자가 요청하거나 운영 규칙 변경이면 보고서를 작성한다.
- 첫 화면은 `핵심 요약` (10줄 이내)으로 의사결정자가 바로 판단 가능해야 한다.
- 본문 중심은 `에이전트별 활동 이력`이며, 각 에이전트의 substance(결정·도구 사용·산출 narrative)를 기록한다.
- API key, webhook URL, password, token, PII는 보고서에 기록하지 않는다.
- 외부 모델 호출이 발생한 에이전트는 실제 비용·duration·turns를 적는다. dry-run/self-validation은 그 사실을 명시한다.

## 표준 보고서 구조

Tier 2/3 보고서는 아래 순서를 따른다.

```markdown
# TASK-{ID} 보고서 — {작업명}

## 0. 핵심 요약
- 상태:
- 결론:
- 서비스 영향:
- 검증:
- 남은 리스크:
- 조치 필요:

## 1. 요청 및 목표
- 사용자 원문, 해석된 목표, Tier 분류 근거, 성공 기준

## 2. 에이전트별 활동 이력  ← 본문 중심
### 🔵 Generator (Claude Code CLI)
### 🟢 Validator-A (Codex CLI)
### 🟣 Validator-B (Gemini CLI)        ← Tier 3만
### 🟡 Researcher                       ← 투입 시
### 🟠 Analyst (Orchestration)

## 3. 변경 사항 (파일별)
## 4. 검증 및 승인
## 5. 영향도 및 리스크
## 6. 비용·리소스·알림
## 7. 품질 점수
## 8. 인사이트 캡처
## 9. 다음 권장 사항
```

`핵심 요약`은 10줄 이내. 바쁜 의사결정자는 이 섹션만 읽어도 상태 판단 가능해야 한다.

---

## 에이전트별 섹션 작성 가이드

각 에이전트 섹션은 다음 형식을 따른다.

### 머리말 메타

```text
- 실제 호출 여부: ✅ / ❌ (호출 안 했으면 사유 명시)
- 호출 횟수: N (시도 단위)
- 런타임 메타: 바이너리 / duration / cost / turns / models / exit_status
```

### 실제 한 일 (substance, 1~3 문단)

다음 질문에 답한다.

1. 무엇을 받았고 어떻게 해석했는가
2. 어떤 도구를 어떤 순서로 어떻게 썼는가
3. 무엇을 만들었고 본문의 핵심이 무엇이었는가
4. 자기 작업을 어떻게 보고·검증했는가
5. 어떤 경계를 지켰는가 (자기-검증 회피, target_files 준수, 시크릿 보호 등)

이 부분은 "파일 X를 읽음" 같은 행동 나열이 아니라 **그 행동의 의도와 의미**를 한 문장 더 붙인다. 예: "validator.md를 매 호출마다 재로드해 자기 역할 정의를 fresh execution에 박아넣었다."

### 시도별 여정

```markdown
| # | 결과 | 원인·진단·fix |
|---|---|---|
| 1 | RESOURCE_FAILURE | ... |
| 2 | RESOURCE_FAILURE | ... |
| 3 | ✅ PASS | ... |
```

각 실패가 **새 정보를 어떻게 생성했는지** 보여준다. 동일 실패 단순 재시도라면 그건 별개 이슈로 회고에 적는다.

---

## 작성 톤

- 결론을 먼저 쓴다. 과정 설명은 뒤에 둔다.
- "수정함", "처리함" 대신 무엇이 어떻게 바뀌었는지 명확히 쓴다.
- 불확실한 내용은 `확인 필요`로 분리한다.
- 실패·보류·리스크는 숨기지 않는다. 단, 원인·영향·다음 조치를 함께 적는다.
- 과도한 로그 전문, 코드 전문, 내부 추론 과정은 넣지 않는다.

### 품질 점수 작성 원칙

대표 보고서의 품질 점수는 JSON 원문을 먼저 보여주지 않는다.

권장 형식:

```markdown
**종합 점수: 95점 / 100점 (S등급)**

| 구분 | 점수 | 의미 |
|---|---:|---|
| 결과물 품질 | 57 / 60 | 요청한 성공 기준을 대부분 충족했다. |
| 진행 품질 | 38 / 40 | 기록, 검증, 보고가 빠짐없이 남았다. |
| 총점 | 95 / 100 | 운영에 바로 적용 가능한 수준이다. |

**좋았던 점:** 핵심 기준을 충족했고 검증도 통과했다.  
**감점/주의:** 남은 리스크 또는 다음에 보완할 점을 한 줄로 적는다.
```

JSON 원문은 내부 감사가 필요할 때만 접어둘 수 있는 부록이나 원장에 남긴다.

---

# Tier 1 예시 — 인라인 보고

Tier 1은 단일 파일 이하, 즉시 되돌릴 수 있는 작업이다. 파일 보고서는 만들지 않고 채팅 인라인 보고만으로 완료 처리한다.

```text
TASK-20260426-001 완료 [Tier 1]

목표: 메인 페이지 헤더 문구 오타 수정 ("Welcme" -> "Welcome")
결과물: src/pages/Home.jsx
주의: 없음
회고 제안: [CAUTION] 배포 전 정적 텍스트 spell-check 자동화 검토
```

---

# TASK-20260429-017 보고서 — Tier 2 첫 진짜 멀티 에이전트 사이클 예시

> 이 예시는 실제 TASK-20260429-017의 운영 데이터를 기반으로 한 살아있는 템플릿이다.

## 0. 핵심 요약

- **상태:** COMPLETE
- **결론:** Validator-A wrapper가 실제 Codex CLI를 호출해 TASK-015의 Generator 산출물을 검증, PASS 판정을 받아 02-HARNESS의 첫 진짜 multi-agent end-to-end 사이클을 완성했다.
- **서비스 영향:** 제품 런타임 영향 없음. 운영 도구·검증 절차의 신뢰성이 실증으로 확보됐다.
- **검증:** Validator-A PASS (Codex CLI 실제 실행, 5개 success_criteria 모두 PASS, errors[] 빈 배열).
- **남은 리스크:** Codex CLI 호환성 fix 2건이 같은 Task에서 적용됨 — 향후 Codex 버전 업데이트 시 회귀 가능성. 정기 smoke로 모니터링 필요.
- **조치 필요:** 없음. 정기 smoke 스케줄 검토 권장.

## 1. 요청 및 목표

- **원문:** "TASK-016 wrapper 수정 후 실제 Validator-A smoke를 다시 돌려보자."
- **해석된 목표:** TASK-015에서 Generator가 만든 smoke-target.md를 Validator-A wrapper로 실제 검증해 end-to-end 사이클의 살아있음을 입증.
- **Tier 분류 근거:** 권위 문서 변경 가능성 + 외부 CLI 실제 호출 + 결과물 main 머지. Tier 2.
- **성공 기준:**
  - smoke-target.md가 정확한 라인 포함
  - Generator 결과 status = PENDING_VALIDATION
  - artifact 목록에 smoke-target.md 포함
  - 시크릿/PII 부재
  - Resource Failure는 Validator FAIL로 취급 안 함

---

## 2. 에이전트별 활동 이력

### 🟢 Validator-A (Codex CLI)

- **실제 호출 여부:** ✅
- **호출 횟수:** 3 (3rd attempt에서 성공)
- **런타임 메타:** codex.cmd → cmd.exe → codex / duration 47s / exit 0 / sandbox read-only / approval never

**실제 한 일 (substance):**

Validator-A는 두 단계로 작업했다. 첫 단계에서 자기-검열로 부족한 증거를 인지했고, 두 단계에서 직접 파일을 읽어 증거를 확보한 뒤 판정했다.

첫 응답에서 Validator-A는 이미 구조화된 verdict를 만들었지만 그 verdict를 **FAIL로 자기 판정**했다. evidence_type=`SPEC_INTERPRETATION`, severity=`CRITICAL`로 "Cannot perform validation because tool access for reading repository files was not available in this response path." 라고 명시. 검증을 제대로 못 했으면 PASS를 위장하지 않고 FAIL로 정직 신고하는 evidence 디스플린이 외부 모델 행동으로 작동한 첫 사례다.

자기-진단 후 PowerShell `Get-Content -Raw` 명령으로 6개 파일을 의도적으로 다른 목적으로 읽었다. 단순히 deliverable만 읽는 게 아니라 **자기 역할 정의(`docs/agents/validator.md`)와 보안 기준(`SECURITY.md`)을 매 호출마다 재로드**해 판정 기준을 fresh execution에 박아넣었다. 그 다음 deliverable인 `smoke-target.md`를 문자 단위로 확인 ("정확한 줄, 트레일링 줄바꿈 1개만"), Generator result.json의 status 필드를 직접 인용 검증, artifacts 배열을 cross-check했다.

최종 agent_message는 5개 success_criteria 각각에 대한 PASS 근거를 능동적으로 작성했다. 수동 "OK"가 아니라 "이 파일을 이 방식으로 읽어 확인했다" 형식으로 검증 작업의 실재성을 입증. `errors[]: []`, `tier_reclassification_needed: false`로 추가 이슈 없음 명시.

**시도별 여정:**

| # | 결과 | 원인·진단·fix |
|---|---|---|
| 1 | RESOURCE_FAILURE | Codex CLI 호출 자체 실패 — wrapper의 `-a never` 플래그가 `exec` 뒤에 위치해 Codex가 인식 못함. wrapper에서 옵션 위치를 `exec` 앞으로 이동. |
| 2 | RESOURCE_FAILURE | Codex의 strict structured output이 우리 schema 일부 필드를 거부. `validator-result.schema.json`을 Codex 호환 형태로 정정. |
| 3 | ✅ PASS | 명령 형태 + schema 양쪽 보정 후 정상 검증 작업 수행. duration 47s, 6개 파일 read, 5/5 criteria PASS. |

각 실패가 다른 격리 변수에서 발생했고 각각 즉시 fix됨 (정책에 따라 같은 Task에서 가이드/스크립트 수정 강제). 무한 RESOURCE_FAILURE 루프가 아니라 각 실패가 새 정보를 생성하는 정직한 디버깅 사이클이었다.

### 🔵 Generator (Claude Code CLI)

- **실제 호출 여부:** 본 Task에서는 ❌ (사유: 검증 대상은 직전 TASK-015에서 이미 Generator 산출물 `smoke-target.md`임. 본 Task는 Validator-A 단독 검증 Task로 한정)
- **참조 산출물:** `tasks/handoffs/TASK-20260429-015/smoke-target.md` (TASK-015 Generator가 생성, status PENDING_VALIDATION으로 인계됨)

### 🟣 Validator-B (Gemini CLI)

- **투입 없음** — 사유: Tier 2 작업으로 Validator-A 단독 검증으로 충분.

### 🟠 Analyst (Orchestration)

- **실제 한 일:** Task spec 작성, Validator-A handoff 발행, 3회의 wrapper 실패 진단 및 fix 결정, MERGE_COMPLETED·CORRECTION·인사이트 기록, 2-commit squash 머지·push.
- **결정:** 매 RESOURCE_FAILURE에서 단순 재시도가 아니라 격리 변수 변경 (`-a never` 위치 → schema 호환성)으로 진단. 두 fix를 발견 즉시 같은 Task에서 적용해 운영 자동화 가능 상태로 회복.

---

## 3. 변경 사항

| 영역 | 파일 | 변경 |
|---|---|---|
| Wrapper | `scripts/run-validator-a.mjs` | `-a never` 옵션 위치 fix |
| Schema | `docs/schemas/validator-result.schema.json` | Codex strict 호환성 정정 |
| 운영 기록 | TASK-017 ledger / 인사이트 / quality / report / CURRENT_STATE | 표준 게이트 |

## 4. 검증 및 승인

| 검증자 | 결과 | 근거 |
|---|---|---|
| Validator-A | PASS (Codex CLI 실제 실행) | 5/5 success criteria, errors[] 빈 배열 |
| Resource Failure | 1, 2번 시도 — 모두 정상 처리 (HOLD, fix 후 재실행) |  |

## 5. 영향도 및 리스크

- 운영 자동화 wrapper 회로 절반(Validator-A) 실증.
- Codex CLI 버전 업데이트 시 호환성 회귀 가능 — 정기 smoke 스케줄 검토.

## 6. 비용·리소스·알림

| 호출 | 모델 | 비용 |
|---|---|---|
| Validator-A 시도 1, 2 | Codex (failed before model) | $0 |
| Validator-A 시도 3 | Codex 기본 모델 | Codex 구독 (사용자 직접 청구) |

## 7. 품질 점수

**종합 점수: 94점 / 100점 (S등급)**

| 구분 | 점수 | 의미 |
|---|---:|---|
| 결과물 품질 | 57 / 60 | 5개 success criteria 모두 PASS, evidence 디스플린 입증 |
| 진행 품질 | 37 / 40 | 3회 시도가 모두 새 정보 생성, 발견 즉시 fix 적용 |
| 총점 | 94 / 100 | 첫 진짜 multi-agent 사이클 완성 |

**좋았던 점:** Validator-A의 evidence 디스플린이 외부 모델에서도 작동.  
**감점/주의:** Codex 버전 호환성을 정기 smoke로 모니터링.

## 8. 인사이트 캡처

- INS-XXX-01 (gotcha): Codex `-a never` 옵션 위치 의존성. → wrapper 가이드 ⚠ 적용
- INS-XXX-02 (gotcha): Codex strict structured output schema 호환성. → schema 가이드 ⚠ 적용

## 9. 다음 권장 사항

- 정기 smoke (주 1회) 스케줄 검토.
- Validator-B (Gemini CLI) 첫 실호출 시도 별도 Task.

---

# TASK-20260426-004 보고서 — Resource Failure / HOLD 예시 (legacy 형식 유지)

이 시나리오 (Resource Failure HOLD)는 에이전트별 활동 이력 표현이 짧기 때문에 legacy 보고 형식으로도 유효하다. Tier 2/3에서 단순 HOLD 보고는 아래처럼 작성한다.

## 0. 핵심 요약

- **상태:** HOLD / PENDING_VALIDATION
- **결론:** 구현은 완료됐지만 Validator-A rate limit으로 검증이 끝나지 않았다.
- **서비스 영향:** main 머지는 보류되어 운영 반영은 발생하지 않았다.
- **검증:** 필수 Validator PASS 미확보
- **남은 리스크:** 검증 전이므로 기능 정확성 및 회귀 여부는 확정할 수 없다.
- **조치 필요:** rate limit 해제 후 Validator-A 재실행 필요

## 2. 에이전트별 활동 이력

### 🟢 Validator-A (Codex CLI)

- **실제 호출 여부:** ❌ (RATE_LIMIT으로 invocation 자체 실패)
- **호출 횟수:** 1 (Resource Failure)
- **런타임 메타:** codex / 도착 전 차단 / total_cost_usd: 0
- **실제 한 일:** N/A — Codex CLI 호출이 rate limit으로 도착 전 차단됨. wrapper가 `RESOURCE_FAILURE` + `HOLD` 상태로 정직하게 기록. main 머지 차단.
- **시도별 여정:** RATE_LIMIT 발생 → 10분 backoff 후 재시도 예정 (max 2회)

### 🔵 Generator (Claude Code CLI)

- 산출물 완료 상태로 PENDING_VALIDATION 인계.

### 🟠 Analyst (Orchestration)

- Task 상태를 `PENDING_VALIDATION`으로 유지, ACTION_REQUIRED Slack 알림 발송.

## 6. 비용·리소스·알림

```json
{
  "type": "RESOURCE_FAILURE_REPORT",
  "task_id": "TASK-20260426-004",
  "agent": "Validator-A",
  "resource_error_type": "RATE_LIMIT",
  "tool": "Codex CLI",
  "stage": "VALIDATION",
  "impact": "BLOCKS_VALIDATION",
  "task_status_after": "PENDING_VALIDATION",
  "retryable": true,
  "retry_after": "10m",
  "attempt_count": 1,
  "max_attempts": 2,
  "mitigation": "backoff 재시도"
}
```

---

# TASK-20260426-005 보고서 — Rebuttal / Adjudication 예시 (legacy 형식 유지)

Adjudication 케이스는 판정 충돌 자체가 핵심이라 에이전트별 활동에 더해 Adjudication 결정 근거 섹션이 추가된다.

## 0. 핵심 요약

- **상태:** COMPLETE
- **결론:** 검색 결과 기본 정렬을 최신순으로 변경했고, Validator 재현 절차 오류는 Adjudication으로 정정했다.
- **서비스 영향:** 사용자는 최신 생성 항목을 먼저 보게 된다.
- **검증:** Adjudication 후 Validator-A 재검증 PASS
- **남은 리스크:** 검색/필터 계열의 테스트 입력 기록을 더 명확히 남길 필요가 있다.
- **조치 필요:** 향후 유사 Task의 success_criteria에 기본값/명시값 케이스를 분리 기재

## 2. 에이전트별 활동 이력

### 🟢 Validator-A (Codex CLI)

- **실제 호출 여부:** ✅
- **호출 횟수:** 2 (1차 FAIL → Adjudication → 2차 PASS)
- **실제 한 일:** 1차에서 명시 정렬 옵션 미적용을 FAIL로 보고 (evidence_type `SPEC_INTERPRETATION`). 재현 절차에서 sort=name 요청과 기본 요청을 같은 컨텍스트로 처리. Adjudication 후 재현 절차 정정해 2차에서 PASS.
- **시도별 여정:** FAIL (재현 절차 오류) → Generator Rebuttal → Analyst Adjudication → Validator-A 재검증 PASS.

### 🔵 Generator (Claude Code CLI)

- **실제 호출 여부:** ✅
- **실제 한 일:** 기본 정렬을 `created_at DESC`로 변경. Validator FAIL을 코드 결함이 아니라 재현 절차 오류로 판단해 Rebuttal 제출. evidence로 sort=name 테스트 로그와 success_criteria 원문 인용.

### 🟠 Analyst (Orchestration)

- Adjudication 수행. Generator Rebuttal evidence 채택. Validator FAIL 철회 결정.

## 4. 검증 및 승인

**Adjudication Report:**

```json
{
  "task_id": "TASK-20260426-005",
  "agent": "Analyst",
  "type": "ADJUDICATION_REPORT",
  "trigger": "Generator REBUTTAL",
  "reviewed_errors": [
    {
      "description": "명시적 정렬 옵션이 무시된다는 Validator FAIL",
      "validator_evidence_type": "SPEC_INTERPRETATION",
      "generator_rebuttal_considered": true,
      "decision": "GENERATOR_UPHELD",
      "rationale": "success_criteria 원문과 테스트 로그상 명시 정렬 옵션은 정상 적용됨"
    }
  ],
  "next_action": "재검증"
}
```

---

# 보고서 작성 체크리스트

```text
[ ] 핵심 요약가 10줄 이내이며 상태, 결론, 영향, 검증, 리스크, 조치 필요 여부를 포함하는가
[ ] 대표/관리자가 첫 화면만 읽어도 의사결정 가능한가
[ ] task_id가 TASK-YYYYMMDD-NNN 형식인가
[ ] Tier 분류 근거가 실제 변경 범위 기준으로 적혀 있는가
[ ] success_criteria가 검증 가능한 문장인가
[ ] 에이전트별 활동 이력 섹션이 본문 중심으로 작성됐는가 (Tier 2/3)
[ ] 외부 호출이 있는 에이전트는 actual numbers (cost, duration, turns) 포함했는가
[ ] dry-run / self-validation은 그 사실을 명시했는가
[ ] 시도별 여정 표가 새 정보 생성 흐름을 보여주는가
[ ] Validator 결과와 evidence_type이 필요한 곳에 기록됐는가
[ ] 서비스 영향, 운영 영향, 사용자 영향이 구분되어 있는가
[ ] 남은 리스크와 조치 필요 사항을 숨기지 않았는가
[ ] Resource Failure를 Validator FAIL로 잘못 기록하지 않았는가
[ ] Rebuttal/Adjudication이 발생했다면 판정 근거와 next_action이 있는가
[ ] 품질 점수가 JSON 원문보다 쉬운 요약/표/감점 사유 중심으로 작성됐는가
[ ] 민감 정보 원문이 없는가
[ ] 인사이트 캡처에서 actionable_doc_change/gotcha 카테고리 게이트 충족했는가
```
