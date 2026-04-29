# Git Branch Policy — 브랜치 격리 정책

**버전:** 1.9 | **최종 수정:** 2026-04-29  
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
   git branch -d task/{TASK-ID}
   git branch --merged main
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

### Squash Merge 운영 순서 — 2-commit 패턴 (표준)

Squash merge 시 main에 두 커밋을 만든다. 첫 번째는 task 브랜치의 작업 결과만, 두 번째는 후속 metadata만 담는다.

```
main:    ... ──── [1차] pure squash ──── [2차] post-completion record ────►
                  │                       │
                  │                       └─ CURRENT_STATE / 세션 로그 / MERGE_COMPLETED 등
                  └─ 이 커밋의 tree = task 브랜치 tip의 tree
                     → cleanup 스크립트의 트리 동등성 검사 통과 → 자기 브랜치 자동 정리 가능
```

#### 단계별 실행

1. `task/{TASK-ID}` 브랜치에서 모든 작업 변경을 커밋한다.
2. `main`으로 전환한다.
3. `git merge --squash task/{TASK-ID}`를 실행한다 (변경이 staged 상태가 됨).
4. **여기서 staged 상태를 그대로 1차 커밋한다** — Validator 결과와 Tier가 포함된 squash commit. post-merge metadata는 아직 추가하지 않는다.
   - 이 시점 1차 커밋의 tree == task 브랜치 tip의 tree여야 한다.
5. 1차 커밋 직후 `MERGE_COMPLETED` 이벤트와 `CURRENT_STATE.md`, 최신 세션 로그의 `## 다음 단계`, 필요한 `CORRECTION` 이벤트를 갱신한다.
6. 갱신한 기록 파일들을 `git add`하고 **2차 커밋**으로 분리한다 — `[TASK-ID] Record ... completion` 형식.
7. 두 커밋을 `git push origin main`으로 한 번에 push한다.
8. `git status --short --branch`로 main 상태와 `origin/main` 동기화를 확인한다.
9. `npm run clean:branches -- --force`로 자기 task 브랜치를 정리한다 (1차 커밋의 tree 동등성으로 자동 통과).
10. `git branch --list` 결과를 원장 또는 보고서에 요약한다.

#### 왜 2단계인가

1-commit 패턴(post-merge metadata를 squash commit에 함께 넣기)은 squash commit의 tree가 task 브랜치 tip의 tree보다 metadata만큼 더 커진다. 그러면 cleanup 스크립트의 squash 트리 동등성 검사가 차이를 감지해서 자기 브랜치를 보존해 버린다 (정상 동작이지만 운영자가 매번 수동으로 `git branch -D`를 해야 함). 1차/2차로 분리하면 1차 커밋의 tree가 정확히 task 브랜치 tip의 tree와 같아지므로 자기 브랜치도 자동 정리된다.

#### 1차 / 2차 커밋 메시지 형식

**1차 (pure squash):**
```
[{TASK-ID}] {작업 요약}

Validator: Validator-A PASS (Codex CLI)
Tier: Tier2
```

**2차 (post-completion record):**
```
[{TASK-ID}] Record {요약} completion

- Append MERGE_COMPLETED with main commit hash and PUSHED
- Update CURRENT_STATE.md and session log
- Final cleanup metadata (insights, etc.)

Tier: Tier2
```

#### 커밋 해시 기록 주의

- 1차 커밋의 해시는 `MERGE_COMPLETED`에 들어가야 하지만 1차 커밋 시점엔 아직 모른다. 1차 커밋 직후 hash를 읽어 2차 커밋의 ledger 업데이트에 반영한다.
- 1차 커밋을 amend로 수정해서 자기 hash를 박는 시도는 하지 않는다 (amend는 hash를 다시 바꾼다).
- 자기 참조가 필요한 곳에서는 `SELF_REFERENTIAL_MAIN_SQUASH_COMMIT` placeholder를 1차 커밋에 두고, 2차 커밋에서 실제 hash로 보정하는 `CORRECTION` 이벤트를 append한다.

#### Legacy 1-commit 패턴 (deprecated)

이전 정책의 단일 커밋 방식은 더 이상 표준이 아니다. 단, 다음 조건이 모두 충족될 때만 예외적으로 허용된다.

- 운영자가 자기 task 브랜치를 수동 `git branch -D`로 정리할 의지와 검증 책임을 명시
- 사유를 `MERGE_COMPLETED.details.legacy_one_commit_reason`에 기록
- 다음 작업 직전에 잔존 브랜치를 0으로 회수

위 예외 없이 1-commit 패턴을 쓰면 이 절의 표준 위반이며 감사에서 향후 게이트로 차단될 수 있다.

### Push / Origin 인수인계

commit/merge/push는 항상 세트다. 작업 완료 = push까지 완료. 요청 여부와 무관하다.

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
[ ] `git branch --merged main`으로 완료 브랜치 병합 여부 확인
[ ] 완료된 로컬 `task/{TASK-ID}` 브랜치 삭제
[ ] 삭제 후 남은 로컬 브랜치 목록을 원장 또는 보고서에 요약
```

금지:

```text
[ ] push하지 않았는데 원격 반영 완료로 보고
[ ] push 실패를 Task COMPLETE로 숨기기
[ ] push 없이 작업 완료로 처리
[ ] 머지 완료된 task 브랜치를 이유 없이 남겨두기
```

### Post-merge Branch Cleanup

머지와 push가 끝난 뒤에는 로컬 작업 브랜치를 정리한다. 브랜치 정리는 이력 삭제가 아니라 로컬 작업공간 정리이며, main에 반영된 커밋은 유지된다.

#### 검증 기준 — Squash 트리 동등성 (Squash Tree Equivalence)

이 저장소는 squash merge를 기본으로 쓰기 때문에 task 브랜치 tip은 main의 ancestor가 되지 않는다. 따라서 git의 `--merged` 검사(`git branch --merged main`)는 항상 false negative이고, `git branch -d`도 거부된다. 또한 단순 `git diff main..<branch>`는 main이 squash 후 다른 task로 진행된 경우 false positive(아직 안 머지된 것처럼 보임)를 낸다. 이 절은 두 한계를 동시에 피하기 위해 **squash 커밋의 트리와 브랜치 tip의 트리를 직접 비교**한다.

```bash
# branch가 main에 squash로 반영됐는지 확인하는 안전한 방법
task_id="TASK-YYYYMMDD-NNN"
branch_tree=$(git rev-parse "task/${task_id}^{tree}")
squash_commit=$(git log main --grep "\\[${task_id}\\]" --reverse --pretty=format:%H | head -1)
squash_tree=$(git rev-parse "${squash_commit}^{tree}")
[ "$branch_tree" = "$squash_tree" ] && echo "MATCH (safe to delete)" || echo "DIFFER (keep)"
```

이 검사가 정확한 이유:

- main의 **첫 번째** `[TASK-ID]` 커밋이 squash merge 그 자체다. 이후 main에 추가된 후속 작업(다른 task)이 같은 파일을 건드려도 squash 커밋의 트리는 그대로 남아 있다.
- 브랜치 tip의 트리가 squash 커밋의 트리와 **완전히 같다면**, 그 브랜치의 모든 기여가 main에 반영됐다는 결정적 증거다.
- 트리가 다르면 두 가지 의미: (a) squash 후 브랜치에 추가 커밋이 있음, 또는 (b) main에 머지된 적이 없음. 둘 다 보존이 안전.

> ⚠ **Known gotcha (INS-20260428-006-03 출처)** — Legacy 1-commit 패턴(post-merge metadata를 squash commit에 포함)을 쓰면 squash commit의 tree가 task 브랜치 tip의 tree보다 metadata만큼 더 크다. 따라서 cleanup 스크립트의 squash 트리 동등성 검사가 차이를 감지해 자기 task 브랜치를 보존해 버린다. 위 "Squash Merge 운영 순서 — 2-commit 패턴"을 사용하면 1차 (pure squash) 커밋의 tree가 task 브랜치 tip의 tree와 정확히 일치하므로 자기 브랜치도 자동 정리된다. 부득이 1-commit 패턴을 쓴 경우엔 수동 `git branch -D`로 정리하고 사유를 기록한다.

#### 권장 명령

```bash
# 1. 자동 정리 (스크립트, 권장)
npm run clean:branches                                                  # dry-run 보고만
npm run clean:branches -- --force                                       # 트리 동등성 통과한 브랜치 일괄 -D
npm run clean:branches -- --branch task/TASK-YYYYMMDD-NNN --force      # 단일 브랜치 정리

# 2. 수동 검증 (스크립트 신뢰가 어려울 때만)
git rev-parse "task/${task_id}^{tree}"
git log main --grep "\\[${task_id}\\]" --reverse --pretty=format:%H | head -1 | xargs -I{} git rev-parse "{}^{tree}"
```

#### 규칙

- 브랜치 tip의 tree 객체와 main의 첫 번째 `[TASK-ID]` 커밋의 tree 객체가 **identical**인 브랜치만 삭제한다.
- 현재 체크아웃된 브랜치와 `main`은 어떤 옵션 조합으로도 삭제하지 않는다.
- 트리가 다르거나 main에 같은 task_id 커밋이 없으면 보존하고, 보고서에 보존 사유를 적는다.
- 원격 task 브랜치(`origin/task/...`)는 별도 승인 없이 삭제하지 않는다. 우선 사용자에게 보고한다.
- 완료 보고에는 검사한 브랜치, 삭제한 브랜치, 보존한 브랜치, 보존 사유를 요약한다.
- `scripts/clean-merged-task-branches.mjs`는 기본 dry-run으로 동작하며, 삭제는 `--force` 명시가 필요하다.

#### Legacy 명령 (참고)

```bash
git branch --merged main          # squash merge 환경에서는 main만 표시됨 (cleanup 단일 기준으로 부적합)
git branch -d task/TASK-...       # squash 후엔 거의 항상 거부됨
git diff main..task/TASK-...      # main이 진행된 경우 false positive 가능
```

위 명령들은 일반 merge 환경의 git 기본 안전장치이며, 본 저장소의 squash merge 기본 정책에서는 cleanup의 단일 기준으로 사용하지 않는다.

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
| 기본 (파일 변경 있음) | Analyst 자체 검토 후 main에 직접 commit + push — 브랜치 생성 없음 |
| Generator 파일 수정 필요 | 원칙적으로 `task/{TASK-ID}` 브랜치 사용. 단, 저장소가 아니거나 사용자가 로컬 반영만 요청한 경우 Non-git 작업공간 운영 모드로 전환하고 원장에 사유를 기록 |

Tier 1 기본 commit + push 순서:

```powershell
# 1. 세션 로그 갱신 확인 (파일 변경이 1건이라도 있으면 필수 — 생략 시 commit 금지)
#    logs/sessions/SESSION-{YYYYMMDD}-{NNN}.md 에 이번 Task 인라인 보고 원문 기록 완료 여부 확인

git add {변경된 파일들} {세션 로그 파일}
git commit -m "[{TASK-ID}] {변경 내용 요약}"
git push origin main
```

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
