# CLAUDE.md

이 파일은 **Claude Code 전용** 설정 파일입니다.  
에이전트 역할·규칙·Tier 분류·절대 금지 등 모든 운영 규칙의 원본은 **AGENTS.md**에 있습니다.  
세션 시작 시 반드시 AGENTS.md를 먼저 읽으세요.

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
