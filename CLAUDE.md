# CLAUDE.md

이 파일은 **Claude Code 전용** 설정 파일입니다.  
에이전트 역할·규칙·Tier 분류·절대 금지 등 모든 운영 규칙의 원본은 **AGENTS.md**에 있습니다.  
세션 시작 시 반드시 AGENTS.md를 먼저 읽으세요.

---

## 필수 선행 문서

| 문서 | 내용 | 읽는 시점 |
|---|---|---|
| `AGENTS.md` | 에이전트 구조, 절대 규칙, Tier 분류, 작업 흐름 전체 | **세션 시작 즉시** |
| `CURRENT_STATE.md` | 활성 Task, 남은 작업, 확정 규칙 | 세션 재진입 시 |

---

## 파일 구조

```
02_HARNESS/
├── AGENTS.md                    — 전체 에이전트 구조 + 절대 규칙 (권위 문서)
├── ARCHITECTURE.md              — 시스템 아키텍처 + 작업 흐름 요약
├── SECURITY.md                  — 보안 체크리스트 + 접근 제어
├── QUALITY_SCORE.md             — 품질 채점 루브릭
├── CURRENT_STATE.md             — 세션 재진입 문서 (Analyst 유지·갱신)
│
├── docs/
│   ├── agents/                  — 에이전트별 역할 명세
│   ├── workflows/               — 작업 흐름 규칙
│   │   └── task-lifecycle.md    — Task 수명 주기 (권위)
│   ├── operations/              — 운영 정책
│   │   └── git-branch-policy.md — 머지 조건·승인 주체 (권위)
│   ├── schemas/                 — 에이전트 간 통신 형식
│   ├── guides/                  — 도구 사용법 (참고 문서)
│   └── plans/                   — 부속 프로젝트 기획서
│
├── scripts/                     — 운영 자동화 스크립트
├── logs/
│   ├── tasks/                   — TASK-{ID}.jsonl (append-only 이벤트 원장)
│   ├── sessions/                — SESSION-{YYYYMMDD}-{NNN}.md (세션 요약)
│   └── insights.jsonl           — 누적 인사이트 원장
└── reports/                     — Task 최종 보고서 (Tier 2/3)
```

---

## 세션 재진입

```
/clear 후 → "CURRENT_STATE.md를 읽고 이어서 진행해줘."
```

---

## 부속 프로젝트 (LandingHub)

하네스와 별개로 이 저장소에서 함께 관리되는 프로젝트입니다.

| 파일 | 설명 |
|---|---|
| `public/showcase.html` | 랜딩페이지 쇼케이스 (Tailwind CDN) |
| `public/admin.html` | 관리자 페이지 — 구독자·뉴스레터·발송 이력 관리 |
| `api/worker.js` | Cloudflare Worker — D1 + Resend API |

상세 기획: `docs/plans/showcase-plan.md`, `docs/plans/newsletter-admin-plan.md`

---

## Claude Code 전용 — Thinking 모드

상세: `docs/guides/thinking-mode.md`

```
think step by step
analyze deeply
reason carefully before answering
consider edge cases
```
