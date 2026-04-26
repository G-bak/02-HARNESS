# MCP 서버 설정 가이드

**버전:** 1.0 | **최종 수정:** 2026-04-26  
**목적:** Claude Code에 Cloudflare MCP 서버를 전역 설정으로 등록  
**대상:** Windows 환경, Claude 데스크톱 앱 / Claude Code CLI

---

## 개요

이 프로젝트는 Cloudflare 리소스 조회·관리를 위해 아래 세 MCP 서버를 사용한다.

| 서버 | 용도 |
|---|---|
| `cloudflare-bindings` | D1, KV, R2, Workers 바인딩 관리 |
| `cloudflare-docs` | Cloudflare 공식 문서 검색 |
| `cloudflare-observability` | Workers 로그 및 관측 |

---

## 설정 방법

### 방법 A — 설정 파일 직접 수정 (권장)

1. `Win + R` → `%AppData%\Claude` 입력 후 엔터
2. `claude_desktop_config.json` 파일을 편집기로 열기 (없으면 새로 생성)
3. 아래 내용으로 저장

```json
{
  "mcpServers": {
    "cloudflare-bindings": {
      "command": "cmd",
      "args": ["/c", "npx", "mcp-remote@0.1.16", "https://bindings.mcp.cloudflare.com/mcp"]
    },
    "cloudflare-docs": {
      "command": "cmd",
      "args": ["/c", "npx", "mcp-remote@0.1.16", "https://docs.mcp.cloudflare.com/mcp"]
    },
    "cloudflare-observability": {
      "command": "cmd",
      "args": ["/c", "npx", "mcp-remote@0.1.16", "https://observability.mcp.cloudflare.com/mcp"]
    }
  }
}
```

4. Claude 앱 완전 종료 (시스템 트레이 아이콘 → Quit) 후 재시작

---

### 방법 B — CLI로 등록

Claude Code CLI가 설치된 환경에서 아래 명령어를 사용자 홈 디렉토리(`%USERPROFILE%`)에서 실행한다.

```powershell
cd $env:USERPROFILE
claude mcp add cloudflare-bindings -- cmd /c npx mcp-remote@0.1.16 https://bindings.mcp.cloudflare.com/mcp
claude mcp add cloudflare-docs     -- cmd /c npx mcp-remote@0.1.16 https://docs.mcp.cloudflare.com/mcp
claude mcp add cloudflare-observability -- cmd /c npx mcp-remote@0.1.16 https://observability.mcp.cloudflare.com/mcp
```

> `--global` 옵션은 일부 CLI 버전에서 지원하지 않는다. 사용자 홈에서 실행하면 전역 설정과 동일한 효과를 얻는다.

---

## 보안 주의사항

`docs/operations/tool-permissions.md` MCP 정책에 따라 아래 사항을 준수한다.

| 항목 | 기준 |
|---|---|
| 버전 고정 | 위 예시의 `mcp-remote@0.1.16`은 작성 시점 기준이다. 적용 전 [npm](https://www.npmjs.com/package/mcp-remote) 에서 최신 안정 버전을 확인하고 버전을 고정한다. `@latest`는 사용하지 않는다. |
| 변경 모니터링 | Cloudflare MCP 서버 업데이트 시 Analyst 검토 후 적용 |
| 신규 서버 추가 | Analyst 명시적 승인 필요 |
| 출처 불명 서버 | 추가 금지 |

---

## 확인 방법

Claude 재시작 후 채팅에서 아래를 입력해 MCP 도구 목록이 표시되면 정상이다.

```
사용 가능한 MCP 도구 목록을 보여줘
```
