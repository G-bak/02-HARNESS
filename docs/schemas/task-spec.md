# Task Spec — 스키마 정의

**버전:** 1.4 | **최종 수정:** 2026-04-26  
**작성자:** Analyst | **소비자:** Generator, Validator (일부 필드는 Researcher)

---

## 전체 스키마

```json
{
  "task_id": "TASK-{YYYYMMDD}-{순번}",
  "created_at": "ISO8601",
  "complexity_tier": "Tier1 | Tier2 | Tier3",
  "tier_rationale": "Tier 분류 근거 (예: 인증 로직 포함 → Tier 3)",
  "status": "ACTIVE | HOLD | PENDING_VALIDATION | RETRYING | COMPLETE | PARTIAL | FAILED",
  "depends_on": ["선행 Task의 task_id 목록. 없으면 빈 배열 []"],
  "request_summary": "사용자 요청 한 줄 요약",
  "goal": "달성해야 할 최종 목표",
  "constraints": {
    "positive": ["반드시 충족해야 할 조건 목록"],
    "negative": ["절대 사용 금지 라이브러리/기술/방식 — 압축 시 절대 유실 금지"]
  },
  "success_criteria": [
    "검증 가능한 완료 기준 1",
    "검증 가능한 완료 기준 2"
  ],
  "assigned_agents": ["Researcher", "Generator", "Validator-A"],
  "context": {
    "relevant_history": "이전 관련 작업 요약 (L2 압축본)",
    "reference_docs": ["규칙 문서 경로 목록"],
    "artifact_refs": [
      {
        "source_task_id": "선행 Task ID",
        "artifact_type": "schema | api_spec | config | module",
        "path": "결과물 파일 경로",
        "description": "이 결과물이 현재 Task에 미치는 영향"
      }
    ]
  }
}
```

## 저장 위치

Task Spec 원본은 아래 둘 중 하나에 반드시 저장한다.

권장 SSOT:

```text
tasks/specs/TASK-{YYYYMMDD}-{NNN}.json
```

대체 SSOT:

```text
logs/tasks/TASK-{YYYYMMDD}-{NNN}.jsonl 의 TASK_CREATED 이벤트 details.spec
```

경로 참조 방식:

```text
logs/tasks/TASK-{ID}.jsonl 의 TASK_CREATED.details.spec_path = "tasks/specs/TASK-{ID}.json"
```

규칙:

- Validator에게 전달되는 success_criteria는 이 저장본과 의미가 같아야 한다.
- 재분류, 성공 기준 변경, constraints 변경이 있으면 새 이벤트에 변경 전/후를 기록한다.
- 단순 요약만 원장에 남기고 Task Spec 원본을 보존하지 않는 것은 금지한다.
- 초소형 Tier 1이라도 `TASK_CREATED.details.spec`에 목표와 성공 기준을 보존한다.
- `tasks/specs/` 디렉터리가 없으면 Analyst가 생성한다.
- 신규 strict Task는 `tasks/specs/TASK-{ID}.json`, `TASK_CREATED.details.spec`, `TASK_CREATED.details.spec_path` 중 하나가 없으면 `validate-ledger`에서 실패한다.
- 과거 legacy Task에 원본 Spec이 없으면 기존 이벤트를 수정하지 않고 `CORRECTION.details.legacy_spec_omission_reason`을 append 한다.

---

## 필드별 설명

| 필드 | 필수 | 설명 |
|---|---|---|
| `task_id` | ✅ | `TASK-{YYYYMMDD}-{001부터 순번}` 형식 |
| `complexity_tier` | ✅ | Tier 분류 기준: [tier-classification.md](../workflows/tier-classification.md) 참조 |
| `tier_rationale` | ✅ | 재분류 발생 시 갱신. 분류 근거를 구체적으로 기술 |
| `status` | ✅ | task_status 값. ACTIVE / HOLD / PENDING_VALIDATION / RETRYING / COMPLETE / PARTIAL / FAILED |
| `depends_on` | ✅ | 선행 Task 없으면 `[]`. 선행 Task FAILED 시 이 Task는 HOLD |
| `constraints.negative` | ✅ | 압축 금지 필드. 원문 그대로 보존 |
| `success_criteria` | ✅ | Validator가 항목별 PASS/FAIL을 판정하는 기준. 측정 가능하게 작성 |
| `assigned_agents` | ✅ | 투입될 에이전트 목록 |
| `context.relevant_history` | 선택 | 선행 Task가 있을 때만 작성 |
| `context.artifact_refs` | 선택 | 선행 Task 산출물(Schema, API Spec 등)이 현재 Task에 직접 영향을 줄 때 등록. Analyst가 depends_on 처리 시 자동 검토하여 채운다 |

---

## success_criteria 작성 원칙

**나쁜 예 (측정 불가):**
```
"사용자 경험이 좋아야 한다"
"코드가 깔끔해야 한다"
```

**좋은 예 (측정 가능):**
```
"POST /api/login 요청에 올바른 자격증명 입력 시 200 + JWT 토큰 반환"
"잘못된 비밀번호 입력 시 401 + 에러 메시지 반환"
"JWT 토큰은 HttpOnly 쿠키로 설정되어야 함"
"기존 /api/user 엔드포인트의 응답 형식이 변경되지 않아야 함"
```

---

## 실전 예시 — Tier 2

```json
{
  "task_id": "TASK-20260424-001",
  "created_at": "2026-04-24T10:00:00Z",
  "complexity_tier": "Tier2",
  "tier_rationale": "복수 파일 변경 (profile.js, profile.css, api/user.js), 다른 기능 영향 없음",
  "status": "ACTIVE",
  "depends_on": [],
  "request_summary": "사용자 프로필 페이지 신규 개발 (이름, 이메일, 프로필 사진)",
  "goal": "인증된 사용자가 자신의 프로필 정보를 조회할 수 있는 페이지 제공",
  "constraints": {
    "positive": ["React 컴포넌트로 구현", "기존 API 응답 형식 재사용"],
    "negative": ["직접 DOM 조작 금지", "lodash 사용 금지"]
  },
  "success_criteria": [
    "GET /profile 접근 시 사용자 이름, 이메일, 프로필 사진이 렌더링됨",
    "미인증 사용자가 접근 시 /login으로 리다이렉트됨",
    "프로필 사진 없는 사용자에게 기본 아바타 이미지 표시됨",
    "기존 /login, /dashboard 페이지가 정상 동작함 (회귀 없음)"
  ],
  "assigned_agents": ["Generator", "Validator-A"],
  "context": {
    "relevant_history": "",
    "reference_docs": ["SECURITY.md", "ARCHITECTURE.md"]
  }
}
```

---

## 실전 예시 — Tier 3

```json
{
  "task_id": "TASK-20260424-002",
  "created_at": "2026-04-24T11:00:00Z",
  "complexity_tier": "Tier3",
  "tier_rationale": "인증 로직 변경 (세션 토큰 저장 방식) → Tier 3 해당 조건",
  "status": "ACTIVE",
  "depends_on": ["TASK-20260424-001"],
  "request_summary": "세션 토큰 저장 방식을 localStorage에서 HttpOnly 쿠키로 변경",
  "goal": "XSS 공격으로부터 세션 토큰을 보호하기 위해 HttpOnly 쿠키 방식으로 전환",
  "constraints": {
    "positive": ["기존 사용자의 세션이 자연스럽게 만료 후 전환되어야 함"],
    "negative": ["localStorage 세션 토큰과 쿠키 토큰의 혼재 상태 허용 금지", "세션 강제 만료 없이 전환 금지"]
  },
  "success_criteria": [
    "로그인 성공 시 Set-Cookie 헤더로 HttpOnly 쿠키가 설정됨",
    "localStorage에 토큰이 저장되지 않음",
    "API 요청 시 쿠키가 자동으로 전송됨",
    "로그아웃 시 쿠키가 삭제됨",
    "기존 localStorage 토큰이 있는 사용자는 다음 로그인 시 자동 전환됨"
  ],
  "assigned_agents": ["Researcher", "Generator", "Validator-A", "Validator-B"],
  "context": {
    "relevant_history": "TASK-20260424-001 완료: 프로필 페이지 개발 완료 (커밋: abc123)",
    "reference_docs": ["SECURITY.md", "ARCHITECTURE.md"]
  }
}
```
