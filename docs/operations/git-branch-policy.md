# Git Branch Policy — 브랜치 격리 정책

**버전:** 1.6 | **최종 수정:** 2026-04-26  
**원칙:** 모든 생성 작업은 전용 브랜치에서 수행한다. Generator는 main에 직접 접근하지 않는다.  
**권위 문서:** 머지 조건·승인 주체에 관한 규칙은 이 문서가 단일 기준(Single Source of Truth)이다. SECURITY.md와 각 에이전트 문서는 이 문서를 참조하며 독자적인 규칙을 정의하지 않는다.

---

## 브랜치 명명 규칙

```
task/{TASK-ID}

예시:
  task/TASK-20260424-001
  task/TASK-20260424-002
```

---

## Non-git 작업공간 운영 모드

`git rev-parse --is-inside-work-tree`가 실패하면 현재 작업공간은 git 저장소가 아니다. 이 경우 `task/{TASK-ID}` 브랜치, 커밋, main 머지 규칙을 실행할 수 없으므로 **Non-git 작업공간 운영 모드**로 전환한다.

적용 조건:

```text
[ ] 현재 디렉터리가 git repository가 아님
[ ] 사용자가 로컬 파일 반영을 요청했거나, 하네스 문서/로그 정비처럼 로컬 완료가 목적임
[ ] 원장에 branch_omission_reason을 기록함
```

처리 규칙:

1. `TASK_CREATED.details.branch_required`를 `false`로 기록한다.
2. `branch_omission_reason`에 git 저장소가 아님을 명시한다.
3. `MERGE_COMPLETED` 이벤트는 기록하지 않는다.
4. 최종 보고서에는 브랜치/커밋 검증을 수행하지 못한 제한 사항을 적는다.
5. Tier 2/3 작업이라도 main 머지 상태를 완료 근거로 쓰지 않는다. 로컬 파일 검증, 스크립트 검증, 보고서/품질 점수 게이트로 완료 여부를 판단한다.

금지:

```text
[ ] git 저장소가 아닌데 브랜치 생성 또는 머지 완료로 보고
[ ] 커밋 해시를 임의로 작성
[ ] 브랜치 생략 사유 없이 로컬 파일 변경
```

권장 전환:

장기 운영 전에는 저장소 루트에서 git을 초기화하고 baseline commit 또는 baseline tag를 만든 뒤 일반 브랜치 정책으로 전환한다.

---

## 에이전트별 브랜치 권한

| 에이전트 | main 읽기 | main 쓰기 | task/* 읽기 | task/* 쓰기 | 머지 권한 |
|---|:---:|:---:|:---:|:---:|:---:|
| Analyst | ✅ | ❌ | ✅ | ❌ | ❌ |
| Researcher | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generator | ✅ (기준 확인용) | ❌ | ✅ | ✅ | ❌ |
| Validator-A | ✅ | ❌ | ✅ | ❌ | ✅ |
| Validator-B | ✅ | ❌ | ✅ | ❌ | ❌ |

**Validator-A만 main 머지 권한을 보유한다.** Tier 3에서는 Analyst 최종 승인 후 Validator-A가 머지를 실행한다.

---

## Task 브랜치 수명 주기

```
1. [Generator] task/{TASK-ID} 브랜치 생성
   git checkout -b task/{TASK-ID}

2. [Generator] 코드 작업 수행
   → 커밋 메시지 형식: "[{TASK-ID}] {변경 내용 요약}"
   예: "[TASK-20260424-001] Add user profile page component"

3. [Generator] Validator에게 검증 요청
   - Tier 2: Validator-A에 직접 전달
   - Tier 3: Analyst에게 완료 보고 → Analyst가 Validator-A/B에 독립 팬아웃

4. [Validator-A] Sandbox에서 검증 수행
   → FAIL: 오류 목록 반환, Generator 수정 후 재커밋
   → PASS: main으로 머지 진행

5. [Tier 2] Validator-A PASS → main 머지 실행
   [Tier 3] Validator-A + Validator-B 둘 다 PASS + Analyst 승인 → Validator-A가 머지 실행

6. 머지 완료 후 task/{TASK-ID} 브랜치 삭제
```

---

## 커밋 메시지 규칙

```
형식: [{TASK-ID}] {변경 내용 요약}

예시:
  [TASK-20260424-001] Add user profile page component
  [TASK-20260424-001] Fix missing auth redirect on profile page
  [TASK-20260424-002] Change session token storage to HttpOnly cookie

커밋 본문 (머지 커밋 또는 머지 직전 최종 커밋에 필수):
  Validator: Validator-A PASS (Codex CLI)
  Tier: Tier2

  주의: Generator의 중간 작업 커밋(검증 전)에는 검증 결과를 포함할 수 없다.
  검증 결과는 Validator PASS 확인 후 머지 커밋 또는 별도 확인 커밋에 기재한다.
```

---

## 머지 방식

**기본: Squash Merge**  
task/* 브랜치의 WIP 커밋을 하나로 압축하여 main에 반영한다. Task 단위 이력 관리가 쉽고 main 로그가 깔끔하게 유지된다.

### Windows PowerShell Git 명령 주의

Windows PowerShell에서는 shell 연산자 호환성이 환경마다 다를 수 있다. Git 작업은 실패 지점을 명확히 하기 위해 한 명령씩 실행한다.

권장:

```powershell
git add CURRENT_STATE.md docs logs reports scripts
git commit -m "[TASK-20260426-001] Update harness guides"
git switch main
git merge --squash task/TASK-20260426-001
git commit -m "[TASK-20260426-001] Update harness guides`n`nValidator: Validator-A PASS (Codex CLI)`nTier: Tier2"
```

금지:

```powershell
git add . && git commit -m "..."
```

이유:

- `&&`가 PowerShell 버전에 따라 실패할 수 있다.
- 실패한 첫 명령 이후의 작업이 실행됐는지 헷갈리기 쉽다.
- 원장과 세션 로그에 어느 단계까지 완료됐는지 기록하기 어렵다.

### Squash Merge 운영 순서

Squash merge 시 아래 순서를 따른다.

1. `task/{TASK-ID}` 브랜치에서 모든 변경을 커밋한다.
2. `main`으로 전환한다.
3. `git merge --squash task/{TASK-ID}`를 실행한다.
4. squash 결과가 staged 상태가 되면 `MERGE_COMPLETED`, `TASK_COMPLETED`, `CURRENT_STATE.md`, 최신 세션 로그의 `## 다음 단계`를 최종 상태로 갱신한다.
5. 갱신한 기록 파일을 다시 `git add` 한다.
6. Validator 결과와 Tier가 포함된 squash commit을 생성한다.
7. 최종 감사 스크립트 3종을 실행한다.
8. `git status --short --branch`로 `main` 상태와 `origin/main` ahead 여부를 확인해 사용자에게 보고한다.

커밋 해시 기록 주의:

- merge 커밋 안에 자기 자신의 최종 해시를 고정 문자열로 넣으려고 amend를 반복하지 않는다.
- 같은 squash commit 안의 원장에는 `SELF_REFERENTIAL_MAIN_SQUASH_COMMIT`처럼 self-reference 표기를 사용할 수 있다.
- 실제 최종 HEAD 해시는 커밋 후 사용자 보고와 필요 시 후속 `CORRECTION` 이벤트에 기록한다.

### Push / Origin 인수인계

main squash merge 후 push까지 요청받지 않았다면 push하지 않는다. 대신 최종 보고와 `CURRENT_STATE.md`에 아래를 명확히 남긴다.

```text
로컬 main은 origin/main보다 N커밋 앞서 있음
```

다음 세션의 첫 에이전트는 재진입 체크 중 `git status --short --branch`를 실행해 이 상태를 보고해야 한다.

사용자가 push까지 요청했거나 Task Spec의 success_criteria에 push가 포함되어 있으면 아래 순서까지 완료해야 한다.

```powershell
git status --short --branch
git push origin main
git status --short --branch
```

push 완료 후 필수 기록:

```text
[ ] `MERGE_COMPLETED.details.push_status`를 `PUSHED`로 기록
[ ] push 대상 remote/branch 기록 (`origin/main`)
[ ] push 전후 `git status --short --branch` 결과를 원장 또는 보고서에 요약
[ ] `CURRENT_STATE.md`의 origin ahead 인수인계를 제거하거나 "동기화 완료"로 갱신
```

금지:

```text
[ ] push하지 않았는데 원격 반영 완료로 보고
[ ] push 실패를 Task COMPLETE로 숨기기
[ ] push 요청이 없는데 임의로 push
```

### Squash 머지 커밋 메시지 형식

**Tier 2**
```
[{TASK-ID}] {작업 요약}

Validator: Validator-A PASS (Codex CLI)
Tier: Tier2
```

**Tier 3**
```
[{TASK-ID}] {작업 요약}

Validator-A: PASS (Codex CLI)
Validator-B: PASS (Gemini CLI)
Approved-by: Analyst
Tier: Tier3
```

예시:
```
[TASK-20260425-001] Add profile API validation

Validator: Validator-A PASS (Codex CLI)
Tier: Tier2
```

---

## 머지 조건

### Tier 1 처리

Tier 1은 단일 파일 이하, 즉시 되돌릴 수 있는 작업으로 Validator를 투입하지 않는다.

| 상황 | 처리 방법 |
|---|---|
| GitHub 반영 불필요 | Analyst 자체 검토 후 로컬 완료로 처리 — 브랜치 생성 없음 |
| GitHub 반영 필요 | Analyst 검토 완료 후 사용자(사람)가 직접 머지 — 에이전트 머지 없음 |
| Generator 파일 수정 필요 | 원칙적으로 `task/{TASK-ID}` 브랜치 사용. 단, 저장소가 아니거나 사용자가 로컬 반영만 요청한 경우 Non-git 작업공간 운영 모드로 전환하고 원장에 사유를 기록 |

Tier 1 예외는 "브랜치가 없어도 된다"는 뜻이지 "기록 없이 수정해도 된다"는 뜻이 아니다.
브랜치 생략 시에도 `TASK_CREATED`, 변경 요약, 자체 검토, `TASK_COMPLETED`는 반드시 기록한다.

---

### Tier 2 머지 체크리스트
```
[ ] Validator-A PASS 판정 확인
[ ] 커밋 메시지에 task_id 포함 확인
[ ] SECURITY.md 체크리스트 통과 확인
[ ] 민감 정보(.env 등) 포함 여부 확인
```

### Tier 3 머지 체크리스트
```
[ ] Validator-A PASS 판정 확인
[ ] Validator-B PASS 판정 확인
[ ] Analyst 최종 승인 확인
[ ] 두 Validator 결과가 충돌한 경우 중재 보고서 존재 확인
[ ] 커밋 메시지에 task_id + Validator 결과 포함 확인
[ ] SECURITY.md Tier 3 추가 체크리스트 통과 확인
```

---

## 금지 사항

```
[ ] Generator가 main 브랜치에 직접 커밋
[ ] Validator PASS 없이 main 머지
[ ] 브랜치 명명 규칙 미준수 (task/ 접두사 없이 작업)
[ ] .env, credentials.*, secrets.* 파일 커밋
[ ] --no-verify 옵션으로 훅 우회
[ ] task/* 브랜치를 머지 전에 삭제
```

---

## 운영 예시

### Tier 2 성공 케이스

```
[상황] 사용자가 "프로필 페이지 컴포넌트 추가" 요청 → Tier 2 분류

1. Generator가 task/TASK-20260424-001 브랜치 생성 후 구현
   커밋: "[TASK-20260424-001] Add user profile page component"

2. Generator → Validator-A에게 검증 요청 (직접 전달)

3. Validator-A PASS 판정 → 머지 커밋 생성
   커밋 본문:
     Validator: Validator-A PASS (Codex CLI)
     Tier: Tier2

4. Validator-A가 main 머지 실행 → Analyst에게 완료 보고
   (Analyst 사전 승인 불필요)

5. Analyst가 사용자에게 최종 보고
```

### 2회 연속 FAIL → Conflict Report 케이스

```
[상황] Validator-A가 동일 오류를 2회 연속 감지

1회차 FAIL 후: Validator-A → Generator 수정 요청 (직접 전달)
2회차 FAIL 후: 수정 요청 대신 Conflict Report를 Analyst에게 직접 발행
```

```json
{
  "task_id": "TASK-20260424-001",
  "agent": "Validator-A",
  "type": "CONFLICT_REPORT",
  "loop_count": 2,
  "recurring_error": "XSS 취약점: 사용자 입력이 innerHTML에 직접 삽입됨",
  "root_cause_hypothesis": "현재 컴포넌트 구조가 입력 sanitize 레이어를 갖지 않아 success_criteria 충족이 구조적으로 불가능",
  "blocking_criterion": "보안 취약점 없음 (OWASP Top 10 기준)",
  "escalation_options": [
    "sanitize 유틸 레이어 추가를 Task Spec에 반영하여 성공 기준 재정의",
    "Researcher 재투입으로 DOMPurify 등 검증된 라이브러리 탐색",
    "사용자에게 설계 방향 확인 (템플릿 엔진 교체 여부)"
  ]
}
```

---

## 이력 보관 (선택 권장)

Squash Merge로 main에 남긴 커밋은 TASK-ID로 추적 가능하지만, 중요도가 높은 작업은 아래를 추가로 권장한다.

| 방법 | 적용 기준 | 명령 예시 |
|---|---|---|
| **Baseline tag** | 시스템 변경 전 상태를 기록할 때 | `git tag baseline-before-TASK-001 main` |
| **Release tag** | Tier 3 머지 완료 후 | `git tag v1.0.0-TASK-001` |
| **Patch 파일 보관** | 오프라인 백업 또는 리뷰 공유 | `git format-patch main..task/TASK-001` |

---

## 브랜치 충돌 처리

동일 파일을 수정하는 두 Task가 동시에 진행될 경우:

1. 먼저 완료된 Task가 main에 머지된다
2. 후행 Task의 Generator가 최신 main을 pull하여 브랜치를 rebase한다
3. 충돌 해결 후 Validator에게 재검증을 요청한다
4. `depends_on` 필드로 의존성을 명시하면 이 상황을 사전에 방지할 수 있다
