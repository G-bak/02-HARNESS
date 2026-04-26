# ARCHITECTURE.md — 시스템 구조

**버전:** 1.2 | **최종 수정:** 2026-04-26

---

## 에이전트 구성도

```
┌─────────────────────────────────────────────┐
│                   사용자                    │
└──────────────────┬──────────────────────────┘
                   │ 요청
                   ▼
┌─────────────────────────────────────────────┐
│           Analyst (오케스트레이터)           │
│  요청 해석 → Task Spec → 에이전트 지시 → 보고│
└────────┬──────────────┬──────────┬──────────┘
         │              │          │
         ▼              ▼          ▼
  ┌──────────┐   ┌──────────┐  ┌─────────────────────┐
  │Researcher│   │Generator │  │      Validator       │
  │(탐색형)  │   │(생성형)  │  │  A: Codex (Tier 2+) │
  └──────────┘   └──────────┘  │  B: Gemini (Tier 3) │
                                └─────────────────────┘
```

---

## 4블록 하네스 아키텍처

```
INPUT                        CORE                          EXECUTION
┌──────────────┐      ┌─────────────────────┐      ┌────────────────────┐
│  User / Spec │─────▶│  Agent Harness       │─────▶│    Tool Layer      │
├──────────────┤      │  Controller          │      │ Shell / FS /       │
│  Knowledge   │─────▶│  (루프·라우팅·정책)  │      │ Browser / MCP      │
│  Map         │      └──────────┬───────────┘      │ Sandbox / Runner   │
│  AGENTS.md   │    ◀────────────┘ feedback loop    └──────────┬─────────┘
│  + docs/     │                                               │
└──────────────┘                                    ┌──────────▼─────────┐
                             ┌──────────────────────│     OBSERVE        │
                             │                      │ Traces·Logs·Diffs  │
                             ▼                      └────────────────────┘
                    ┌─────────────────┐
                    │     VERIFY      │
                    │ Lint·Tests·Evals│
                    └─────────────────┘
```

**4블록 설계 원칙:** 각 블록은 독립적으로 교체 가능하며 안전 경계가 명확하다.

---

## Tier 시스템

| Tier | 핵심 판단 기준 | 투입 에이전트 | 검증 방식 |
|---|---|---|---|
| **Tier 1** | 영향 범위 1파일 이하, 즉시 되돌리기 가능 | Analyst + Generator | Analyst 자체 검토 |
| **Tier 1 예외** | 파일 변경 없음 + Generator 미투입인 조사 전용 작업 | Analyst + Researcher | Analyst 자체 검토 (상세: tier-classification.md) |
| **Tier 2** | 복수 파일, 실패 시 수정 사이클로 해결 가능 | 전체 에이전트 풀 | Validator-A (Codex) 단독 |
| **Tier 3** | 아래 조건 중 하나라도 해당 | 전체 + 복수 Validator | Validator-A + Validator-B 둘 다 PASS |

**Tier 3 해당 조건 (하나라도 해당하면 즉시 Tier 3):**
- 보안 또는 인증 로직 변경
- DB 스키마 변경 또는 데이터 마이그레이션
- 외부 공개 API의 breaking change (필드 제거·타입 변경·인증 방식 변경 등 / non-breaking 추가는 Tier 2)
- 프로덕션 환경에 즉시 반영되는 작업
- 실패 시 데이터 손실 또는 서비스 중단 가능성

> 단순해 보여도 되돌리기 어려우면 Tier 3이다.  
> 복잡해 보여도 되돌리기 쉬우면 Tier 2다.

---

## 실행 환경 및 접근 권한

| 에이전트 | 실행 환경 | 브랜치 접근 권한 | 적용 Tier |
|---|---|---|---|
| Analyst | 메인 AI 세션 | 읽기 전용 + reports/*, logs/*, CURRENT_STATE.md 쓰기 허용 | 전체 |
| Researcher | 외부 탐색 환경 | 없음 | 2, 3 |
| Generator | Claude Code CLI | `task/{TASK-ID}` 쓰기만 | 1, 2, 3 |
| Validator-A | Codex CLI + Sandbox | `task/{TASK-ID}` 읽기, main 머지 권한 | 2, 3 |
| Validator-B | Gemini CLI + Sandbox | `task/{TASK-ID}` 읽기 | 3 전용 |

---

## 컨텍스트 공유 범위

| 구성 요소 | Analyst | Researcher | Generator | Validator |
|---|:---:|:---:|:---:|:---:|
| 전체 대화 이력 | ✅ | ❌ | ❌ | ❌ |
| Task Spec | ✅ | 일부 | ✅ | ✅ |
| 이전 작업 요약 (L2) | ✅ | 필요 시 | 필요 시 | ❌ |
| 규칙 문서 | ✅ | ❌ | ✅ | ✅ |
| Research Summary | ✅ | ❌ | 필요 시 | ❌ |
| Generator 결과물 | ✅ | ❌ | ❌ | ✅ |

**원칙:** 에이전트에게는 해당 작업 수행에 필요한 최소 컨텍스트만 전달한다.

---

## 표준 작업 흐름 요약

```
사용자 요청
    ↓
[Analyst] Task Spec 생성 + Tier 분류
    ↓
    ├─ Tier 1 → Generator → Analyst 검토 → 완료
    │
    ├─ Tier 2 → (Researcher?) → Generator → Validator-A → PASS → main 머지
    │                                                   → FAIL → Generator 수정 (최대 3회)
    │
    └─ Tier 3 → (Researcher?) → Generator → Validator-A + Validator-B (독립 병렬)
                                           → 둘 다 PASS → Analyst 최종 승인 → main 머지
                                           → 하나라도 FAIL → Generator 수정
                                           → 충돌 시 → Analyst 중재
    ↓
[Analyst] 최종 통합 보고서 → 사용자
```

상세 흐름: [docs/workflows/task-lifecycle.md](./docs/workflows/task-lifecycle.md)
