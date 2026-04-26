# Claude Thinking 모드 프롬프트 레퍼런스

**버전:** 1.0 | **최종 수정:** 2026-04-26  
**목적:** 개발 단계별 Claude 추론 깊이 유도 문구 정리  
**적용 대상:** Claude Code 세션, 에이전트 지시서 작성 시 참고

---

## 개요

Claude에 아래 문구를 지시서나 프롬프트 앞에 붙이면 해당 단계에 맞는 추론 방식을 유도할 수 있다.  
하네스 에이전트 지시서의 `instruction` 필드 첫 줄에 추가하는 용도로 사용한다.

---

## 단계별 유도 문구

### 요구사항 분석

| 문구 | 효과 |
|---|---|
| `clarify the requirements before solving` | 입력·출력·제약 조건을 먼저 정의 |
| `identify assumptions explicitly` | 숨겨진 전제 조건을 명시적으로 드러냄 |
| `break down the problem into smaller parts` | 문제를 단위별로 분해하여 접근 |

### 설계 및 아키텍처

| 문구 | 효과 |
|---|---|
| `analyze trade-offs between different approaches` | 여러 방법의 장단점 비교 |
| `design the solution before coding` | 구조·흐름 설계 후 구현 진행 |
| `choose appropriate data structures and algorithms` | 문제에 맞는 자료구조·알고리즘 선택 |

### 코드 구현

| 문구 | 효과 |
|---|---|
| `think step by step while implementing` | 단계별 구현, 한 번에 전체 작성 방지 |
| `write clean and maintainable code` | 가독성·네이밍·구조 우선 |
| `validate each step before moving on` | 중간 검증 후 다음 단계 진행 |

### 디버깅

| 문구 | 효과 |
|---|---|
| `trace the code execution step by step` | 코드 흐름을 순서대로 추적 |
| `identify root cause, not just symptoms` | 겉 증상이 아닌 근본 원인 탐색 |
| `check edge cases and unexpected inputs` | 예외 입력·경계값 점검 |

### 성능 최적화

| 문구 | 효과 |
|---|---|
| `analyze time and space complexity` | 시간·공간 복잡도 평가 |
| `identify bottlenecks in the system` | 병목 구간 식별 |
| `optimize only after correctness is ensured` | 정확성 확보 후 최적화 수행 |

### 예외 처리 및 안정성

| 문구 | 효과 |
|---|---|
| `consider edge cases thoroughly` | 경계값·예외 상황 철저 검토 |
| `handle errors gracefully` | 오류 발생 시 안전한 처리 경로 확보 |
| `validate inputs and outputs` | 입력·출력 값 검증 |

### 리팩토링

| 문구 | 효과 |
|---|---|
| `refactor for clarity and simplicity` | 단순성·가독성 중심 개선 |
| `remove duplication and unnecessary complexity` | 중복 제거, 불필요한 복잡성 축소 |
| `ensure behavior remains unchanged` | 리팩토링 후 기존 동작 유지 확인 |

### 테스트

| 문구 | 효과 |
|---|---|
| `write tests covering typical and edge cases` | 일반·예외 케이스 모두 커버 |
| `verify correctness with multiple scenarios` | 다양한 시나리오로 검증 |
| `think of failure scenarios` | 실패 상황까지 포함한 테스트 설계 |

---

## 복합 프롬프트 (전 단계 커버)

```
analyze the requirements,
break down the problem,
design the solution with trade-offs,
implement step by step,
consider edge cases,
and verify correctness before finalizing
```

설계 → 구현 → 검증 → 안정성을 단일 지시로 유도할 때 사용한다.

---

## 하네스 지시서 적용 예시

```json
{
  "agent": "Generator",
  "task_id": "TASK-20260426-001",
  "instruction": "analyze trade-offs between different approaches. design the solution before coding. 아래 Task Spec에 따라 구현하라.",
  ...
}
```
