# Eval Harness — 평가 및 개선 루프

**버전:** 1.8 | **최종 수정:** 2026-04-29
**원칙:** "측정해야 평가하고, 평가해야 개선한다. 느낌으로 개선하지 말라."

---

## Evaluation Harness 구성

| 구성 요소 | 역할 | 담당 |
|---|---|---|
| **Task** | 평가할 작업 정의 (success_criteria) | Analyst |
| **Trial** | 여러 번 실행으로 분산 감소 | Analyst |
| **Grader** | 자동/수동 채점 기준 | Validator + Analyst |
| **Transcript** | 실행 과정 기록 (원장: `logs/tasks/*.jsonl`) | 전체 에이전트 + Analyst 취합 |
| **Outcome** | 결과 집계 및 이전 결과와 비교 | Analyst |

---

## 측정 대상

**Outcome Quality (결과물 품질):**  
success_criteria 충족 여부, 기능 정확성, 코드 품질, 보안 취약점 부재

**Process Quality (프로세스 품질):**  
재시도 없이 1회 통과 여부, 컨텍스트 최소화, 작업 이력 완전성, 보고 명확성

→ 채점 기준 상세: [QUALITY_SCORE.md](../../QUALITY_SCORE.md)

---

## 자기 평가의 함정

> "자기 작업을 채점하면, 에이전트는 형편없어도 자신 있게 칭찬한다." — Anthropic

**해결책:** Generator가 자신의 결과물을 스스로 최종 판정하지 않는다. 반드시 독립된 Validator가 검증한다.

---

## 가이드 문서 지속 개선 프로세스

하네스는 고정된 규칙서가 아닌 살아있는 시스템이다.  
매 Task에서 배운 것을 가이드에 녹여내어 하네스 자체를 진화시킨다.

### 인사이트 수집 (매 Task 완료 후 Analyst 수행)

| 태그 | 의미 | 예시 |
|---|---|---|
| `[NEW_RULE]` | 가이드에 없던 새 규칙 필요 | "Researcher confidence NONE 처리 기준 없음" |
| `[UPDATE_RULE]` | 기존 규칙이 현실과 맞지 않아 수정 필요 | "재시도 3회 기준이 단순 오류에는 과도함" |
| `[REMOVE_RULE]` | 적용되지 않거나 해가 되는 규칙 | "특정 규칙이 더 느린 결과를 유발" |
| `[NEW_PATTERN]` | 발견된 더 나은 협업 패턴 | "Generator 자체 검토 후 Analyst 중간 보고가 품질을 높임" |
| `[CAUTION]` | 특정 상황에서 주의해야 할 점 | "다중 요청 시 컨텍스트 누적이 L2 압축을 빠르게 초과함" |

### 인사이트 기록 형식

```json
{
  "task_id": "TASK-20260424-001",
  "discovered_at": "ISO8601",
  "tag": "UPDATE_RULE",
  "target_section": "failure-handling.md — 재시도 정책",
  "situation": "단순 문법 오류의 경우 3회 재시도 전 1회만에 해결됨에도 대기 발생",
  "current_rule": "최대 재시도 횟수: 3회",
  "proposed_change": "오류 유형(CRITICAL/MINOR)에 따라 재시도 횟수 차등 적용",
  "evidence": "TASK-20260424-001에서 MINOR 오류 수정에 3회 적용 → 불필요한 지연 2분"
}
```

**저장 위치:** 인사이트는 `logs/insights.jsonl`에 한 줄씩 append한다 (Task 완료 후 Analyst 수행).  
개별 Task 이력(`logs/tasks/TASK-{ID}.jsonl`)의 `insights` 필드는 해당 Task 스코프에만 기록하며,  
가이드 개선에 활용되는 누적 원장은 `logs/insights.jsonl`이 단일 권위 파일이다.

**기록 생략 정책:** 해당 Task에서 발견된 인사이트가 없으면 `logs/insights.jsonl` 기록을 생략한다. 빈 항목을 강제로 기록하지 않는다. 파일 자체는 삭제하지 않고 유지한다.

### 가이드 업데이트 절차

```
1. 각 Task 완료 시 → Analyst가 인사이트 기록
2. 업데이트 검토 조건:
   - 동일 섹션에 대한 인사이트 3건 이상 누적
   - CRITICAL 또는 HIGH 영향도 인사이트 발생 즉시
   - 가이드 오류/stale 문구/wrapper 실제 동작 차이처럼 다음 세션에서 같은 실수를 반복하게 만드는 결함 발견 즉시
3. Analyst가 업데이트 제안서 작성 (변경 전/후 비교, 근거 task_id 목록)
4. 가이드 문서 반영:
   - 문서 버전 증가 (예: 1.0 → 1.1)
   - 변경 내역에 날짜 및 근거 task_id 기록
   - 이전 버전 규칙을 주석 형태로 보존 (삭제 금지)
```

반복 가능한 운영 결함은 보고서에만 적고 닫지 않는다. `logs/insights.jsonl`에는 `actionable_doc_change` 또는 `gotcha`로 기록하고, 같은 Task에서 관련 가이드 또는 wrapper/audit script를 고친다. 기억에 의존하면 다시 누락될 가능성이 높은 항목은 문서보다 스크립트 강제를 우선 검토한다.

`scripts/check-completion-gates.mjs`는 이 원칙의 최소 게이트를 가진다. `insight_capture.status=not_needed`가 보고서만 근거로 들고, 보고서가 가이드/wrapper/감사 스크립트의 반복 가능한 결함을 언급하는데 인사이트·GUIDE_UPDATED·후속 Task 링크가 없으면 완료를 차단한다.

### 품질 임계값 트리거 (자동 가이드 재검토)

Analyst는 Task 완료 시마다 최근 5건의 QUALITY_SCORE 평균을 산출한다.

품질 점수 저장 위치:

```text
logs/quality-scores.jsonl
```

최근 5건 산정 기준:

- `logs/quality-scores.jsonl`의 append 순서가 아니라 `recorded_at` 오름차순 기준으로 정렬한다.
- `recorded_at`이 같거나 누락된 legacy 행은 `task_id` 순서를 보조 기준으로 사용한다.
- backfill 행은 실제 기록 시각을 `recorded_at`에 남기되, 최근 평균 계산이 왜곡되지 않도록 `scripts/check-quality-scores.mjs` 결과를 확인한다.

규칙:

- Tier 2/3 작업은 완료 시 품질 점수를 기록한다.
- Tier 1은 사용자가 요청했거나 운영 규칙 변경 작업이면 기록한다.
- 점수 산출을 생략하면 `TASK_COMPLETED.details.quality_score_skipped_reason`에 사유를 남긴다.
- 최근 5건 평균은 `logs/quality-scores.jsonl` 기준으로 계산한다.

| 조건 | 즉시 조치 |
|---|---|
| 최근 5건 평균 **B 등급(60~74점) 이하** | 가이드 전면 재검토 Task를 즉시 생성 |
| 연속 3건 **C 등급(40~59점) 이하** | 가이드 재검토 + 사용자에게 시스템 상태 보고 |
| 단일 Task **F 등급(0~39점)** | 즉시 사용자에게 보고 + 해당 Task 원인 분석 우선 수행 |

**가이드 재검토 Task 형식:**
```
task_id: TASK-{DATE}-GUIDE-REVIEW
goal: 최근 품질 저하 원인 분석 및 가이드 문서 개선
trigger: 최근 5건 평균 {점수}점 ({등급}) — 임계값 미달
검토 대상: QUALITY_SCORE.md 항목별 저점 원인, 관련 가이드 섹션
```

---

## 관측성 (Observability)

에이전트 실행을 추적하여 비용, 품질, 병목을 측정한다.

### 추적 항목

| 항목 | 측정 방법 |
|---|---|
| 토큰 사용량 (입력/출력) | 에이전트별 별도 집계 |
| USD 비용 | 모델별 요금 × 사용량 |
| 지연 시간 | Task 시작~완료 (p50, p99) |
| 재시도 횟수 | Validator FAIL 카운트 |
| Resource Failure 발생률 | RATE_LIMIT, QUOTA_EXHAUSTED, CONTEXT_LIMIT 등 유형별 집계 |
| Resource Failure로 인한 HOLD 시간 | 리소스 제한 발생~재개까지 소요 시간 |
| Tier 재분류 발생률 | 월별 집계 |
| QUALITY_SCORE 분포 | S/A/B/C/F 등급 비율 |

Resource Failure는 결과물 품질 실패로 채점하지 않는다.  
다만 Process Quality에는 지연 시간, HOLD 시간, 컨텍스트 관리 실패 여부로 반영한다.

### Langfuse 통합 (선택)

오픈소스(MIT) LLM 관측성 플랫폼. Claude Code + Codex 사용을 통합 추적한다.

```python
# Anthropic SDK 통합 예시
from anthropic import Anthropic
from langfuse.decorators import observe

@observe()
def run_generator_agent(task_spec):
    client = Anthropic()
    # 에이전트 실행 로직
    ...
```

연동 방식:
- Anthropic: `@observe` 데코레이터
- OpenAI (Codex): import 한 줄 교체
- OpenTelemetry 네이티브 (v4)
- Self-hosted: Docker / K8s

### 평가 방식

| 방식 | 용도 |
|---|---|
| **LLM-as-Judge** | 자동 채점, 대량 평가 |
| **Human Annotation** | 수동 리뷰, 기준 보정 |
| **Custom Score** | SDK/API로 도메인 특화 점수 산출 |
| **Dataset + Experiment** | A/B 비교, 하네스 변경 효과 측정 |

---

## 실무 첫 걸음

거창한 벤치마크보다 **실제 이슈 10~20개를 재현하는 mini regression set**이 가장 실용적이다.

```
1. 과거 실패했던 Task 10개를 선별
2. 각 Task의 success_criteria를 재정의
3. 현재 하네스로 재실행
4. QUALITY_SCORE로 채점
5. 이전 결과 대비 개선/회귀 측정
```

→ 이 결과가 가이드 문서 업데이트의 근거가 된다.

---

## 자동 감사 스크립트

하네스 운영 규칙은 문서에만 두지 않고 최소한의 로컬 스크립트로 반복 확인한다.

| 스크립트 | 확인 내용 | 실행 시점 |
|---|---|---|
| `node scripts/check-doc-headers.mjs` | `CURRENT_STATE.md` 권위 문서 표와 실제 파일 헤더의 버전·날짜 일치 | 세션 재진입, 가이드 변경 후 |
| `node scripts/validate-ledger.mjs` | `logs/tasks/*.jsonl` JSON 파싱, `TASK_CREATED` 존재, 상태 enum, Task Spec SSOT 존재 또는 legacy 보정 사유 | Task 완료 전 |
| `node scripts/check-completion-gates.mjs` | Tier 2/3 보고서·품질 점수·검증/머지 증거 또는 명시적 생략 사유, 완료 보고서의 stale 예정 문구, 완료 시 dirty worktree 예외 사유. 활성 Task 원장이 있으면 작업 중 dirty 상태를 직전 완료 Task 실패로 오판하지 않음 | 보고서 작성 후, 완료 전 |
| `node scripts/check-quality-scores.mjs` | 품질 점수 JSONL 형식, `recorded_at`, 최근 5건 평균 산정 기준 확인 | 품질 점수 기록 후 |

전체 감사는 아래 단일 명령을 우선 사용한다.

```bash
npm run audit:harness
```

운영 규칙 변경 Task는 위 감사 명령을 실행하고 결과를 Task 원장과 보고서에 기록한다.

## 문서 클래스와 감사 범위

모든 Markdown이 같은 권위를 갖지는 않는다. 문서 클래스별 감사 범위를 구분한다.

| 클래스 | 예시 | 감사 기준 |
|---|---|---|
| Authority | `AGENTS.md`, `ARCHITECTURE.md`, `SECURITY.md`, `docs/agents/**`, `docs/workflows/**`, `docs/operations/**`, `docs/schemas/**`, `QUALITY_SCORE.md`, `reports/TASK-EXAMPLE.md` | `CURRENT_STATE.md` 표와 헤더 버전·날짜 일치 필수 |
| Operational guide | `docs/guides/**`, `CLAUDE.md` | 헤더 권장. 권위 문서와 충돌 금지. 필요 시 별도 가이드 감사에 포함 |
| Product/runtime doc | `README.md`, `wrangler.toml` 관련 설명 | 제품 기능과 배포 사실 기준. 하네스 권위 규칙을 재정의하지 않음 |
| Plan/archive | `docs/plans/**`, `archive/**` | 현재 운영 기준으로 사용하지 않음. stale 문구가 있어도 완료 게이트 대상에서 제외 가능 |

권위 규칙을 바꾸는 내용은 반드시 Authority 문서에 반영한다. Operational guide나 README는 권위 문서를 참조할 수 있지만 독자 규칙을 만들지 않는다.
