# Generator 실행 파이프라인 — 한국어 운영 가이드

**버전:** 1.0 | **최종 수정:** 2026-04-28  
**대상:** 02-HARNESS Analyst·운영자  
**용도:** `scripts/run-generator.mjs`로 Claude CLI Generator를 실제 실행하고, 결과물과 원장을 누락 없이 남기는 방법을 설명한다.

---

## 0. 문서 위치

이 문서는 **운영 가이드(Operational guide)** 클래스다. 권위 규칙을 새로 만들지 않고, 이미 확정된 Generator handoff 계약을 실행 가능한 절차로 풀어쓴다.

| 영역 | 권위 문서 |
|---|---|
| Generator 역할·출력 | `docs/agents/generator.md` |
| Handoff 입력 스키마 | `docs/schemas/generator-handoff.schema.json` |
| 작업 원장 이벤트 | `docs/operations/work-history-policy.md` |
| Claude CLI 옵션 | `docs/guides/claude-cli-options-ko.md` |
| FAIL 회복 흐름 | `docs/guides/generator-fail-recovery-ko.md` |

---

## 1. 왜 wrapper가 필요한가

Claude CLI를 직접 실행해도 파일 수정은 가능하다. 하지만 직접 실행만으로는 아래가 매번 사람 손에 맡겨진다.

- `tasks/handoffs/TASK-{ID}/generator-input.json` 경로 선택
- `--continue`/`--resume` 같은 금지 플래그 배제
- `generator-result.json`, `generator-stderr.log`, `generator-run.json` 저장
- `logs/tasks/TASK-{ID}.jsonl`에 `INSTRUCTION_SENT`, `AGENT_RESULT_RECEIVED` 기록
- 실패 시 Resource Failure와 Validator 전달 대기 상태 구분

`scripts/run-generator.mjs`는 이 반복 절차를 한 명령으로 묶는다.

---

## 2. 입력 준비

기본 입력 경로:

```text
tasks/handoffs/TASK-{ID}/generator-input.json
```

입력은 `docs/schemas/generator-handoff.schema.json`의 필수 필드를 가져야 한다.

필수 핵심:

| 필드 | 의미 |
|---|---|
| `schema_version` | `generator-handoff.v1` |
| `task_id` | 실행할 Task ID |
| `refs.spec` | Task Spec 경로 |
| `refs.ledger` | 작업 원장 경로 |
| `allowed_context` | Generator가 사용할 수 있는 목표·파일·제약 |
| `forbidden_context` | 절대 넘기지 않을 컨텍스트 |
| `expected_output_path` | Generator 결과 JSON 저장 경로 |

wrapper 실행 입력은 `.json`만 허용한다. `.md` handoff는 사람이 읽는 보조 문서로만 둘 수 있고, `scripts/run-generator.mjs`에는 전달하지 않는다.

이유는 명확하다. JSON handoff는 `task_id`, `refs.spec`, `refs.ledger`, `allowed_context`, `forbidden_context`, `expected_output_path`를 실행 전에 기계적으로 검증할 수 있다. Markdown 입력은 같은 수준의 구조 검증이 어렵기 때문에 Generator 격리 경계가 약해진다.

---

## 3. 실행 명령

검증만 수행:

```bash
npm run run:generator -- TASK-20260428-001 --dry-run
```

실제 실행:

```bash
npm run run:generator -- TASK-20260428-001
```

입력 경로 지정:

```bash
npm run run:generator -- TASK-20260428-001 \
  --input tasks/handoffs/TASK-20260428-001/generator-input-retry-2.json
```

Claude CLI 바이너리 지정:

```bash
npm run run:generator -- TASK-20260428-001 --claude-bin claude
```

환경변수로도 지정할 수 있다. 값은 로그에 기록하지 않는다.

```bash
GENERATOR_CLAUDE_BIN=claude npm run run:generator -- TASK-20260428-001
```

모델·effort 지정:

```bash
npm run run:generator -- TASK-20260428-001 --model opus --effort xhigh
```

기본값은 `--model opus --effort xhigh`다. `opus`는 Claude Code 공식 모델 alias다. 특정 모델 버전을 고정해야 하면 `--model claude-opus-4-7`처럼 명시한다. 문서화되지 않은 임의 alias는 기본값으로 쓰지 않는다.

권한 모드 지정:

```bash
npm run run:generator -- TASK-20260428-001 --permission-mode auto
```

기본값은 `auto`다. 이는 Claude Code가 작업 맥락과 도구 정책을 기준으로 권한을 자동 처리하게 하는 모드다. `--dangerously-skip-permissions`는 사용하지 않는다.

---

## 4. wrapper가 강제하는 것

`scripts/run-generator.mjs`는 다음 호출 형태를 사용한다.

```text
claude --print --model opus --effort xhigh --append-system-prompt "<02-HARNESS Generator system guidance>" --input-format text --output-format json --json-schema "<Generator output schema>" --no-session-persistence --permission-mode auto
```

> ⚠ **Known gotcha (INS-20260429-009-01 출처)** — `--bare` 플래그는 hooks·plugins·MCP·자동 메모리·CLAUDE.md 자동 발견뿐 아니라 **OAuth 자동 로드도 silently skip**한다 (Claude Code v2.1.x에서 경험적으로 확인). headless 모드에서는 `CLAUDE_CODE_OAUTH_TOKEN` env var를 명시 전달해도 `--bare` 동시 사용 시 "Not logged in" 에러가 나며, 실제 호출이 차단된다. wrapper는 `--bare`를 의도적으로 제외한다. 부작용: hooks·plugins·CLAUDE.md가 로드되어 컨텍스트 격리는 **권한 모드(`--permission-mode auto`)와 도구 allowlist에 의존**하게 된다. 이것이 다음 강화 후보(TASK-010+).

> ⚠ **Known gotcha (INS-20260429-009-02 출처)** — `--output-format json` + `--json-schema` 플래그는 Claude의 **응답 메타데이터를 JSON으로 감싸지만**, `result` 필드 안의 **실제 응답 텍스트가 그 schema를 따른다고 보장하지 않는다**. Claude는 schema를 "참고 가이드"로 해석할 수 있어, Generator가 자연어로 자기 작업을 보고하고 끝낼 수 있다 (file edit은 정상 수행하면서). wrapper는 현재 `result` 필드를 JSON 객체로 파싱하려 시도해서 자연어 응답에 실패한다. 검증은 git diff로 file change를 직접 확인하는 방식이 더 견고하다 (TASK-010에서 wrapper 보강 예정).

기본 도구 allowlist:

```text
Read,Edit,Write,Bash(npm test),Bash(git diff *),Bash(git status *)
```

기본값에는 git 쓰기 권한이 없다. Generator에게 task 브랜치 생성·커밋까지 맡기는 격리 실행에서만 `--allow-git-write`를 명시한다.

```bash
npm run run:generator -- TASK-20260428-001 --allow-git-write
```

이 경우에만 아래 도구가 추가된다.

```text
Bash(git checkout *),Bash(git add *),Bash(git commit *)
```

기본 도구 blocklist:

```text
WebSearch,WebFetch
```

금지 플래그:

```text
--continue
--resume
--from-pr
--fork-session
--dangerously-skip-permissions
--allow-dangerously-skip-permissions
```

이 금지 플래그가 wrapper 내부 명령에 들어가면 실행 전 실패한다.

`bypassPermissions` 모드는 CLI 플래그가 아니라 `--permission-mode bypassPermissions` 값으로도 지정할 수 있다. wrapper는 이 값도 기본 차단하며, 격리된 테스트 환경에서 운영자가 명시적으로 `--allow-bypass-permissions`를 준 경우에만 허용한다. 일반 Generator 실행 기본값은 `auto`다.

system guidance는 `--append-system-prompt`로 전달하고, stdin에는 handoff payload 원문만 전달한다. 이렇게 해서 운영 지침과 입력 데이터가 한 덩어리로 섞이는 위험을 줄인다.

wrapper는 실행 전에 `refs.spec`, `refs.ledger`, `expected_output_path`가 저장소 루트 안에 있는지 확인한다. `refs.spec`이 없거나 `refs.ledger`가 해당 Task 원장을 가리키지 않으면 실행하지 않는다.

추가로 실제 실행은 현재 브랜치가 `task/{TASK-ID}`일 때만 허용한다. `--dry-run`은 브랜치와 무관하게 명령 형태를 확인할 수 있지만, 실제 Generator 실행은 브랜치 정책을 스크립트가 강제한다. 격리 테스트가 꼭 필요할 때만 `--allow-non-task-branch`를 사용할 수 있으며, 일반 운영에서는 사용하지 않는다.

`expected_output_path`는 `tasks/handoffs/{TASK-ID}/generator-result*.json`으로 제한한다. 이렇게 해서 handoff 파일이 실수로 저장소 내부 다른 파일을 stdout으로 덮어쓰는 일을 막는다.

Generator 실행이 끝난 뒤에는 `allowed_context.target_files`와 실제 변경 파일도 대조한다. wrapper는 `main...HEAD` diff와 워킹트리 상태를 읽고, handoff 운영 산출물(`generator-result.json`, `generator-stdout.raw.json`, `generator-stderr.log`, `generator-run.json`, 해당 Task 원장)을 제외한 변경 파일이 `target_files` 밖에 있으면 `HOLD`로 막는다. 따라서 Generator가 새 파일을 만들 가능성이 있으면 그 파일도 handoff의 `target_files`에 미리 넣어야 한다.

동일 Task의 동시 실행을 막기 위해 실제 실행 시 `tasks/handoffs/TASK-{ID}/.generator.lock`을 만든다. 실행이 끝나면 자동 삭제한다. lock이 남아 있으면 실행 중인 프로세스가 없는지 확인한 뒤에만 수동 삭제한다.

---

## 5. 산출물

실행 성공 또는 실패 후 아래 파일이 생성된다.

```text
tasks/handoffs/TASK-{ID}/generator-result.json
tasks/handoffs/TASK-{ID}/generator-stdout.raw.json
tasks/handoffs/TASK-{ID}/generator-stderr.log
tasks/handoffs/TASK-{ID}/generator-run.json
```

| 파일 | 의미 |
|---|---|
| `generator-result.json` | wrapper가 정규화한 Generator 출력 JSON이다. Validator에는 이 파일을 전달한다. |
| `generator-stdout.raw.json` | Claude CLI stdout 원문이다. `--output-format json` 때문에 CLI wrapper JSON일 수 있다. |
| `generator-stderr.log` | Claude CLI stderr. 오류·경고 확인용이다. |
| `generator-run.json` | 실행 시작/종료 시각, exit status, artifact 경로, command shape 메타데이터다. |

`generator-stderr.log`와 `generator-result.json`은 외부 공유 전에 민감 정보 포함 여부를 확인한다. wrapper는 환경변수 값을 기록하지 않지만, Generator가 출력한 내용은 별도 검토가 필요하다. 특히 stderr는 CLI 오류, 모델 경고, 도구 실패 메시지를 그대로 담으므로 보고서나 사용자 답변에 원문 전체를 붙이지 않는다.

Claude CLI에는 `--output-format json`과 `--json-schema`를 함께 전달한다.

- `--output-format json`: CLI의 stdout을 JSON 컨테이너로 받는 장치다.
- `--json-schema`: 모델이 02-HARNESS Generator 출력 형식에 맞춰 답하도록 요구하는 장치다.

다만 CLI가 stdout을 `{ "result": "..." }` 같은 wrapper JSON으로 감쌀 수 있으므로, wrapper는 `generator-stdout.raw.json`을 먼저 저장한 뒤 실제 Generator JSON을 추출·정규화해서 `generator-result.json`에 쓴다. 이후 아래 필드를 다시 확인한다.

```text
task_id
agent
status
artifacts
change_summary
self_review
tier_reclassification_needed
log
```

이 검증을 통과해야만 `PENDING_VALIDATION`으로 기록한다. JSON 파싱 또는 필수 필드 검증에 실패하면 Task는 `HOLD`로 남기고, Generator 출력 형식을 고친 뒤 재실행한다.

출력 JSON 검증을 통과해도 변경 파일 범위 검증이 실패하면 마찬가지로 `HOLD` 상태가 된다. 이 경우 `allowed_context.target_files`가 너무 좁았는지, Generator가 범위 밖 파일을 잘못 수정했는지 먼저 판단한다.

---

## 6. 원장 이벤트

실제 실행 시 wrapper는 `refs.ledger`에 이벤트를 append 한다.

| 시점 | 이벤트 | 상태 |
|---|---|---|
| 실행 직전 | `INSTRUCTION_SENT` | `ACTIVE` |
| exit status 0 | `AGENT_RESULT_RECEIVED` | `PENDING_VALIDATION` |
| exit status non-zero | `AGENT_RESULT_RECEIVED` | `HOLD` |
| CLI 실행 자체 실패 | `RESOURCE_FAILURE` | `HOLD` |

`--dry-run`은 원장과 산출물을 변경하지 않는다.

---

## 7. Validator 전달

Generator가 `PENDING_VALIDATION` 상태로 끝나면 다음 단계는 Tier에 따라 달라진다.

| Tier | 다음 단계 |
|---|---|
| Tier 1 | Analyst 자체 검토 |
| Tier 2 | Validator-A에게 `generator-result.json`, Task Spec, 변경 diff 전달 |
| Tier 3 | Analyst가 Validator-A/B에 독립 팬아웃 |

Validator FAIL이 발생하면 `docs/guides/generator-fail-recovery-ko.md`의 재시도 입력 규칙에 따라 `generator-input-retry-{N}.json`을 만들고 wrapper를 다시 실행한다.

---

## 8. Failure Handling 적용 상태

Generator-Validator 반복 전략은 `docs/workflows/failure-handling.md`가 권위 문서다. 핵심은 아래 네 가지다.

| 상황 | 처리 |
|---|---|
| Generator 생성 오류 | 즉시 재시도하되, 매번 접근 방식을 바꾼다. 최대 3회. |
| Validator FAIL | Generator 수정 요청 후 재검증한다. |
| 동일 오류 2회 반복 | 세션 종료가 아니라 Conflict Report → Analyst Adjudication으로 전환한다. |
| Tool/Model Resource Failure | FAIL로 치지 않고 `HOLD` 또는 `PENDING_VALIDATION`으로 보존한다. |

현재 자동화된 부분:

```text
[x] Generator fresh 실행
[x] Generator 결과 artifact 저장
[x] CLI 실행 실패/비정상 종료를 HOLD/RESOURCE_FAILURE로 기록
[x] retry input 파일을 지정해 fresh 재실행 가능
[x] 원장에 INSTRUCTION_SENT, AGENT_RESULT_RECEIVED, RESOURCE_FAILURE 기록
```

아직 운영자/Analyst가 수행하는 부분:

```text
[ ] Validator-A/B 실제 호출
[ ] Validator errors[]를 generator-input-retry-{N}.json에 반영
[ ] 동일 오류 2회 반복 여부 판정
[ ] Conflict Report 작성
[ ] Adjudication 판정과 Task Spec 보완
```

즉 현재 파이프라인은 **Generator 실행·기록 파이프라인**은 자동화되어 있고, **Validator 반복·중재 파이프라인**은 문서 규칙에 따라 운영자가 수행하는 상태다. 다음 자동화 대상은 `scripts/run-validator-a.mjs` 또는 `scripts/prepare-generator-retry.mjs`처럼 Validator 결과를 읽어 retry handoff를 만드는 단계다.

---

## 9. 운영 체크리스트

실행 전:

```text
[ ] 현재 브랜치가 task/{TASK-ID}인지 확인
[ ] Task Spec이 최신인지 확인
[ ] generator-input.json이 allowed_context와 forbidden_context를 명확히 구분하는지 확인
[ ] secrets, credentials, PII 값이 입력에 없는지 확인
[ ] --dry-run으로 경로와 command shape 확인
```

현재 브랜치 확인은 운영자 체크리스트이면서 wrapper 강제 조건이다. 실제 실행 시 브랜치가 맞지 않으면 wrapper가 실행을 거부한다.

실행 후:

```text
[ ] generator-result.json이 JSON으로 파싱 가능한지 확인
[ ] generator-stderr.log에 민감 정보가 없는지 확인
[ ] git diff로 Generator 변경 범위 확인
[ ] 원장에 INSTRUCTION_SENT와 AGENT_RESULT_RECEIVED 또는 RESOURCE_FAILURE가 append 되었는지 확인
[ ] Tier에 맞춰 Validator 또는 Analyst 검토로 넘김
```

`generator-result.json`의 JSON 파싱과 필수 필드 확인은 wrapper가 1차로 수행한다. 운영자는 그 다음 실제 변경 범위와 self-review 내용이 Task Spec에 맞는지 확인한다.

---

## 10. 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| 1.0 | 2026-04-28 | 최초 작성. `scripts/run-generator.mjs` 운영 절차 문서화 |
