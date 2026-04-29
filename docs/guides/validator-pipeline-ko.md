# Validator 실행 파이프라인 — 한국어 운영 가이드

**버전:** 1.0 | **최종 수정:** 2026-04-29  
**대상:** 02-HARNESS Analyst·운영자  
**용도:** `scripts/run-validator-a.mjs`와 `scripts/prepare-generator-retry.mjs`로 Validator-A 실행, FAIL 회복 입력 생성, Conflict Report 전환을 운영하는 방법을 설명한다.

---

## 0. 문서 위치

이 문서는 **운영 가이드(Operational guide)** 클래스다. 권위 규칙은 새로 만들지 않고 아래 문서를 실행 절차로 풀어쓴다.

| 영역 | 권위 문서 |
|---|---|
| Validator 역할·출력 | `docs/agents/validator.md` |
| 실패·재시도·Conflict Report | `docs/workflows/failure-handling.md` |
| 작업 원장 이벤트 | `docs/operations/work-history-policy.md` |
| 도구 권한 | `docs/operations/tool-permissions.md` |
| 출력 형식 | `docs/schemas/output-formats.md` |

---

## 1. 설계 원칙

Validator-A 자동화는 판단을 대체하지 않는다. wrapper는 아래만 수행한다.

```text
[x] Validator handoff JSON 검증
[x] Codex CLI command shape 고정
[x] stdout JSONL, stderr, 마지막 메시지, 실행 메타데이터 저장
[x] Validator 결과 JSON 필수 필드 검증
[x] PASS/FAIL/RESOURCE_FAILURE를 원장에 기록
[x] FAIL 결과에서 Generator retry input 또는 Conflict Report 생성
[ ] main merge 자동 실행
```

머지는 별도 단계다. 검증 실행은 기본 `read-only` sandbox이며, PASS가 있어도 wrapper가 main을 직접 바꾸지 않는다.

---

## 2. 입력 파일

기본 위치:

```text
tasks/handoffs/TASK-{ID}/validator-a-input.json
```

스키마:

```text
docs/schemas/validator-handoff.schema.json
```

핵심 필드:

| 필드 | 의미 |
|---|---|
| `refs.spec` | Task Spec 원본 |
| `refs.ledger` | 작업 원장 |
| `refs.generator_result` | Generator 결과 JSON |
| `changed_files` | Validator가 집중할 변경 파일 |
| `success_criteria` | Task Spec과 의미가 같은 검증 기준 |
| `known_risks` | 보안·런타임·범위 위험 |
| `forbidden_context` | Validator에게 넘기면 안 되는 컨텍스트 |
| `expected_output_path` | `validator-a-result*.json` 저장 위치 |

Tier 3에서는 Validator-B에게 Validator-A 입력·결과를 넘기지 않는다. Validator-A/B 독립성은 Analyst가 입력 파일 단계에서 보장한다.

wrapper는 모델 CLI를 호출하기 전에 handoff payload를 preflight 검사하여 secret 형태 값(자격 증명·API 키·환경 변수 값 등)이 감지되면 실행을 차단한다.

---

## 3. Validator-A 실행

Dry-run:

```bash
npm run run:validator-a -- TASK-20260429-999 --dry-run
```

실제 실행:

```bash
npm run run:validator-a -- TASK-20260429-999
```

입력 파일 지정:

```bash
npm run run:validator-a -- TASK-20260429-999 \
  --input tasks/handoffs/TASK-20260429-999/validator-a-input-retry-2.json
```

시도 번호 지정:

```bash
npm run run:validator-a -- TASK-20260429-999 --attempt 2
```

wrapper가 사용하는 Codex CLI 기본 형태:

```text
codex -a never exec --json --output-schema docs/schemas/validator-result.schema.json --output-last-message tasks/handoffs/TASK-{ID}/validator-a-last-message-{N}.json --ephemeral -s read-only -C . -
```

`--json` stdout은 이벤트 로그로 저장하고, `--output-last-message` 파일을 최종 Validator result로 파싱한다.

Windows에서 Codex가 `codex.cmd` 또는 `.bat` shim으로 설치된 경우 Node의 직접 `spawnSync(codex.cmd, ...)`가 `EINVAL`로 실패할 수 있다. wrapper는 `.cmd`/`.bat` 실행 파일을 감지하면 `cmd.exe /d /s /c` 경유로 호출하고, 실제 호출 형태를 `validator-a-run-{N}.json`의 `actual_spawn_command`에 남긴다.

현재 Codex CLI에서 승인 정책 옵션 `-a never`는 `exec` 하위 명령 옵션이 아니라 최상위 `codex` 옵션이다. wrapper는 반드시 `codex -a never exec ...` 순서로 호출한다. `codex exec ... -a never ...` 순서는 `unexpected argument '-a'`로 종료된다.

> ⚠ **Known gotcha (TASK-20260429-015 출처)** — PowerShell에서 `codex`가 보인다고 해서 Node subprocess에서도 같은 방식으로 실행된다는 뜻은 아니다. smoke test에서 기본 `codex`는 `ENOENT`, `codex.cmd` 직접 spawn은 `EINVAL`이었다. Windows에서는 wrapper 메타데이터의 `actual_spawn_command`와 `resource_failure_type`을 먼저 확인한다.

---

## 4. 산출물

```text
tasks/handoffs/TASK-{ID}/validator-a-result-{N}.json
tasks/handoffs/TASK-{ID}/validator-a-events-{N}.jsonl
tasks/handoffs/TASK-{ID}/validator-a-last-message-{N}.json
tasks/handoffs/TASK-{ID}/validator-a-stderr-{N}.log
tasks/handoffs/TASK-{ID}/validator-a-run-{N}.json
```

| 파일 | 의미 |
|---|---|
| `validator-a-result-{N}.json` | 정규화된 Validator-A 결과 |
| `validator-a-events-{N}.jsonl` | Codex CLI `--json` 이벤트 로그 |
| `validator-a-last-message-{N}.json` | Codex 최종 메시지 원문 |
| `validator-a-stderr-{N}.log` | CLI stderr |
| `validator-a-run-{N}.json` | 실행 메타데이터 |

stderr와 이벤트 로그는 외부 공유 전에 민감 정보 여부를 확인한다.

---

## 5. 원장 이벤트

| 상황 | 이벤트 | 상태 |
|---|---|---|
| 실행 직전 | `INSTRUCTION_SENT` | `PENDING_VALIDATION` |
| PASS 결과 | `VALIDATION_RESULT` | `COMPLETE` |
| FAIL 결과 | `VALIDATION_RESULT` | `RETRYING` |
| CLI 실행 실패·출력 누락 | `RESOURCE_FAILURE` | `HOLD` |

Resource Failure는 Validator FAIL이 아니다. 필수 Validator가 Resource Failure이면 main 머지는 금지된다.

---

## 6. FAIL 후 retry handoff 생성

Validator-A FAIL 결과가 있으면:

```bash
npm run prepare:retry -- TASK-20260429-999
```

명시 경로:

```bash
npm run prepare:retry -- TASK-20260429-999 \
  --validator-result tasks/handoffs/TASK-20260429-999/validator-a-result-1.json \
  --generator-result tasks/handoffs/TASK-20260429-999/generator-result.json \
  --generator-input tasks/handoffs/TASK-20260429-999/generator-input.json
```

정상 출력:

```text
tasks/handoffs/TASK-{ID}/generator-input-retry-{N}.json
```

retry input에는 Validator `errors[]`의 `evidence_type`, `location`, `description`, `suggestion`, `evidence`가 보존된다. 또한 `retry_instruction`에 "이전 접근 반복 금지"가 명시된다.

---

## 7. 동일 오류 반복 시 Conflict Report

`prepare-generator-retry.mjs`는 이전 retry handoff의 Validator error fingerprint와 현재 FAIL을 비교한다.

반복 기준:

```text
evidence_type + location + normalized description
```

동일 오류가 반복되면 retry input을 만들지 않고 아래 파일을 생성한다.

```text
tasks/handoffs/TASK-{ID}/conflict-report-{N}.json
```

이 경우 Task는 Analyst Adjudication이 필요하다. Generator를 다시 실행하려면 Analyst가 성공 기준을 정정하거나 다른 접근을 명시해야 한다.

---

## 8. 운영 체크리스트

실행 전:

```text
[ ] Generator 결과가 `PENDING_VALIDATION` 상태인지 확인
[ ] Validator handoff가 Task Spec의 success_criteria와 의미가 같은지 확인
[ ] Tier 3이면 다른 Validator 결과를 포함하지 않았는지 확인
[ ] `--dry-run`으로 command shape 확인
```

실행 후:

```text
[ ] `validator-a-result-{N}.json` 파싱 가능
[ ] FAIL이면 `errors[]`마다 evidence_type 존재
[ ] Resource Failure이면 merge 금지
[ ] FAIL이면 `prepare:retry` 또는 Analyst Adjudication으로 진행
[ ] PASS이면 별도 merge 단계에서 git-branch-policy.md의 2-commit squash 절차 수행
```

`scripts/run-validator-a.mjs` 자체를 수정하는 Task에서는 같은 wrapper 실행만으로 자기 자신을 검증했다고 보지 않는다. 먼저 fixture, `node --check`, `audit:harness` 같은 로컬 검증으로 수정 계층을 확인하고, 필요하면 별도 후속 smoke test Task에서 실제 Generator → Validator-A 파이프라인을 다시 실행한다.

---

## 9. 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| 1.0 | 2026-04-29 | 최초 작성. Validator-A wrapper와 retry handoff 자동화 절차 문서화 |
