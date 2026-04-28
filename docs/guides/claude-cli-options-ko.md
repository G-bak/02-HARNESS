# Claude Code CLI 옵션 한국어 레퍼런스

**버전:** 1.0 | **최종 수정:** 2026-04-28  
**대상 도구:** Claude Code CLI (`claude` 명령) — 2026년 4월 기준 공식 문서  
**용도:** LandingHub / 02-HARNESS 운영자가 `claude` 명령을 호출할 때 옵션을 빠르게 찾기 위한 참고 가이드

---

## 0. 이 문서를 읽는 법

- 모든 **플래그·옵션·환경 변수·서브커맨드 이름은 영문 원문 그대로** 적었습니다. 옵션 이름은 대소문자까지 정확해야 동작합니다.
- 본 가이드는 **요약본**입니다. 옵션이 새로 추가됐거나 동작이 바뀌었을 가능성이 있으니, 실제 운영 직전에는 반드시 `claude --help` 또는 공식 문서로 최신 동작을 확인하세요.
- 문서 출처가 불분명한 항목은 "확인 불가"로 명시했습니다.
- 운영 환경 호출 규칙(예: `--continue`/`--resume`/permission bypass 금지)은 `docs/operations/tool-permissions.md`와 `docs/agents/generator.md`가 권위 문서이며, 본 가이드와 충돌 시 권위 문서가 우선합니다.

---

## 1. 기본 호출 방식 (Invocation Modes)

### 1-1. 대화형 모드 (Interactive Mode)

```bash
# 대화형 세션 시작 (인수 없음)
claude

# 초기 프롬프트와 함께 대화형 세션 시작
claude "이 프로젝트가 무엇을 하는지 설명해줘"
```

### 1-2. 단발 실행 (Print / Headless Mode)

`-p` 또는 `--print` 플래그를 사용하면 응답을 한 번 출력하고 즉시 종료합니다.

```bash
claude -p "이 함수의 동작을 설명해줘"
claude --print "이 파일을 검토해줘"
```

### 1-3. 표준 입력(stdin) 파이프

파일·명령 출력·HTTP 응답을 그대로 프롬프트와 함께 넘길 때 사용합니다.

```bash
cat src/main.py | claude -p "이 코드를 보안 관점에서 검토해줘"
npm test 2>&1 | claude -p "테스트 실패 원인을 정리해줘"
curl https://api.example.com | claude -p "이 응답 구조를 설명해줘"
```

### 1-4. 세션 이어가기

| 옵션 | 동작 |
|---|---|
| `-c`, `--continue` | 현재 디렉토리의 가장 최근 세션을 그대로 이어감 |
| `-r <id>`, `--resume <id>` | 특정 세션 ID 또는 이름으로 재개. 인자 생략 시 대화형 선택기 노출 |
| `--session-id <UUID>` | 명시적인 UUID로 세션 ID 지정 |
| `--fork-session` | 재개 시 새 세션 ID를 만들지 않고 원본 세션을 재사용 |
| `--from-pr <PR>` | PR 번호 또는 GitHub/GitLab/Bitbucket PR URL과 연결된 세션 재개 |

> **⚠ 02-HARNESS 운영 규칙**  
> Generator 호출 시 `--continue`, `--resume`, `--from-pr`은 사용하지 않습니다.  
> Analyst/Researcher 컨텍스트와 분리된 fresh 실행이 원칙입니다.  
> 자세한 규칙은 `docs/agents/generator.md`, `docs/operations/tool-permissions.md` 참조.

---

## 2. 주요 플래그 (Flags) — 카테고리별

### 2-1. 모델·성능 제어

| 플래그 | 인자 | 설명 |
|---|---|---|
| `--model <name>` | 모델 ID 또는 alias (`sonnet`, `opus`, 풀 ID 등) | 이 세션에서 사용할 모델 지정 |
| `--fallback-model <name>` | 모델 ID | 기본 모델 과부하 시 폴백 (Print 모드에서만) |
| `--effort <level>` | `low` / `medium` / `high` / `xhigh` / `max` | 사고/검토 노력 수준 |
| `--betas <names>` | 쉼표 구분 베타 헤더 | API 키 사용자 한정 |

### 2-2. 시스템 프롬프트

| 플래그 | 동작 |
|---|---|
| `--system-prompt "<text>"` | 기본 시스템 프롬프트를 통째로 **대체** |
| `--system-prompt-file <path>` | 파일 내용으로 시스템 프롬프트 **대체** |
| `--append-system-prompt "<text>"` | 기본 프롬프트 **뒤에 추가** |
| `--append-system-prompt-file <path>` | 파일 내용을 기본 프롬프트 **뒤에 추가** |

`--system-prompt`와 `--system-prompt-file`은 동시에 쓸 수 없습니다. `append`는 둘 중 어느 것과도 조합 가능합니다.

### 2-3. 권한·도구 제어 (가장 중요한 영역)

| 플래그 | 설명 |
|---|---|
| `--allowedTools <list>` | 권한 프롬프트 없이 자동 허용할 도구. [권한 규칙 문법](https://code.claude.com/docs/en/settings#permission-rule-syntax) 사용. 공백 또는 쉼표 구분 |
| `--disallowedTools <list>` | 모델 컨텍스트에서 제거하고 호출 금지 |
| `--tools <list>` | 사용 가능한 도구 화이트리스트. `""` (도구 비활성), `"default"` (전부), 또는 쉼표 구분 |
| `--permission-mode <mode>` | 시작 권한 모드. `default` / `acceptEdits` / `plan` / `auto` / `dontAsk` / `bypassPermissions` |
| `--dangerously-skip-permissions` | 모든 권한 프롬프트 스킵. `--permission-mode bypassPermissions`와 동일. **운영 금지** |
| `--allow-dangerously-skip-permissions` | `Shift+Tab` 모드 사이클에 `bypassPermissions`를 추가만 함 (시작은 안 함) |
| `--permission-prompt-tool <mcp-tool>` | 비대화형 모드에서 권한 프롬프트를 처리할 MCP 도구 지정 |

> **⚠ 02-HARNESS 운영 규칙**  
> `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`는 어떤 Tier에서도 사용 금지입니다.  
> Generator 호출 시 권장 모드는 `--permission-mode acceptEdits`이며, `--allowedTools`/`--disallowedTools`로 명시 화이트리스트를 구성합니다.

#### `--allowedTools` 예시

```bash
# 읽기 전용 + 특정 git 명령만 허용
claude -p "변경사항 요약" \
  --allowedTools "Read" "Bash(git diff *)" "Bash(git log *)"

# 편집·테스트 허용
claude -p "린트 오류 수정" \
  --allowedTools "Read" "Edit" "Bash(npm run lint)" "Bash(npm test)"
```

### 2-4. 세션 관리

| 플래그 | 설명 |
|---|---|
| `--continue`, `-c` | 가장 최근 세션 이어가기 |
| `--resume <id>`, `-r <id>` | 특정 세션 재개 (인자 없으면 대화형 선택기) |
| `--session-id <UUID>` | 명시적 UUID 사용 |
| `--fork-session` | 재개 시 원본 세션 ID 유지 |
| `--from-pr <PR>` | PR과 연결된 세션 재개 |
| `--name <text>`, `-n <text>` | 세션 표시 이름 지정 (`/resume` 목록·터미널 제목에 표시) |
| `--no-session-persistence` | 세션을 디스크에 저장하지 않음 (Print 모드 전용) |

### 2-5. 출력 형식·스트리밍

| 플래그 | 설명 |
|---|---|
| `--print`, `-p` | 비대화형 모드 (응답 후 종료) |
| `--output-format <fmt>` | `text` (기본) / `json` / `stream-json` |
| `--input-format <fmt>` | Print 모드 입력 형식. `text` (기본) / `stream-json` |
| `--json-schema "<schema>"` | 응답이 따라야 하는 JSON Schema (Print 모드에서 구조화 출력) |
| `--include-partial-messages` | 부분 스트리밍 이벤트 포함 (`stream-json` 필수) |
| `--include-hook-events` | 훅 라이프사이클 이벤트 포함 (`stream-json` 필수) |
| `--replay-user-messages` | stdin의 사용자 메시지를 stdout에 재발행 (`stream-json`) |
| `--verbose` | 상세 로그 및 턴별 전체 출력 표시 |

### 2-6. MCP·플러그인

| 플래그 | 설명 |
|---|---|
| `--mcp-config <path or json>` | JSON 파일/문자열에서 MCP 서버 로드 (공백 구분으로 다중 지정) |
| `--strict-mcp-config` | `--mcp-config`로 지정한 서버만 사용, 다른 MCP 설정 무시 |
| `--plugin-dir <path>` | 세션 전용 플러그인 디렉토리 로드. 반복 지정 가능 |
| `--disable-slash-commands` | 이 세션의 모든 skill·슬래시 커맨드 비활성화 |

### 2-7. Worktree·디렉토리

| 플래그 | 설명 |
|---|---|
| `--worktree [name]`, `-w [name]` | 격리된 git worktree에서 시작. 경로는 `.claude/worktrees/<name>` |
| `--tmux [classic]` | worktree용 터미널 분리 (기본: iTerm2 native, `classic`: 전통 tmux) |
| `--add-dir <path...>` | 추가 작업 디렉토리. 경로 존재 검증함 |

### 2-8. 설정·초기화

| 플래그 | 설명 |
|---|---|
| `--settings <path or json>` | 추가 설정 파일/문자열 로드 |
| `--setting-sources <list>` | 로드할 설정 소스 (`user,project,local` 기본) |
| `--bare` | 최소 모드. hooks·skills·plugins·MCP·자동 메모리·CLAUDE.md 자동 발견 모두 스킵 → 시작 빠름 |
| `--init` | 초기화 훅 실행 후 대화형 모드 시작 |
| `--init-only` | 초기화 훅만 실행하고 종료 |
| `--maintenance` | 유지보수 훅 실행 후 대화형 모드 |
| `--agent <name>` | 현재 세션의 에이전트 지정 (설정 오버라이드) |
| `--agents '<json>'` | JSON으로 커스텀 subagent 동적 정의 |

### 2-9. 디버깅·진단

| 플래그 | 설명 |
|---|---|
| `--debug [categories]` | 디버그 모드. 카테고리 필터 지원 (`api,hooks` 또는 `!statsig`) |
| `--debug-file <path>` | 디버그 로그를 특정 파일에 기록 (자동으로 디버그 모드 활성) |

### 2-10. 원격 제어·웹 세션

| 플래그 | 설명 |
|---|---|
| `--remote-control [name]`, `--rc [name]` | Remote Control 활성화로 대화형 세션 시작 |
| `--remote-control-session-name-prefix <prefix>` | 자동 생성 세션명 접두사 |
| `--remote "<task>"` | claude.ai에 웹 세션 생성 |
| `--teleport` | claude.ai 웹 세션을 로컬 터미널에서 재개 |

### 2-11. 그 외

| 플래그 | 설명 |
|---|---|
| `--ide` | IDE 자동 연결 (정확히 한 개의 IDE만 인식되어야 함) |
| `--chrome` / `--no-chrome` | Chrome 통합 활성/비활성 |
| `--exclude-dynamic-system-prompt-sections` | 동적 섹션(cwd·git status 등)을 첫 사용자 메시지로 이동 → 캐시 재사용률 ↑ |
| `--max-turns <N>` | Print 모드 에이전트 턴 수 제한 (초과 시 에러로 종료) |
| `--max-budget-usd <amount>` | Print 모드 비용 상한 |
| `--channels <list>` | Claude가 수신할 MCP 채널 (`plugin:<name>@<marketplace>` 공백 구분) |
| `--dangerously-load-development-channels <list>` | 미승인 개발 채널 로드 (확인 프롬프트). 운영 금지 |
| `--teammate-mode <mode>` | 에이전트 팀 표시 방식: `auto` / `in-process` / `tmux` |
| `--version`, `-v` | 버전 출력 |
| `--help`, `-h` | 도움말 |

---

## 3. 서브커맨드 (Subcommands)

### 3-1. 인증

```bash
claude auth login                       # 계정 로그인
claude auth login --email me@x.com      # 이메일 미리 입력
claude auth login --sso                 # SSO 강제
claude auth login --console             # Anthropic Console 계정 (API 청구)
claude auth logout                      # 로그아웃
claude auth status                      # 인증 상태 (JSON)
claude auth status --text               # 사람이 읽기 쉬운 형식
```

`auth status` 종료 코드: `0` = 로그인됨, `1` = 로그아웃 상태.

### 3-2. MCP 서버

```bash
claude mcp list                                          # 설치된 MCP 서버 목록
claude mcp get <name>                                    # 특정 서버 정보
claude mcp add --transport http <name> <url>             # HTTP 전송
claude mcp add --transport sse  <name> <url>             # Server-Sent Events
claude mcp add --transport stdio <name> -- <cmd> [args]  # 표준입출력 프로세스
claude mcp add --transport stdio --env KEY=VAL <name> -- <cmd>
claude mcp add-json <name> '<json>'                      # JSON으로 추가 (OAuth 지원)
claude mcp add-from-claude-desktop                       # Claude Desktop에서 가져오기
claude mcp remove <name>                                 # 제거
claude mcp reset-project-choices                         # 프로젝트 스코프 승인 재설정
claude mcp serve                                         # 테스트용 MCP 서버 실행
```

`--scope`: `user` (기본, `~/.claude.json`) / `local` (이 머신만) / `project` (`.mcp.json`).

### 3-3. 플러그인

```bash
claude plugin install <name>@<marketplace>
claude plugin list           # (alias: claude plugins)
claude plugin remove <name>
claude plugin search <keyword>
claude plugin info <name>
claude plugin upgrade <name>
```

### 3-4. 업데이트·설치

```bash
claude update              # 최신 버전 업데이트
claude install stable      # stable 채널
claude install latest      # latest 채널
claude install 2.1.118     # 특정 버전
```

### 3-5. 설정·진단

```bash
claude config              # 설정 인터페이스 (대화형)
claude setup-token         # CI/스크립트용 장기 OAuth 토큰 발급
claude doctor              # 설치·설정 진단
claude auto-mode defaults > rules.json
claude auto-mode config
```

### 3-6. Remote Control 서버 모드

```bash
claude remote-control
claude remote-control --name "My Project"
claude remote-control --verbose
claude remote-control --spawn same-dir   # 디렉토리 공유 (기본)
claude remote-control --spawn worktree   # 세션마다 worktree (git 필수)
claude remote-control --spawn session    # 단일 세션
claude remote-control --capacity 50      # 최대 동시 세션
claude remote-control --sandbox          # 샌드박싱 활성화
claude remote-control --no-sandbox       # 샌드박싱 비활성화
```

---

## 4. 환경 변수 (Environment Variables)

> 02-HARNESS 보안 규칙에 따라 **값을 컨텍스트·로그·문서에 직접 포함하지 말고 변수 이름만 참조**합니다.

### 4-1. 인증·API

| 변수 | 설명 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API 키 |
| `ANTHROPIC_AUTH_TOKEN` | 커스텀 Authorization 헤더 값 |
| `ANTHROPIC_BASE_URL` | API 엔드포인트 오버라이드 (프록시·게이트웨이) |
| `ANTHROPIC_BETAS` | 쉼표 구분 베타 헤더 |
| `ANTHROPIC_CUSTOM_HEADERS` | API 요청 커스텀 헤더 (JSON) |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude.ai OAuth 액세스 토큰 |
| `CLAUDE_CODE_OAUTH_REFRESH_TOKEN` | OAuth 리프레시 토큰 |
| `CLAUDE_CODE_OAUTH_SCOPES` | OAuth 스코프 |

### 4-2. 모델

| 변수 | 설명 |
|---|---|
| `ANTHROPIC_MODEL` | 기본 모델 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | 기본 Sonnet 모델 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | 기본 Opus 모델 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | 기본 Haiku 모델 |
| `CLAUDE_CODE_EFFORT_LEVEL` | `low` / `medium` / `high` / `xhigh` / `max` / `auto` |
| `ANTHROPIC_CUSTOM_MODEL_OPTION` | 커스텀 모델 ID |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_NAME` | 커스텀 모델 표시 이름 |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION` | 커스텀 모델 설명 |

### 4-3. 클라우드 공급자

| 변수 | 설명 |
|---|---|
| `CLAUDE_CODE_USE_BEDROCK` | AWS Bedrock 모드 활성화 |
| `ANTHROPIC_BEDROCK_BASE_URL` | Bedrock 엔드포인트 오버라이드 |
| `ANTHROPIC_BEDROCK_MANTLE_BASE_URL` | Bedrock Mantle 엔드포인트 |
| `AWS_BEARER_TOKEN_BEDROCK` | Bedrock API 키 |
| `CLAUDE_CODE_SKIP_BEDROCK_AUTH` | AWS 인증 스킵 |
| `CLAUDE_CODE_USE_VERTEX` | Google Vertex AI 모드 활성화 |
| `ANTHROPIC_VERTEX_BASE_URL` | Vertex 엔드포인트 |
| `ANTHROPIC_VERTEX_PROJECT_ID` | GCP 프로젝트 ID |
| `CLAUDE_CODE_SKIP_VERTEX_AUTH` | Google 인증 스킵 |
| `CLAUDE_CODE_USE_FOUNDRY` | Microsoft Foundry 모드 |
| `ANTHROPIC_FOUNDRY_API_KEY` | Foundry API 키 |
| `ANTHROPIC_FOUNDRY_BASE_URL` | Foundry 리소스 기본 URL |
| `ANTHROPIC_FOUNDRY_RESOURCE` | Foundry 리소스명 |
| `CLAUDE_CODE_SKIP_FOUNDRY_AUTH` | Azure 인증 스킵 |

### 4-4. 디버깅·로깅

| 변수 | 설명 |
|---|---|
| `CLAUDE_CODE_DEBUG_LOGS_DIR` | 디버그 로그 경로 오버라이드 |
| `CLAUDE_CODE_DEBUG_LOG_LEVEL` | `verbose` / `debug` / `info` / `warn` / `error` |
| `CLAUDECODE` | Claude Code가 띄운 셸에서 `1`로 자동 설정 (읽기 전용) |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | OpenTelemetry 데이터 수집 활성화 |

### 4-5. 성능·리소스 (기본값 참고)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `API_TIMEOUT_MS` | 600000 (10분) | API 요청 타임아웃 |
| `BASH_DEFAULT_TIMEOUT_MS` | 120000 (2분) | Bash 명령 기본 타임아웃 |
| `BASH_MAX_TIMEOUT_MS` | 600000 (10분) | Bash 최대 타임아웃 |
| `BASH_MAX_OUTPUT_LENGTH` | (확인 불가) | Bash 출력 최대 문자 수 |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | (모델 의존) | 최대 출력 토큰 |
| `CLAUDE_CODE_MAX_RETRIES` | 10 | 실패 요청 재시도 횟수 |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | 10 | 병렬 도구 실행 제한 |
| `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` | (확인 불가) | 파일 읽기 토큰 제한 |

### 4-6. 기능 토글 (Disable 계열)

| 변수 | 설명 |
|---|---|
| `CLAUDE_CODE_DISABLE_ATTACHMENTS` | 파일 첨부 비활성 |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | 자동 메모리 비활성 |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | 백그라운드 작업 비활성 |
| `CLAUDE_CODE_DISABLE_CRON` | 예약 작업 비활성 |
| `CLAUDE_CODE_DISABLE_FAST_MODE` | Fast 모드 비활성 |
| `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING` | 파일 체크포인팅 비활성 |
| `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` | 내장 git 지침 제거 |
| `CLAUDE_CODE_DISABLE_THINKING` | 확장 사고 비활성 |
| `CLAUDE_CODE_DISABLE_1M_CONTEXT` | 1M 컨텍스트 윈도우 비활성 |
| `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` | 적응형 추론 비활성 |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | CLAUDE.md 로딩 차단 |
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` | `anthropic-beta` 헤더 제거 |
| `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK` | 비스트리밍 폴백 비활성 |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` | 터미널 제목 자동 변경 비활성 |
| `CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL` | 가상 스크롤 비활성 |
| `CLAUDE_CODE_DISABLE_MOUSE` | 마우스 추적 비활성 |
| `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` | 세션 피드백 설문 비활성 |
| `CLAUDE_CODE_SIMPLE` | 최소 시스템 프롬프트 + 기본 도구만 |
| `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` | 도구 유지, 프롬프트만 최소화 |

### 4-7. 셸·실행

| 변수 | 설명 |
|---|---|
| `CLAUDE_CODE_SHELL` | 자동 셸 감지 오버라이드 |
| `CLAUDE_CODE_SHELL_PREFIX` | 모든 bash 명령에 접두사 추가 |
| `CLAUDE_CODE_USE_POWERSHELL_TOOL` | PowerShell 도구 활성/비활성 |
| `CLAUDE_CODE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | 명령 후 원래 디렉토리로 복귀 |
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` | 서브프로세스 환경에서 자격증명 제거 |
| `CLAUDE_CODE_GIT_BASH_PATH` | Windows: Git Bash 실행 파일 경로 |

### 4-8. 파일·디렉토리

| 변수 | 설명 |
|---|---|
| `CLAUDE_CONFIG_DIR` | 구성 디렉토리 (기본 `~/.claude`) |
| `CLAUDE_CODE_TMPDIR` | 임시 디렉토리 |
| `CLAUDE_CODE_PLUGIN_CACHE_DIR` | 플러그인 루트 |
| `CLAUDE_CODE_PLUGIN_SEED_DIR` | 미리 채워진 플러그인 디렉토리 |
| `CLAUDE_CODE_GLOB_HIDDEN` | Glob 결과에 숨김 파일 포함 (기본 true) |
| `CLAUDE_CODE_GLOB_NO_IGNORE` | `.gitignore` 무시 여부 (기본 false) |
| `CLAUDE_CODE_GLOB_TIMEOUT_SECONDS` | Glob 타임아웃 (20–60초) |

### 4-9. 세션·컨텍스트

| 변수 | 설명 |
|---|---|
| `CLAUDE_CODE_SKIP_PROMPT_HISTORY` | 세션 트랜스크립트 작성 스킵 |
| `CLAUDE_CODE_RESUME_INTERRUPTED_TURN` | 중단된 턴 자동 재개 |
| `CLAUDE_CODE_EXIT_AFTER_STOP_DELAY` | 자동 종료 지연 (ms) |
| `CLAUDE_CODE_ENABLE_AWAY_SUMMARY` | 세션 요약 가용성 오버라이드 |
| `CLAUDE_CODE_TASK_LIST_ID` | 세션 간 작업 목록 공유 (이름) |
| `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` | SessionEnd 훅 시간 예산 |
| `CLAUDE_CODE_ENABLE_TASKS` | 비대화형 모드에서 작업 추적 활성화 |
| `CLAUDE_CODE_AUTOCOMPACT_PCT_OVERRIDE` | 자동 압축 트리거 % (1–100) |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | 자동 압축 계산용 컨텍스트 용량 |

### 4-10. 원격·운영

| 변수 | 설명 |
|---|---|
| `CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX` | Remote Control 세션명 접두사 (기본: hostname) |
| `CLAUDE_CODE_REMOTE` | 클라우드 세션에서 자동 설정 (읽기 전용) |
| `CLAUDE_CODE_REMOTE_SESSION_ID` | 클라우드 세션 ID 자동 설정 (읽기 전용) |
| `CCR_FORCE_BUNDLE` | `--remote` 사용 시 로컬 레포 강제 번들 |

### 4-11. 그 외 고급

| 변수 | 설명 |
|---|---|
| `DISABLE_TELEMETRY` | 모든 텔레메트리 비활성 |
| `DISABLE_AUTOUPDATER` | 자동 업데이트 비활성 |
| `DISABLE_ERROR_REPORTING` | 에러 보고 비활성 |
| `DISABLE_FEEDBACK_COMMAND` | 피드백 커맨드 비활성 |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | 위 4가지 통합 비활성 |
| `CLAUDE_CODE_FORK_SUBAGENT` | 포크된 subagent 활성 |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | 에이전트 팀 활성 (실험) |
| `CLAUDE_CODE_TEAM_NAME` | 에이전트 팀명 |
| `CLAUDE_CODE_AUTO_BACKGROUND_TASKS` | 자동 배경 작업 강제 활성 |
| `CLAUDE_CODE_AUTO_CONNECT_IDE` | IDE 자동 연결 오버라이드 |
| `CLAUDE_CODE_IDE_HOST_OVERRIDE` | IDE 연결 주소 오버라이드 |
| `CLAUDE_CODE_ACCESSIBILITY` | 네이티브 터미널 커서 표시 유지 |
| `CLAUDE_CODE_HIDE_CWD` | 시작 로고에서 작업 디렉토리 숨김 |

---

## 5. 슬래시 커맨드 (Slash Commands) — 자주 쓰는 것 위주

대화형 세션 안에서 `/`로 시작하는 명령. 일부는 내장, 일부는 skill입니다. 전체 목록은 `/help` 참고.

### 5-1. 세션·대화 제어

| 명령 | 동작 |
|---|---|
| `/clear` (alias: `/reset`, `/new`) | 새 대화 시작 |
| `/exit` (alias: `/quit`) | CLI 종료 |
| `/resume [session]` (alias: `/continue`) | 세션 재개 또는 선택기 |
| `/branch [name]` (alias: `/fork`) | 현재 지점에서 대화 분기 |
| `/rename [name]` | 세션 이름 변경 |
| `/rewind` (alias: `/checkpoint`, `/undo`) | 이전 지점으로 되감기 |
| `/copy [N]` | 마지막(또는 N번째) 응답을 클립보드에 복사 |

### 5-2. 모델·성능

| 명령 | 동작 |
|---|---|
| `/model [name]` | 모델 선택·변경 |
| `/effort [level]` | 노력 수준 변경 (`low`–`max`, `auto`) |
| `/fast [on\|off]` | Fast 모드 토글 |

### 5-3. 권한·설정·상태

| 명령 | 동작 |
|---|---|
| `/permissions` (alias: `/allowed-tools`) | 권한 규칙 관리 |
| `/config` (alias: `/settings`) | 설정 인터페이스 (테마·모델·출력 스타일) |
| `/status` | 버전·모델·계정·연결 상태 |

### 5-4. 컨텍스트·메모리

| 명령 | 동작 |
|---|---|
| `/compact [instructions]` | 대화 요약으로 컨텍스트 확보 |
| `/context` | 컨텍스트 사용량 색상 그리드 |
| `/memory` | CLAUDE.md 메모리 편집 |
| `/add-dir <path>` | 작업 디렉토리 추가 |

### 5-5. 디버깅·진단

| 명령 | 동작 |
|---|---|
| `/debug [description]` | (Skill) 디버그 로깅 활성 + 문제 해결 |
| `/doctor` | 설치·설정 진단 |
| `/hooks` | 훅 설정 조회 |

### 5-6. 코드 리뷰·분석

| 명령 | 동작 |
|---|---|
| `/review [PR]` | PR 로컬 리뷰 |
| `/simplify [focus]` | (Skill) 최근 변경 코드 검토·개선 |
| `/security-review` | 현재 브랜치 보안 취약점 분석 |
| `/diff` | 미커밋 변경 + 턴별 diff 뷰어 |
| `/ultraplan <prompt>` | 클라우드 계획 세션 |
| `/ultrareview [PR]` | 클라우드 다중 에이전트 코드 리뷰 |

### 5-7. 자동화·스케줄링

| 명령 | 동작 |
|---|---|
| `/batch <instruction>` | (Skill) 대규모 변경 병렬 실행 (worktree + PR) |
| `/loop [interval] [prompt]` (alias: `/proactive`) | (Skill) 프롬프트 반복 실행 |
| `/schedule [description]` (alias: `/routines`) | (Skill) 루틴 생성·관리 |
| `/autofix-pr [prompt]` | (Skill) 현재 PR 감시 + CI 실패 자동 수정 |

### 5-8. 웹·원격

| 명령 | 동작 |
|---|---|
| `/remote-control [name]` (alias: `/rc`) | 이 세션을 claude.ai에서 원격 제어 가능하게 |
| `/teleport` (alias: `/tp`) | 웹 세션을 터미널로 가져오기 |

### 5-9. 플러그인·MCP

| 명령 | 동작 |
|---|---|
| `/plugin` | 플러그인 관리 |
| `/reload-plugins` | 활성 플러그인 다시 로드 |
| `/mcp` | MCP 서버 연결 + OAuth 인증 |

### 5-10. 보고·생성·기타

| 명령 | 동작 |
|---|---|
| `/insights` | 지난 세션 분석 보고서 생성 |
| `/team-onboarding` | 팀 온보딩 가이드 생성 |
| `/claude-api [migrate\|managed-agents-onboard]` | (Skill) Claude API 레퍼런스 로드·마이그레이션 |
| `/fewer-permission-prompts` | (Skill) 트랜스크립트 스캔 → 권한 프롬프트 감소 |
| `/init` | CLAUDE.md 프로젝트 가이드 초기화 |
| `/recap` | 현재 세션 요약 |
| `/usage` (alias: `/cost`, `/stats`) | 세션 비용·계획 한도·통계 |
| `/help` | 도움말 + 사용 가능한 명령 |

---

## 6. Headless / 비대화형 모드 (자동화·스크립트)

### 6-1. 기본 패턴

```bash
# 단순 쿼리
claude -p "이 함수의 동작을 요약해줘" > response.txt

# JSON 출력
claude -p "프로젝트 요약" --output-format json | jq '.result'

# 구조화 출력 (JSON Schema 강제)
claude -p "함수 이름 추출" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}' \
  | jq '.structured_output'

# 실시간 토큰 스트리밍
claude -p "시 한 편 써줘" \
  --output-format stream-json --verbose --include-partial-messages \
  | jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

### 6-2. stdin 파이프

```bash
cat large.json | claude -p "이 JSON을 파싱·요약해줘"
npm test 2>&1 | claude -p "테스트 실패 분석"
git diff HEAD~1 | claude -p "이 변경을 코드 품질 관점에서 검토"
```

### 6-3. 세션 이어가기

```bash
# 가장 최근 세션 이어가기
claude -p "타입 오류 점검" --continue

# 특정 세션 재개
session_id=$(claude -p "리뷰 시작" --output-format json | jq -r '.session_id')
claude -p "보안 관점 추가 검토" --resume "$session_id"
```

### 6-4. 도구 사전 승인

```bash
# 명시적 화이트리스트
claude -p "테스트 실행 후 실패 수정" \
  --allowedTools "Bash(npm test),Bash(npm run fix),Read,Edit"

# 권한 모드로 일괄 처리
claude -p "린트 자동 적용" --permission-mode acceptEdits
```

### 6-5. Bare 모드 (CI·스크립트)

```bash
# 훅·플러그인·MCP 스킵 → 빠른 시작
claude --bare -p "이 파일 요약" --allowedTools "Read"

# 환경변수로 인증
export ANTHROPIC_API_KEY=sk-ant-...
claude --bare -p "코드 설명" --allowedTools "Read"
```

### 6-6. 종료 코드·에러 처리

| 상황 | exit code |
|---|---|
| 성공 | 0 |
| 실패·에러 | 비-0 |
| `--max-turns` 초과 | 비-0 (에러로 종료) |

```bash
if ! claude -p "task" --max-turns 5; then
  echo "실패 또는 턴 초과"
  exit 1
fi

timeout 30 claude -p "query" || echo "타임아웃 또는 에러"
```

### 6-7. 출력 파싱 (jq)

```bash
# session_id 추출
session_id=$(claude -p "query" --output-format json | jq -r '.session_id')

# 사용량 통계
claude -p "query" --output-format json | jq '.usage'

# 구조화 결과 추출
claude -p "이름 추출" --output-format json --json-schema '...' \
  | jq '.structured_output.names[]'
```

---

## 7. 02-HARNESS 운영 시 권장 호출 패턴

### 7-1. Generator 호출 (격리 실행)

`docs/agents/generator.md`, `docs/operations/tool-permissions.md`에 정의된 계약을 그대로 옮겨 적습니다.

```bash
# bash (권장)
cat tasks/handoffs/TASK-{ID}/generator-input.md | \
  claude --bare --print \
         --input-format text \
         --output-format json \
         --no-session-persistence \
         --permission-mode acceptEdits
```

```powershell
# PowerShell
Get-Content -Raw -Encoding UTF8 tasks/handoffs/TASK-{ID}/generator-input.md | `
  claude --bare --print `
         --input-format text `
         --output-format json `
         --no-session-persistence `
         --permission-mode acceptEdits
```

**금지 플래그 (운영 규칙):**

```
--continue
--resume
--from-pr
--dangerously-skip-permissions
--allow-dangerously-skip-permissions
```

### 7-2. Researcher 단발 조사 (외부 사실 확인)

```bash
claude -p "<research question>" \
       --output-format json \
       --no-session-persistence \
       --allowedTools "WebSearch,WebFetch,Read"
```

결과는 Analyst가 받아 `summary / snippets / confidence / unverified_claims` 4가지로 정리해 Generator에게 전달.

### 7-3. Validator 호출

권위 문서: `docs/agents/validator.md`. 본 가이드는 호출 옵션만 안내.

```bash
# Codex CLI 또는 Gemini CLI는 자체 명령이 별도지만,
# Claude 기반 보조 검증을 돌릴 때:
claude -p "task validation per spec" \
       --output-format json \
       --no-session-persistence \
       --allowedTools "Read,Bash(npm run audit:harness)"
```

### 7-4. 빠른 단발 점검

```bash
# 본 프로젝트 audit 결과를 빠르게 요약
npm run audit:harness 2>&1 | claude -p "감사 결과를 5줄로 요약" --bare --allowedTools "Read"
```

---

## 8. 자주 쓰는 디버깅 레시피

| 증상 | 권장 명령 |
|---|---|
| 설치·인증 문제 의심 | `claude doctor` |
| 권한 프롬프트 과다 | `claude /permissions` 또는 settings에서 allow rule 추가 |
| API 응답 이상 | `claude --debug "api" -p "..."` 또는 `--debug-file <path>` |
| MCP 서버 연결 실패 | `claude mcp list` → `claude mcp get <name>` → `--debug "mcp"` |
| 컨텍스트 부족 | `/context`로 사용량 확인 → `/compact` |

---

## 9. 참고 출처 (공식 문서)

- [CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [Environment Variables](https://code.claude.com/docs/en/env-vars)
- [Settings](https://code.claude.com/docs/en/settings)
- [Headless / Agent SDK](https://code.claude.com/docs/en/headless)
- [Interactive Mode](https://code.claude.com/docs/en/interactive-mode)
- [Slash Commands](https://code.claude.com/docs/en/commands)
- [MCP Integration](https://code.claude.com/docs/en/mcp)
- [Remote Control](https://code.claude.com/docs/en/remote-control)
- [Plugins Reference](https://code.claude.com/docs/en/plugins-reference)

---

## 10. 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| 1.0 | 2026-04-28 | 최초 작성 (TASK-20260428-001) |
