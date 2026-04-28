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

입력이 `.md`인 경우도 실행은 가능하지만, 자동 구조 검증은 `.json`보다 약하다. 운영 기본은 `.json`이다.

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
npm run run:generator -- TASK-20260428-001 --model best --effort xhigh
```

기본값은 `--model best --effort xhigh`다. `best`는 Claude Code의 "가장 강한 모델" 별칭으로 운영하고, 최신 모델명은 Claude Code 공식 문서와 설치된 CLI 버전에 따른다. 특정 모델을 고정해야 하면 `--model claude-opus-4-5`처럼 명시한다.

권한 모드 지정:

```bash
npm run run:generator -- TASK-20260428-001 --permission-mode auto
```

기본값은 `auto`다. 이는 Claude Code가 작업 맥락과 도구 정책을 기준으로 권한을 자동 처리하게 하는 모드다. `--dangerously-skip-permissions`는 사용하지 않는다.

---

## 4. wrapper가 강제하는 것

`scripts/run-generator.mjs`는 다음 호출 형태를 사용한다.

```text
claude --bare --print --model best --effort xhigh --input-format text --output-format json --no-session-persistence --permission-mode auto
```

기본 도구 allowlist:

```text
Read,Edit,Write,Bash(npm test),Bash(git diff *)
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

---

## 5. 산출물

실행 성공 또는 실패 후 아래 파일이 생성된다.

```text
tasks/handoffs/TASK-{ID}/generator-result.json
tasks/handoffs/TASK-{ID}/generator-stderr.log
tasks/handoffs/TASK-{ID}/generator-run.json
```

| 파일 | 의미 |
|---|---|
| `generator-result.json` | Claude CLI stdout. Generator 출력 JSON이어야 한다. |
| `generator-stderr.log` | Claude CLI stderr. 오류·경고 확인용이다. |
| `generator-run.json` | 실행 시작/종료 시각, exit status, artifact 경로, command shape 메타데이터다. |

`generator-stderr.log`와 `generator-result.json`은 외부 공유 전에 민감 정보 포함 여부를 확인한다. wrapper는 환경변수 값을 기록하지 않지만, Generator가 출력한 내용은 별도 검토가 필요하다.

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

실행 후:

```text
[ ] generator-result.json이 JSON으로 파싱 가능한지 확인
[ ] generator-stderr.log에 민감 정보가 없는지 확인
[ ] git diff로 Generator 변경 범위 확인
[ ] 원장에 INSTRUCTION_SENT와 AGENT_RESULT_RECEIVED 또는 RESOURCE_FAILURE가 append 되었는지 확인
[ ] Tier에 맞춰 Validator 또는 Analyst 검토로 넘김
```

---

## 10. 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| 1.0 | 2026-04-28 | 최초 작성. `scripts/run-generator.mjs` 운영 절차 문서화 |
