# Tool Permissions — 도구 권한 정책

**버전:** 1.7 | **최종 수정:** 2026-04-26  
**원칙:** 각 에이전트는 해당 작업에 필요한 최소 권한만 보유한다.

---

## 에이전트별 도구 권한 매트릭스

| 도구 | Analyst | Researcher | Generator | Validator-A | Validator-B |
|---|:---:|:---:|:---:|:---:|:---:|
| **파일 읽기** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **파일 쓰기** | ✅ (운영 기록 + 승인된 가이드 문서 한정) | ❌ | ✅ (task/* 한정) | ❌ | ❌ |
| **파일 삭제** | ❌ | ❌ | ✅ (task/* 한정) | ❌ | ❌ |
| **Shell 실행** | ✅ (감사·기록 전용 제한 명령) | ❌ | ✅ (Sandbox) | ✅ (Sandbox) | ✅ (Sandbox) |
| **웹 검색** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **외부 URL 접근** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Git 읽기** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Git 쓰기 (task/*)** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Git 머지 (main)** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **MCP 도구** | ✅ (제한) | ✅ | ✅ (제한) | ✅ (제한) | ✅ (제한) |
| **알림 Webhook 전송** | ✅ (Slack 한정) | ❌ | ❌ | ❌ | ❌ |
| **테스트 실행** | ❌ | ❌ | ✅ (로컬) | ✅ (Sandbox) | ✅ (Sandbox) |
| **정적 분석 도구** | ❌ | ❌ | ✅ (자체 검토) | ✅ | ✅ |
| **환경 변수 접근** | ❌ | ❌ | ✅ (키 이름 참조만) | ✅ (키 이름 참조만) | ✅ (키 이름 참조만) |

---

## Analyst 제한 Shell 권한

Analyst는 구현·테스트 실행자가 아니지만, 원장 생성과 재진입 무결성 확인을 위해 제한된 Shell 읽기 권한을 가진다.

허용:

```
Get-Content, Get-ChildItem, Select-String, rg, git status, git log, git show,
날짜 확인 명령, 파일 존재 확인, logs/reports/CURRENT_STATE.md 기록에 필요한 최소 명령
```

금지:

```
빌드/테스트 실행, 애플리케이션 실행, 외부 API 호출, 의존성 설치,
시스템 설정 변경, main 머지, task/* 외 파일 생성 작업 대행
```

예외:

- `scripts/notify-slack.mjs` 실행은 알림 정책에 정의된 이벤트 전송에 한해 허용한다.
- 배포 여부 확인처럼 사용자가 직접 요청한 운영 사실 확인은 읽기성 네트워크 확인으로 간주하되, 민감 정보가 출력되면 마스킹한다.

## Analyst 파일 쓰기 범위

Analyst의 쓰기 권한은 운영 조정과 하네스 규칙 관리에 한정한다. 제품 코드, 앱 기능, 배포 설정을 직접 구현하는 권한이 아니다.

항상 허용:

```text
logs/**
reports/**
CURRENT_STATE.md
```

가이드 유지보수 Task에서만 허용:

```text
AGENTS.md
ARCHITECTURE.md
SECURITY.md
QUALITY_SCORE.md
docs/agents/**
docs/workflows/**
docs/operations/**
docs/schemas/**
reports/TASK-EXAMPLE.md
scripts/check-*.mjs
scripts/validate-*.mjs
scripts/notify-*.mjs
scripts/audit-*.mjs
package.json
```

조건:

1. 해당 작업의 `TASK_CREATED`가 먼저 기록되어야 한다.
2. 변경 목적이 하네스 운영 규칙, 출력 형식, 검증 게이트, 자동 감사 스크립트 개선이어야 한다.
3. 변경 파일과 검증 결과를 같은 Task 원장에 기록해야 한다.
4. 제품 코드(`api/**`, `public/**`, `assets/**`, `wrangler.toml` 등)는 Generator 작업으로 분리한다.

금지:

```text
제품 기능 구현 대행
배포 설정 변경
시크릿 또는 환경변수 값 수정
main 머지 또는 원격 저장소 변경
```

## Sandbox 실행 원칙

Generator와 Validator 모두 코드 실행은 반드시 **격리된 Sandbox 환경**에서 수행한다.

```
Generator:   Claude Code CLI 격리 실행 환경 (Sandbox에 준하는 격리 환경 — task/* 브랜치 외 파일 시스템·네트워크 접근 차단)
Validator-A: Codex Sandbox (클라우드 격리 환경)
Validator-B: Gemini Sandbox (클라우드 격리 환경)
```

Sandbox에서 금지되는 작업:
- 외부 네트워크 요청 (API 키 탈취 방지)
- 영구 파일 시스템 변경 (task/* 브랜치 외)
- 시스템 설정 변경
- 다른 프로세스 실행 또는 종료

---

## MCP 서버 사용 기준

```
허용 목록 (Analyst가 관리):
  - 공식 검증된 MCP 서버
  - 버전이 고정된 서버 (버전 명시 필수)

금지:
  - 출처 불명 MCP 서버
  - 최근 변경이 있으나 검토되지 않은 서버
  - 도구 설명이 비정상적으로 긴 서버 (Prompt Injection 의심)

신규 추가 절차:
  1. Analyst의 명시적 승인 필요
  2. 버전 고정 후 변경 알림 설정
  3. 첫 사용 시 Sandbox 격리 환경에서 테스트
```

---

## 권한 위반 처리

에이전트가 허용되지 않은 도구를 사용하려 할 경우:

1. 즉시 작업 중단
2. Analyst에게 시도 내용과 이유 보고
3. Analyst가 권한 확장 여부를 판단 (사용자 승인 필요 시 질의)
4. 승인 없이 재시도 금지

---

## Auto Mode 분류기 (승인 피로 방지)

반복적인 수동 승인은 **승인 피로**를 유발하여 보안을 약화시킨다.  
아래 기준으로 자동 승인 범위를 설정하고, 위험 작업만 수동 승인한다.

| 분류 | 자동 처리 | 수동 승인 필요 |
|---|---|---|
| **Safe** | 파일 읽기, 정적 분석, 테스트 실행 (Sandbox) | — |
| **Standard** | 파일 쓰기 (Generator: task/*, Analyst: 운영 기록/승인된 가이드 문서), Git 커밋 | — |
| **Elevated** | — | Shell 명령어 (비표준), 외부 API 호출 |
| **Critical** | — | main 머지, 환경 설정 변경, MCP 신규 추가 |

Slack 알림 Webhook 전송은 `docs/operations/notification-policy.md`에 정의된 이벤트만 허용한다. Webhook URL 원문은 출력·로그·보고서에 포함하지 않는다.

**Shell 실행과의 관계:** Analyst의 Shell 실행은 위 "감사·기록 전용 제한 명령"에 한한다. `scripts/notify-slack.mjs` 실행은 "알림 Webhook 전송" 권한에 포함된 승인된 예외다.

---

## 환경 변수 접근 규칙

```
참조 허용: Generator, Validator — 코드 내에서 환경 변수 키 이름을 참조하는 것만 허용
           (실제 값을 조회하여 AI 컨텍스트·작업 이력·출력에 포함하는 것은 금지)
쓰기 금지: 모든 에이전트
로깅 금지: 환경 변수 값을 작업 이력·보고서·에이전트 통신에 기록하지 않는다
코드 포함 금지: 환경 변수 키만 코드에 포함, 실제 값은 포함하지 않는다

올바른 예: process.env.STRIPE_SECRET_KEY   ← 키 이름 참조
잘못된 예: const key = "sk_live_abc123..."  ← 실제 값 하드코딩
잘못된 예: log("API key = " + process.env.STRIPE_SECRET_KEY)  ← 값이 컨텍스트에 유입
```
