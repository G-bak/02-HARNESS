# TASK-EXAMPLE.md — 보고서 예시 파일

**버전:** 1.6 | **최종 수정:** 2026-04-26

> 실제 운영 시 이 구조를 따른다. Tier 1은 인라인 보고만 사용하고, Tier 2/3부터 `reports/TASK-{ID}.md` 상세 보고서를 작성한다.  
> 보고서는 대표·관리자·기술 리드가 함께 보는 문서로 작성한다. 기술 상세보다 먼저 의사결정에 필요한 결론, 영향도, 리스크, 조치 필요 여부를 제시한다.

---

## 공통 작성 원칙

- `task_id`는 `TASK-{YYYYMMDD}-{001부터 순번}` 형식만 사용한다.
- Tier 2/3, HOLD, Resource Failure, FAILED, Adjudication 보고서는 필수다.
- Tier 1 일반 작업은 인라인 보고로 충분하지만, 사용자가 요청하거나 운영 규칙 변경이면 보고서를 작성한다.
- `report_path`는 보고서가 실제로 작성된 뒤 Slack 알림에 포함한다.
- Slack 알림의 내부 enum은 영어(`INFO`, `ACTION_REQUIRED`, `CRITICAL`)를 유지하고, 화면 표시는 한국어(`안내`, `조치 필요`, `긴급`)로 변환한다.
- 별도 조치 필요 boolean은 쓰지 않는다. 조치 필요 여부는 `notification_status: ACTION_REQUIRED`로 표현한다.
- Resource Failure는 Validator FAIL로 취급하지 않는다. Task는 `HOLD` 또는 `PENDING_VALIDATION` 상태로 유지한다.
- Validator FAIL 반복이나 Generator Rebuttal은 세션 종료가 아니라 Adjudication 진입 신호로 기록한다.
- API key, webhook URL, password, token, PII는 보고서와 알림에 기록하지 않는다.
- 보고서 필수 상황에서 보고서가 없으면 Task를 `COMPLETE`로 처리하지 않는다.

## 대표 보고용 작성 원칙

보고서 첫 화면에서 아래 질문에 답해야 한다.

```text
1. 완료됐는가, 보류인가, 실패인가?
2. 사용자/서비스/매출/운영에 어떤 영향이 있는가?
3. 검증은 누구/무엇으로 끝났는가?
4. 남은 리스크와 조치 필요 사항은 무엇인가?
5. 대표 또는 관리자가 지금 결정해야 할 것이 있는가?
```

작성 톤:

- 결론을 먼저 쓴다. 과정 설명은 뒤에 둔다.
- “수정함”, “처리함” 대신 무엇이 어떻게 바뀌었는지 명확히 쓴다.
- 불확실한 내용은 `확인 필요`로 분리한다.
- 기술 용어는 필요할 때만 쓰고, 처음 한 번은 비즈니스 영향으로 풀어쓴다.
- 실패·보류·리스크는 숨기지 않는다. 단, 원인·영향·다음 조치를 함께 적는다.
- 과도한 로그 전문, 코드 전문, 내부 추론 과정은 넣지 않는다.

### 품질 점수 작성 원칙

대표 보고서의 품질 점수는 JSON 원문을 먼저 보여주지 않는다.  
첫 화면에는 사람이 바로 이해할 수 있는 점수, 등급, 의미, 감점 사유를 쓴다.

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

## 표준 보고서 구조

Tier 2/3 보고서는 아래 순서를 기본으로 한다.

```markdown
# TASK-{ID} 보고서 — {작업명}

## 0. Executive Summary
- 상태:
- 결론:
- 서비스 영향:
- 검증:
- 남은 리스크:
- 조치 필요:

## 1. 요청 및 목표
## 2. 결과 및 변경 사항
## 3. 검증 및 승인
## 4. 영향도 및 리스크
## 5. 진행 경과
## 6. 이슈 / 예외 / 보류 사항
## 7. 비용 / 리소스 / 알림
## 8. 품질 점수
## 9. 다음 권장 사항
```

`Executive Summary`는 10줄 이내를 원칙으로 한다. 바쁜 의사결정자는 이 섹션만 읽어도 상태를 판단할 수 있어야 한다.

---

# Tier 1 예시 — 인라인 보고

Tier 1은 단일 파일 이하, 즉시 되돌릴 수 있는 작업이다.  
파일 보고서는 만들지 않고 채팅 인라인 보고만으로 완료 처리한다.

**인라인 보고 예시:**

```text
TASK-20260426-001 완료 [Tier 1]

목표: 메인 페이지 헤더 문구 오타 수정 ("Welcme" -> "Welcome")
결과물: src/pages/Home.jsx
주의: 없음
회고 제안: [CAUTION] 배포 전 정적 텍스트 spell-check 자동화 검토
```

**Slack COMPLETE 알림 예시:**

```powershell
node scripts/notify-slack.mjs --task-id TASK-20260426-001 --notification-status COMPLETE --severity INFO --title "헤더 문구 수정 완료" --summary "Home.jsx 오타 수정 완료"
```

---

# TASK-20260426-002 보고서 — Tier 2 성공 예시

## 0. Executive Summary

- **상태:** COMPLETE
- **결론:** 프로필 닉네임 입력에 20자 제한과 실시간 카운터를 추가했고 검증을 통과했다.
- **서비스 영향:** 프로필 수정 화면의 입력 오류 가능성이 줄어든다. 기존 저장 기능 회귀는 확인되지 않았다.
- **검증:** Validator-A PASS, 관련 테스트 PASS
- **남은 리스크:** 다른 프로필 필드에는 동일 제한이 적용되지 않았다.
- **조치 필요:** 없음

## 1. 요청 요약

- **원문:** "프로필 페이지에 닉네임 글자 수 제한(20자)이 없다. 추가해줘."
- **해석된 목표:** 프로필 수정 폼의 닉네임 필드에 최대 20자 입력 제한 및 카운터 표시 추가
- **Task Spec 핵심:**
  - `task_id`: `TASK-20260426-002`
  - `complexity_tier`: `Tier2`
  - `tier_rationale`: 복수 파일 UI 수정이지만 보안/인증/DB/API breaking change 없음
  - `assigned_agents`: `Generator`, `Validator-A`
- **성공 기준:**
  - 20자 초과 입력 시 입력이 차단됨
  - 현재 입력 글자 수가 실시간으로 표시됨
  - 기존 프로필 저장 기능 정상 동작

---

## 2. 수행 결과

- **완료 여부:** COMPLETE
- **변경 요약:**
  - Before: 닉네임 필드에 글자 수 제한 없음, 카운터 미표시
  - After: `maxLength=20` 적용, 실시간 카운터 컴포넌트 추가
- **결과물:**
  - `src/components/ProfileForm.jsx:43` — `maxLength` 속성 및 카운터 렌더링 추가
  - `src/components/ProfileForm.test.jsx:18` — 20자 제한 회귀 테스트 추가
  - 브랜치: `task/TASK-20260426-002`
  - 머지 방식: Squash Merge
  - GitHub 커밋: `a3f9c12`
  - 상세 보고서: `reports/TASK-20260426-002.md`
- **검증 결과:**
  - Validator-A: PASS (Codex CLI)
  - Tier 2이므로 Analyst 사전 승인 없이 Validator-A가 main 머지 실행
- **확인 방법:**
  - 수동: 닉네임 필드에 21자 입력 시 21번째 글자 차단 확인
  - 자동: `ProfileForm.test.jsx` PASS, 정적 분석 PASS

---

## 3. 수행 과정

- **Tier:** Tier 2
- **투입 에이전트:** Generator, Validator-A
- **타임라인:**
  - `09:12` Analyst — Task Spec 확정, Tier 2 분류
  - `09:13` Generator — `task/TASK-20260426-002` 브랜치 생성
  - `09:15` Generator — 구현 후 Self-Refinement 1회 수행, 누락 테스트 추가
  - `09:17` Generator -> Validator-A 검증 요청
  - `09:20` Validator-A — success_criteria 전 항목 PASS 판정
  - `09:21` Validator-A — main Squash Merge 실행
  - `09:22` Analyst — 보고서 작성 및 Slack COMPLETE 알림 발송
- **오류 및 해결:** N/A
- **재시도 횟수:** 0회

---

## 4. 검증 요약

| 기준 | 결과 | 근거 |
|---|---|---|
| 20자 초과 입력 차단 | PASS | 테스트 및 수동 확인 |
| 실시간 글자 수 표시 | PASS | UI 확인 |
| 기존 저장 기능 회귀 없음 | PASS | 기존 테스트 PASS |

**Validator 오류 목록:** 없음  
**Resource Failure:** 없음  
**Adjudication:** 없음

---

## 5. Slack 알림 기록

```json
{
  "type": "NOTIFICATION_EVENT",
  "task_id": "TASK-20260426-002",
  "provider": "slack",
  "severity": "INFO",
  "notification_status": "COMPLETE",
  "title": "닉네임 글자 수 제한 완료",
  "summary": "ProfileForm에 20자 제한과 카운터를 추가했습니다.",
  "report_path": "reports/TASK-20260426-002.md",
  "dedupe_key": "TASK-20260426-002:COMPLETE"
}
```

---

## 6. 협업 회고

- **효과적 패턴:** 단순 UI 제한은 success_criteria를 입력 차단, 표시, 회귀 확인으로 나누면 Validator 검증이 명확해진다.
- **비효율 패턴:** N/A
- **예상 못한 상황:** N/A
- **가이드 업데이트 제안:** N/A

---

## 7. 품질 점수

**종합 점수: 97점 / 100점 (S등급)**

| 구분 | 점수 | 의미 |
|---|---:|---|
| 결과물 품질 | 58 / 60 | 닉네임 제한, 카운터, 기존 저장 기능 회귀 확인까지 충족했다. |
| 진행 품질 | 39 / 40 | 재시도 없이 통과했고 보고서와 알림 기록이 남았다. |
| 총점 | 97 / 100 | 바로 운영 반영 가능한 수준이다. |

**좋았던 점:** 성공 기준이 명확했고 Validator-A 검증을 한 번에 통과했다.  
**감점/주의:** 같은 제한이 필요한 다른 필드는 별도 Task로 확인이 필요하다.

---

## 8. 다음 권장 사항

- `bio`, `username` 필드에도 동일한 글자 수 제한이 필요한지 별도 Task로 검토

---

# TASK-20260426-003 보고서 — Tier 3 성공 예시

## 0. Executive Summary

- **상태:** COMPLETE
- **결론:** 세션 토큰 저장 방식을 HttpOnly 쿠키로 전환해 XSS로 인한 토큰 탈취 위험을 낮췄다.
- **서비스 영향:** 로그인/로그아웃 흐름은 유지되며, 기존 사용자는 다음 로그인 시 자연스럽게 전환된다.
- **검증:** Validator-A 기능 검증 PASS, Validator-B 보안 검증 PASS, Analyst 최종 승인 완료
- **남은 리스크:** 배포 후 실제 브라우저/디바이스 조합의 쿠키 정책 차이는 모니터링 필요
- **조치 필요:** 운영 배포 후 인증 오류율 모니터링 권장

## 1. 요청 요약

- **원문:** "세션 토큰을 localStorage 대신 HttpOnly 쿠키로 바꿔줘."
- **해석된 목표:** XSS 공격면을 줄이기 위해 세션 토큰 저장 방식을 HttpOnly 쿠키로 전환
- **Task Spec 핵심:**
  - `task_id`: `TASK-20260426-003`
  - `complexity_tier`: `Tier3`
  - `tier_rationale`: 인증 로직 및 세션 토큰 저장 방식 변경
  - `assigned_agents`: `Researcher`, `Generator`, `Validator-A`, `Validator-B`
- **성공 기준:**
  - 로그인 성공 시 `Set-Cookie`로 HttpOnly 쿠키 설정
  - localStorage에 세션 토큰 저장 금지
  - API 요청 시 쿠키 기반 인증 정상 동작
  - 로그아웃 시 쿠키 삭제
  - 기존 세션 사용자는 다음 로그인 시 자연스럽게 전환

---

## 2. 수행 결과

- **완료 여부:** COMPLETE
- **변경 요약:**
  - Before: 세션 토큰이 localStorage에 저장되어 XSS 발생 시 탈취 가능
  - After: HttpOnly 쿠키 기반 세션 처리로 전환, localStorage 토큰 저장 제거
- **결과물:**
  - `src/auth/session.js:12` — 쿠키 기반 세션 처리 추가
  - `api/auth/login.js:34` — `Set-Cookie` 헤더 설정
  - `api/auth/logout.js:18` — 세션 쿠키 삭제 처리
  - `tests/auth/session-cookie.test.js:1` — 세션 전환 회귀 테스트 추가
  - 브랜치: `task/TASK-20260426-003`
  - 머지 방식: Squash Merge
  - GitHub 커밋: `b7e2d45`
  - 상세 보고서: `reports/TASK-20260426-003.md`
- **검증 결과:**
  - Validator-A: PASS (Codex CLI)
  - Validator-B: PASS (Gemini CLI)
  - Analyst 최종 승인: 승인 완료
- **확인 방법:**
  - 수동: 로그인/로그아웃 플로우 확인, 브라우저 storage에 토큰 미저장 확인
  - 자동: 인증 테스트 PASS, 보안 체크리스트 PASS

---

## 3. 수행 과정

- **Tier:** Tier 3
- **투입 에이전트:** Researcher, Generator, Validator-A, Validator-B, Analyst
- **타임라인:**
  - `10:05` Analyst — Task Spec 확정, Tier 3 분류
  - `10:06` Researcher — HttpOnly 쿠키 전환 시 주의점 요약
  - `10:09` Analyst — Research Summary를 선별해 Generator 지시서에 포함
  - `10:12` Generator — `task/TASK-20260426-003` 브랜치 생성 및 구현
  - `10:20` Generator — Self-Refinement 1회, 로그아웃 쿠키 삭제 누락 수정
  - `10:25` Analyst — Validator-A/B에 동일 결과물 독립 전달
  - `10:31` Validator-A — 기능 정확성 PASS
  - `10:34` Validator-B — 보안 관점 PASS
  - `10:35` Analyst — Tier 3 승인 필요 Slack 알림 발송
  - `10:36` Analyst — 최종 승인
  - `10:37` Validator-A — main Squash Merge 실행
  - `10:38` Analyst — 최종 보고 및 COMPLETE Slack 알림 발송
- **오류 및 해결:** Self-Refinement 단계에서 로그아웃 쿠키 삭제 누락을 1회 자체 수정
- **재시도 횟수:** 0회

---

## 4. 검증 요약

| 검증자 | 결과 | 중점 |
|---|---|---|
| Validator-A | PASS | 로그인/로그아웃 기능, 테스트, 회귀 |
| Validator-B | PASS | XSS 토큰 탈취 위험, 쿠키 속성, 세션 호환성 |

**Validator FAIL:** 없음  
**Resource Failure:** 없음  
**Adjudication:** 없음

**Tier 3 머지 조건 확인:**

```text
[x] Validator-A PASS
[x] Validator-B PASS
[x] Analyst 최종 승인
[x] 머지 커밋에 Validator 결과 포함
```

---

## 5. Slack 알림 기록

**승인 필요 알림:**

```json
{
  "type": "NOTIFICATION_EVENT",
  "task_id": "TASK-20260426-003",
  "provider": "slack",
  "severity": "ACTION_REQUIRED",
  "notification_status": "ACTION_REQUIRED",
  "title": "Tier 3 승인 필요",
  "summary": "Validator-A/B 모두 PASS. Analyst 최종 승인 후 머지 가능.",
  "report_path": "reports/TASK-20260426-003.md",
  "dedupe_key": "TASK-20260426-003:TIER3_APPROVAL"
}
```

**완료 알림:**

```json
{
  "type": "NOTIFICATION_EVENT",
  "task_id": "TASK-20260426-003",
  "provider": "slack",
  "severity": "INFO",
  "notification_status": "COMPLETE",
  "title": "세션 토큰 저장 방식 변경 완료",
  "summary": "HttpOnly 쿠키 기반 세션 처리로 전환하고 Tier 3 검증을 통과했습니다.",
  "report_path": "reports/TASK-20260426-003.md",
  "dedupe_key": "TASK-20260426-003:COMPLETE"
}
```

---

## 6. 협업 회고

- **효과적 패턴:** Tier 3에서는 Validator-A/B를 독립 병렬로 실행해 기능 정확성과 보안 관점을 분리하면 판단 품질이 좋아진다.
- **비효율 패턴:** Research Summary 전체를 전달하면 Generator 컨텍스트가 불필요하게 커질 수 있다.
- **예상 못한 상황:** 기존 localStorage 토큰 사용자의 전환 시점이 success_criteria에 없으면 누락될 수 있다.
- **가이드 업데이트 제안:** `[CAUTION]` 인증 저장 방식 변경은 기존 세션 사용자 전환 기준을 success_criteria에 반드시 포함한다.

---

## 7. 품질 점수

**종합 점수: 94점 / 100점 (S등급)**

| 구분 | 점수 | 의미 |
|---|---:|---|
| 결과물 품질 | 57 / 60 | 인증 저장 방식 전환 기준과 보안 검증을 충족했다. |
| 진행 품질 | 37 / 40 | Tier 3 검증과 승인 절차를 지켰다. |
| 총점 | 94 / 100 | 운영 적용 가능하나 배포 후 모니터링이 필요하다. |

**좋았던 점:** 기능 검증과 보안 검증을 분리해 모두 PASS를 받았다.  
**감점/주의:** Research Summary를 더 압축하면 컨텍스트 관리 품질을 높일 수 있다.

---

## 8. 다음 권장 사항

- Tier 3 머지 후 release tag 생성 검토: `git tag v1.0.0-TASK-20260426-003`
- 세션 관련 E2E 테스트를 mini regression set에 추가

---

# TASK-20260426-004 보고서 — Resource Failure / HOLD 예시

## 0. Executive Summary

- **상태:** HOLD / PENDING_VALIDATION
- **결론:** 구현은 완료됐지만 Validator-A rate limit으로 검증이 끝나지 않았다.
- **서비스 영향:** main 머지는 보류되어 운영 반영은 발생하지 않았다.
- **검증:** 필수 Validator PASS 미확보
- **남은 리스크:** 검증 전이므로 기능 정확성 및 회귀 여부는 확정할 수 없다.
- **조치 필요:** rate limit 해제 후 Validator-A 재실행 필요

## 1. 요청 요약

- **원문:** "결제 모듈 검증까지 완료해줘."
- **해석된 목표:** 결제 모듈 변경 후 Validator-A 검증까지 완료
- **Task Spec 핵심:**
  - `task_id`: `TASK-20260426-004`
  - `complexity_tier`: `Tier2`
  - `assigned_agents`: `Generator`, `Validator-A`
- **성공 기준:**
  - 결제 생성 API 정상 동작
  - 실패 응답이 표준 에러 포맷을 따름
  - 기존 결제 내역 조회 기능 회귀 없음

---

## 2. 현재 상태

- **완료 여부:** HOLD
- **상태 요약:** Generator 구현은 완료됐으나 Validator-A가 rate limit으로 실행되지 못함
- **중요 판단:** Resource Failure는 Validator FAIL이 아니므로 코드 품질 실패로 기록하지 않음
- **머지 여부:** Validator-A PASS 전까지 main 머지 금지
- **재개 조건:** rate limit 해제 후 Validator-A 재실행

---

## 3. Resource Failure Report

```json
{
  "task_id": "TASK-20260426-004",
  "agent": "Validator-A",
  "type": "RESOURCE_FAILURE_REPORT",
  "resource_error_type": "RATE_LIMIT",
  "tool": "Codex CLI",
  "stage": "VALIDATION",
  "impact": "BLOCKS_VALIDATION",
  "task_status_after": "PENDING_VALIDATION",
  "retryable": true,
  "retry_after": "10m",
  "attempt_count": 1,
  "max_attempts": 2,
  "mitigation": "backoff 재시도",
  "detail": "Codex CLI 요청 제한으로 Validator-A 검증을 시작하지 못함"
}
```

---

## 4. 수행 과정

- **Tier:** Tier 2
- **투입 에이전트:** Generator, Validator-A
- **타임라인:**
  - `14:02` Analyst — Task Spec 확정, Tier 2 분류
  - `14:03` Generator — `task/TASK-20260426-004` 브랜치 생성 및 구현
  - `14:11` Generator -> Validator-A 검증 요청
  - `14:12` Validator-A — RATE_LIMIT 발생, Resource Failure Report 발행
  - `14:12` Analyst — Task 상태를 `PENDING_VALIDATION`으로 유지
  - `14:13` Analyst — Slack ACTION_REQUIRED 알림 발송
- **오류 및 해결:** 코드 오류 없음. 도구 리소스 제한으로 검증 보류
- **재시도 횟수:** Validator FAIL 재시도 0회. Resource Failure 재시도 1회 예정

---

## 5. Slack 알림 기록

```json
{
  "type": "NOTIFICATION_EVENT",
  "task_id": "TASK-20260426-004",
  "provider": "slack",
  "severity": "ACTION_REQUIRED",
  "notification_status": "HOLD",
  "title": "Resource Failure 발생",
  "summary": "Validator-A rate limit으로 검증이 보류되었습니다. main 머지는 금지됩니다.",
  "report_path": "reports/TASK-20260426-004.md",
  "dedupe_key": "TASK-20260426-004:RESOURCE_FAILURE"
}
```

---

## 6. 다음 조치

1. 10분 backoff 후 Validator-A 재실행
2. 2회 재시도 실패 시 사용자에게 리소스 제한 지속 보고
3. Validator-A PASS 확보 전까지 main 머지 금지

---

# TASK-20260426-005 보고서 — Rebuttal / Adjudication 예시

## 0. Executive Summary

- **상태:** COMPLETE
- **결론:** 검색 결과 기본 정렬을 최신순으로 변경했고, Validator 재현 절차 오류는 Adjudication으로 정정했다.
- **서비스 영향:** 사용자는 최신 생성 항목을 먼저 보게 된다. 명시적 정렬 옵션은 기존대로 유지된다.
- **검증:** Adjudication 후 Validator-A 재검증 PASS
- **남은 리스크:** 검색/필터 계열의 테스트 입력 기록을 더 명확히 남길 필요가 있다.
- **조치 필요:** 향후 유사 Task의 success_criteria에 기본값/명시값 케이스를 분리 기재

## 1. 요청 요약

- **원문:** "사용자 검색 결과 정렬 기준을 최신순으로 바꿔줘."
- **해석된 목표:** 검색 결과 기본 정렬을 생성일 내림차순으로 변경
- **Task Spec 핵심:**
  - `task_id`: `TASK-20260426-005`
  - `complexity_tier`: `Tier2`
  - `assigned_agents`: `Generator`, `Validator-A`
- **성공 기준:**
  - 검색 결과 기본 정렬이 `created_at DESC`임
  - 사용자가 명시적으로 정렬 옵션을 선택하면 해당 옵션을 우선함
  - 기존 필터 조건은 변경되지 않음

---

## 2. 수행 결과

- **완료 여부:** COMPLETE
- **변경 요약:**
  - Before: 기본 정렬이 이름순
  - After: 기본 정렬이 최신순, 명시적 정렬 옵션은 우선 유지
- **결과물:**
  - `src/search/buildQuery.js:22` — 기본 정렬 기준 변경
  - `tests/search/sort.test.js:1` — 기본 정렬 및 명시 정렬 회귀 테스트 추가
  - 브랜치: `task/TASK-20260426-005`
  - GitHub 커밋: `c41a0fe`
  - 상세 보고서: `reports/TASK-20260426-005.md`
- **검증 결과:**
  - Validator-A: 초기 FAIL 후 Adjudication에서 명세 해석 정정
  - 재검증: PASS

---

## 3. 판정 충돌 요약

Validator-A는 "명시적 정렬 옵션 선택 시에도 최신순이 적용된다"고 FAIL을 냈다.  
Generator는 해당 FAIL이 재현 절차 오류라고 판단해 Rebuttal을 제출했다.

**Generator Rebuttal:**

```json
{
  "task_id": "TASK-20260426-005",
  "agent": "Generator",
  "type": "REBUTTAL",
  "target_error": "명시적 정렬 옵션이 무시된다는 Validator FAIL",
  "claim": "Validator가 기본 정렬 케이스와 명시 정렬 케이스를 같은 요청으로 테스트함",
  "evidence": [
    {
      "kind": "test_log",
      "detail": "sort=name 요청에서는 ORDER BY name ASC가 적용됨"
    },
    {
      "kind": "spec_quote",
      "detail": "success_criteria: 사용자가 명시적으로 정렬 옵션을 선택하면 해당 옵션을 우선함"
    }
  ],
  "requested_action": "재현 절차 재실행"
}
```

**Analyst Adjudication Report:**

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

## 4. 수행 과정

- **Tier:** Tier 2
- **투입 에이전트:** Generator, Validator-A, Analyst
- **타임라인:**
  - `15:00` Analyst — Task Spec 확정
  - `15:02` Generator — 구현 및 테스트 추가
  - `15:07` Validator-A — FAIL (`SPEC_INTERPRETATION`)
  - `15:08` Generator — Rebuttal 제출
  - `15:10` Analyst — Adjudication 수행, Generator 반박 채택
  - `15:12` Validator-A — 재현 절차 정정 후 PASS
  - `15:13` Validator-A — main Squash Merge 실행
  - `15:14` Analyst — 보고서 작성 및 COMPLETE Slack 알림 발송
- **오류 및 해결:** Validator 재현 절차 오류를 Adjudication으로 정정
- **재시도 횟수:** Validator FAIL 재시도 1회, 코드 수정 없음

---

## 5. Slack 알림 기록

**Adjudication 진입 알림:**

```json
{
  "type": "NOTIFICATION_EVENT",
  "task_id": "TASK-20260426-005",
  "provider": "slack",
  "severity": "ACTION_REQUIRED",
  "notification_status": "ACTION_REQUIRED",
  "title": "Validator 판정 충돌",
  "summary": "Generator Rebuttal 제출로 Analyst Adjudication에 진입했습니다.",
  "report_path": "reports/TASK-20260426-005.md",
  "dedupe_key": "TASK-20260426-005:ADJUDICATION"
}
```

**완료 알림:**

```json
{
  "type": "NOTIFICATION_EVENT",
  "task_id": "TASK-20260426-005",
  "provider": "slack",
  "severity": "INFO",
  "notification_status": "COMPLETE",
  "title": "검색 정렬 기준 변경 완료",
  "summary": "Adjudication 후 재검증 PASS 및 머지 완료.",
  "report_path": "reports/TASK-20260426-005.md",
  "dedupe_key": "TASK-20260426-005:COMPLETE"
}
```

---

## 6. 협업 회고

- **효과적 패턴:** Validator FAIL 근거가 `SPEC_INTERPRETATION`이면 즉시 코드 수정하기보다 Rebuttal과 Adjudication으로 재현 절차를 확인하는 편이 낫다.
- **비효율 패턴:** 테스트 요청 파라미터가 보고서에 빠지면 판정 충돌 원인 추적이 늦어진다.
- **예상 못한 상황:** 코드 수정 없이 Validator 재현 절차 정정만으로 PASS 가능했다.
- **가이드 업데이트 제안:** `[NEW_PATTERN]` 정렬·필터처럼 요청 파라미터가 중요한 Task는 Validator 보고서에 실제 요청 URL 또는 테스트 입력을 반드시 기록한다.

---

## 7. 다음 권장 사항

- 검색/필터 계열 Task Spec에는 기본값 케이스와 사용자 명시값 케이스를 성공 기준으로 분리해 작성

---

# 보고서 작성 체크리스트

```text
[ ] Executive Summary가 10줄 이내이며 상태, 결론, 영향, 검증, 리스크, 조치 필요 여부를 포함하는가
[ ] 대표/관리자가 첫 화면만 읽어도 의사결정 가능한가
[ ] task_id가 TASK-YYYYMMDD-NNN 형식인가
[ ] Tier 분류 근거가 실제 변경 범위 기준으로 적혀 있는가
[ ] success_criteria가 검증 가능한 문장인가
[ ] 결과물 경로, 브랜치, 커밋, 머지 방식이 명확한가
[ ] Validator 결과와 evidence_type이 필요한 곳에 기록됐는가
[ ] 서비스 영향, 운영 영향, 사용자 영향이 구분되어 있는가
[ ] 남은 리스크와 조치 필요 사항을 숨기지 않았는가
[ ] Resource Failure를 Validator FAIL로 잘못 기록하지 않았는가
[ ] Rebuttal/Adjudication이 발생했다면 판정 근거와 next_action이 있는가
[ ] Slack 알림 기록에 notification_status, severity, report_path가 있는가
[ ] 품질 점수가 JSON 원문보다 쉬운 요약/표/감점 사유 중심으로 작성됐는가
[ ] 별도 조치 필요 boolean을 쓰지 않았는가
[ ] 민감 정보 원문이 없는가
[ ] 회고에 가이드 업데이트 제안이 필요한지 검토했는가
```
