# QUALITY_SCORE.md — 품질 루브릭

**버전:** 1.2 | **최종 수정:** 2026-04-26  
**용도:** Generator 자체 검토 및 Validator 평가 기준. "느낌으로 개선하지 말라 — 결과물 + 프로세스 품질을 측정하라."

---

## 평가 구조

| 구성 요소 | 설명 |
|---|---|
| **Task** | 평가할 작업 정의 (Task Spec의 success_criteria) |
| **Trial** | 여러 번 실행으로 분산 감소 (비결정적 요소 통제) |
| **Grader** | 자동/수동 채점 기준 (아래 루브릭) |
| **Transcript** | 실행 과정 기록 (작업 이력) |
| **Outcome** | 결과 집계 및 이전 결과와 비교 |

---

## Outcome Quality (결과물 품질) — 60점

| 항목 | 배점 | 판단 기준 |
|---|---|---|
| success_criteria 충족 | 25점 | Task Spec의 모든 기준 항목 PASS |
| 기능 정확성 | 15점 | 엣지 케이스 포함, 런타임 오류 없음 |
| 코드 품질 | 10점 | 정적 분석 통과, 명백한 anti-pattern 없음 |
| 보안 취약점 없음 | 10점 | OWASP Top 10 기준, 하드코딩된 민감 정보 없음 |

## Process Quality (프로세스 품질) — 40점

| 항목 | 배점 | 판단 기준 |
|---|---|---|
| 컨텍스트 최소화 | 10점 | 불필요한 정보를 에이전트에게 전달하지 않음 |
| 재시도 없이 PASS | 10점 | 1회 통과 = 10점, 재시도 1회 = 7점, 2회 = 4점, 3회 = 0점 |
| 작업 이력 완전성 | 10점 | 모든 단계에 타임스탬프 + 근거 기록 |
| 보고 명확성 | 10점 | Executive Summary 포함, 완료 여부·영향도·검증·리스크·조치 필요 여부 명확 |

---

## 등급 기준

| 점수 | 등급 | 의미 |
|---|---|---|
| 90–100 | **S** | 재시도 없이 통과, 모든 기준 충족 |
| 75–89 | **A** | 소수 재시도, 주요 기준 충족 |
| 60–74 | **B** | 복수 재시도 또는 보조 기준 미충족 |
| 40–59 | **C** | 핵심 기준 일부 미충족, 개선 필요 |
| 0–39 | **F** | 핵심 기준 다수 미충족, 전략 재검토 필요 |

---

## 자동 채점 항목 (Validator 수행)

```
[ ] 문법 오류 없음 (정적 분석 PASS)
[ ] 런타임 오류 없음 (테스트 실행 PASS)
[ ] 하드코딩된 민감 정보 없음 (secrets scan)
[ ] success_criteria 전 항목 체크 완료
[ ] 미처리 예외(unhandled exception) 없음
[ ] 규칙 문서 위반 없음
```

## 수동 채점 항목 (Analyst 수행)

```
[ ] 결과물이 사용자 의도와 일치하는가
[ ] 보고서가 대표/관리자가 읽기 적합한 Executive Summary와 실행 가능한 정보를 포함하는가
[ ] 회고 섹션에 재발 방지 인사이트가 포함되어 있는가
[ ] 가이드 업데이트 제안 항목이 적절한가
```

---

## 점수 기록 형식

점수는 `logs/quality-scores.jsonl`에 JSON Lines로 append 한다.
Tier 2/3는 기본 기록 대상이며, Tier 1은 운영 규칙 변경이나 사용자가 요청한 경우 기록한다.
기록을 생략하면 해당 Task 원장에 생략 사유를 남긴다.

```json
{
  "task_id": "TASK-20260424-001",
  "scored_by": "Validator-A | Analyst",
  "outcome_score": 55,
  "process_score": 35,
  "total_score": 90,
  "grade": "S",
  "breakdown": {
    "success_criteria": 25,
    "functional_accuracy": 13,
    "code_quality": 9,
    "security": 8,
    "context_minimization": 9,
    "retry_count": 10,
    "history_completeness": 9,
    "report_clarity": 7
  },
  "improvement_notes": "보고서 주의사항 섹션의 강조가 부족했음"
}
```
