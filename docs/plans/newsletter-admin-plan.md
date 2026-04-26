# LandingHub — 뉴스레터 구독 + 관리자 페이지 기획서

> **상태:** 구현 완료  
> **관련 파일:** `showcase.html`, `api/worker.js`, `wrangler.toml`, `admin.html`

---

## 0. 관리자 접속 정보

| 항목 | 값 |
|------|----|
| **관리자 URL** | `http://localhost:8080/admin.html` (로컬) |
| **비밀번호** | `.dev.vars`의 `ADMIN_PASSWORD_HASH` 환경변수로 관리 |

> 실제 비밀번호와 해시는 이 문서에 기록하지 않는다. `.dev.vars` 파일에만 보관하고 저장소에 커밋하지 않는다.

---

## 0-1. 로컬 개발 환경 (배포 없이 테스트)

### 로컬 아키텍처

```
브라우저 (http://localhost:8080)
        ↓ fetch('http://localhost:8787/api/...')
wrangler dev  ← Worker를 로컬 PC에서 실행 (Cloudflare 계정 불필요)
        ↓
D1 로컬 SQLite  ← wrangler가 자동 에뮬레이션 (.wrangler/state/)
        ↓
Resend API  ← 인터넷 항상 연결되어 있으므로 실제 발송 가능
```

### 사전 환경 (확인 완료)

| 도구 | 버전 | 상태 |
|------|------|------|
| Node.js | v22.14.0 | ✅ 설치됨 |
| wrangler | 최신 | ✅ 설치됨 (npm -g) |

### 로컬 실행 순서

```bash
# 터미널 1 — Worker 로컬 서버
wrangler dev
# → http://localhost:8787 에서 API 서버 시작
# → D1은 로컬 SQLite로 자동 에뮬레이션 (.wrangler/state/ 폴더)

# 터미널 2 — HTML 정적 서버
python -m http.server 8080
# → http://localhost:8080/showcase.html   뉴스레터 구독 테스트
# → http://localhost:8080/admin.html      관리자 페이지 접속
```

### 접속 방법

1. 두 터미널 모두 실행
2. 브라우저에서 `http://localhost:8080/admin.html` 접속
3. 관리자 비밀번호 입력 → 로그인 (비밀번호는 `.dev.vars`의 `ADMIN_PASSWORD_HASH` 참조)
4. 대시보드 진입 완료

### WORKER_URL 자동 분기 (showcase.html / admin.html 공통)

```javascript
// 배포 후 YOUR_SUBDOMAIN을 실제 Cloudflare 서브도메인으로 교체
const WORKER_URL = location.hostname === 'localhost'
  ? 'http://localhost:8787'
  : 'https://landinghub-api.YOUR_SUBDOMAIN.workers.dev';
```

### 로컬 D1 초기화 방법

wrangler dev 실행 전 한 번만 실행:

```bash
# 로컬 D1에 스키마 적용
wrangler d1 execute landinghub-newsletter --local --file=api/schema.sql
```

`schema.sql` 파일에 4개 테이블 CREATE 문 저장 (구현 시 자동 생성).

### Resend API 키 로컬 설정

`.dev.vars` 파일 (`.gitignore`에 추가 필수):

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
ADMIN_PASSWORD_HASH=sha256_hex_값
```

`wrangler dev`는 이 파일을 자동으로 환경변수로 읽음.

### 배포 시 전환 방법

```bash
# 시크릿 설정 (1회)
wrangler secret put RESEND_API_KEY
wrangler secret put ADMIN_PASSWORD_HASH

# 배포
wrangler deploy
```

---

## 1. 개요 및 목적

`showcase.html`의 NOTIFY 섹션에 이메일 입력 UI는 있지만 JS 핸들러와 백엔드가 없음.  
Cloudflare D1(DB) + Cloudflare Worker(API)를 연동해 구독 데이터를 저장하고,  
`admin.html`에서 구독자 관리·뉴스레터 발송이 가능한 관리자 시스템을 구축한다.

---

## 2. 전체 아키텍처

```
[showcase.html]   [admin.html]
      |                |
      └─── fetch() ────┘
                |
       [Cloudflare Worker]  ← API 레이어 (CORS, 인증, 라우팅)
                |
          [Cloudflare D1]   ← 영구 데이터 저장
                |
           [Resend API]     ← 이메일 실제 발송 (무료 월 3,000건 / 일 100건)
```

---

## 3. D1 데이터베이스 스키마

DB명: `landinghub-newsletter`  
총 4개 테이블

### `subscribers` — 구독자

```sql
CREATE TABLE subscribers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE,
  status          TEXT    NOT NULL DEFAULT 'active',
                  -- active | unsubscribed | bounced | complained
  source          TEXT    DEFAULT 'notify_form',
  ip              TEXT,
  user_agent      TEXT,
  tags            TEXT    DEFAULT '[]',          -- JSON 배열 문자열
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  unsubscribed_at TEXT
);
CREATE INDEX idx_sub_email   ON subscribers(email);
CREATE INDEX idx_sub_status  ON subscribers(status);
CREATE INDEX idx_sub_created ON subscribers(created_at DESC);
```

### `campaigns` — 뉴스레터 캠페인

```sql
CREATE TABLE campaigns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  subject       TEXT NOT NULL,
  preview_text  TEXT,                            -- 메일 클라이언트 미리보기
  body_html     TEXT NOT NULL,
  body_text     TEXT,                            -- 텍스트 fallback
  status        TEXT NOT NULL DEFAULT 'draft',
                -- draft | sending | sent | failed
  scheduled_at  TEXT,
  sent_at       TEXT,
  total_sent    INTEGER DEFAULT 0,
  total_failed  INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_camp_status  ON campaigns(status);
CREATE INDEX idx_camp_created ON campaigns(created_at DESC);
```

### `send_logs` — 개별 발송 이력

```sql
CREATE TABLE send_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id   INTEGER NOT NULL REFERENCES campaigns(id),
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id),
  email         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
                -- pending | sent | failed | bounced
  resend_id     TEXT,                            -- Resend API message_id
  error_msg     TEXT,
  sent_at       TEXT DEFAULT (datetime('now')),
  UNIQUE(campaign_id, subscriber_id)
);
CREATE INDEX idx_log_campaign ON send_logs(campaign_id);
CREATE INDEX idx_log_status   ON send_logs(status);
```

### `admin_sessions` — 관리자 세션

```sql
CREATE TABLE admin_sessions (
  id         TEXT PRIMARY KEY,   -- crypto.randomUUID()
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,      -- created_at + 24h
  ip         TEXT
);
CREATE INDEX idx_sess_expires ON admin_sessions(expires_at);
```

---

## 4. Cloudflare Worker API 설계

### `wrangler.toml`

```toml
name = "landinghub-api"
main = "api/worker.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "landinghub-newsletter"
database_id = "← MCP로 생성 후 채움"

[vars]
ALLOWED_ORIGIN = "*"
# 아래 2개는 wrangler secret put 으로 설정 (코드에 하드코딩 금지)
# RESEND_API_KEY
# ADMIN_PASSWORD_HASH  (SHA-256 hex)
```

### 엔드포인트 목록

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/subscribe` | 없음 | 이메일 구독 신청 |
| POST | `/api/unsubscribe` | 쿼리 토큰 | 구독 취소 |
| POST | `/api/admin/login` | 없음 | 관리자 로그인 |
| DELETE | `/api/admin/logout` | Bearer | 로그아웃 |
| GET | `/api/admin/stats` | Bearer | 대시보드 통계 |
| GET | `/api/admin/subscribers` | Bearer | 구독자 목록 (page, search, status) |
| DELETE | `/api/admin/subscribers/:id` | Bearer | 구독자 삭제 |
| PATCH | `/api/admin/subscribers/:id` | Bearer | 상태 변경 |
| GET | `/api/admin/subscribers/export` | Bearer | CSV 내보내기 |
| POST | `/api/admin/campaigns` | Bearer | 캠페인 생성 (draft) |
| GET | `/api/admin/campaigns` | Bearer | 캠페인 목록 |
| GET | `/api/admin/campaigns/:id` | Bearer | 캠페인 상세 |
| POST | `/api/admin/campaigns/:id/send` | Bearer | 발송 실행 |
| GET | `/api/admin/campaigns/:id/logs` | Bearer | 발송 로그 |

### 인증 흐름

```
1. POST /api/admin/login { password }
2. Worker: SHA-256(password) === env.ADMIN_PASSWORD_HASH
3. 일치 → crypto.randomUUID() 토큰 → admin_sessions INSERT (expires +24h)
4. 응답: { token }
5. 브라우저: localStorage.setItem('adminToken', token)
6. 이후 요청: Authorization: Bearer <token> 헤더
7. Worker 미들웨어: admin_sessions 조회 → expires_at 확인
```

### 핵심 로직 메모

**`POST /api/subscribe`**
- 이메일 정규식 검증
- 중복 이메일 → 이미 active면 "이미 구독 중" 반환 (에러 아님)
- unsubscribed였으면 status를 active로 UPDATE
- 신규 → INSERT
- 성공 후 Resend로 환영 이메일 발송 (실패해도 구독은 성공 처리)

**`POST /api/admin/campaigns/:id/send`**
- status `draft` → `sending` 업데이트
- active 구독자 SELECT (500명 단위 분할)
- `ctx.waitUntil()`로 백그라운드 발송 (Worker 30초 제한 우회)
- send_logs INSERT, 완료 후 status `sent` 업데이트

---

## 5. `showcase.html` 수정 범위

수정 위치 3곳:

```
라인 447  <input ...>          → id="notifyEmail" 추가
라인 448  <button ...>         → id="notifyBtn" 추가
라인 452  (안내 문구 위)        → <div id="notifyMsg"></div> 1줄 추가
<style>                        → #notifyMsg 스타일 4줄 추가
<script> 끝 (라인 659 직전)    → 구독 핸들러 ~35줄 추가
```

추가될 JS 핵심 로직:
```javascript
// 배포 후 YOUR_SUBDOMAIN을 실제 Cloudflare 서브도메인으로 교체
const WORKER_URL = 'https://landinghub-api.YOUR_SUBDOMAIN.workers.dev';

document.getElementById('notifyBtn').addEventListener('click', async () => {
  const email = document.getElementById('notifyEmail').value.trim();
  // 검증 → fetch(WORKER_URL + '/api/subscribe') → 피드백 UI 표시
});
```

---

## 6. `admin.html` 기능 명세

### 레이아웃 구조

```
┌─────────────────────────────────────────────────────────┐
│ [고정 사이드바 240px]      [메인 콘텐츠 영역]               │
│                                                         │
│  LH  LandingHub Admin    ┌─────────────────────────┐   │
│  ─────────────           │  선택된 섹션 내용          │   │
│  🏠 대시보드              │                         │   │
│  👥 구독자 관리            └─────────────────────────┘   │
│  ✉️  뉴스레터 작성                                       │
│  📊 발송 이력                                            │
│  ⚙️  설정                                               │
│  ─────────                                             │
│  🔴 로그아웃                                             │
└─────────────────────────────────────────────────────────┘
```

디자인: showcase.html과 동일 (다크 테마 `#05050f`, Tailwind CDN, Inter 폰트)  
방식: SPA — JS `display` 토글로 섹션 전환, 별도 라우터 없음

---

### 섹션 0: 로그인 게이트

- 초기 로드 시 `localStorage.getItem('adminToken')` 확인
- 없으면 전체화면 오버레이 로그인 화면 표시
- 비밀번호 입력 → `POST /api/admin/login` → 성공 시 토큰 저장, 대시보드 진입
- 모든 API에서 401 반환 시 자동 로그아웃

---

### 섹션 1: 대시보드

**KPI 카드 4개** (`GET /api/admin/stats`):
- 총 구독자 수 (active)
- 이번 달 신규 구독자
- 총 발송 캠페인 수
- 전체 발송 성공률 (%)

**최근 활동 피드:**
- 최근 구독자 5명 (이메일 + 가입일)
- 최근 캠페인 3개 (제목 + 발송일 + 수신자 수)

**빠른 액션:**
- "새 뉴스레터 작성" 버튼 → 뉴스레터 섹션 이동

---

### 섹션 2: 구독자 관리

**상단 컨트롤바:**
- 이메일 검색 입력창 (실시간 debounce 검색)
- 상태 필터 드롭다운 (전체 / active / unsubscribed / bounced)
- CSV 내보내기 버튼
- 총 구독자 수 배지

**테이블 컬럼:**

| # | 이메일 | 상태 | 가입일 | 가입 경로 | 액션 |
|---|--------|------|--------|-----------|------|

**상태 배지 색상:**
- `active` → 초록
- `unsubscribed` → 회색
- `bounced` → 주황
- `complained` → 빨강

**액션:**
- 삭제 버튼 → 확인 모달 → `DELETE /api/admin/subscribers/:id`
- 상태 변경 드롭다운 → `PATCH /api/admin/subscribers/:id`

**페이지네이션:** 페이지당 20개, 이전/다음 버튼

---

### 섹션 3: 뉴스레터 작성

**2패널 레이아웃:**

| 왼쪽: 편집 폼 | 오른쪽: 실시간 프리뷰 |
|---------------|----------------------|
| 제목 (Subject) 입력 | iframe으로 본문 실시간 렌더링 |
| 미리보기 텍스트 (80자 제한 + 카운터) | 모바일 / 데스크탑 뷰 전환 토글 |
| 본문 HTML 텍스트에어리어 | |

**하단 액션바:**
- "임시저장" → `POST /api/admin/campaigns` (status: draft)
- "발송 대상 확인" → active 구독자 수 표시
- "발송하기" → 확인 모달 ("X명에게 발송합니다") → `POST /api/admin/campaigns/:id/send`

**기존 초안 불러오기:** draft 목록 드롭다운 → 선택 시 폼에 로드

---

### 섹션 4: 발송 이력

**캠페인 목록 테이블:**

| 제목 | 상태 | 발송일 | 총 수신자 | 성공 | 실패 | 상세 |
|------|------|--------|-----------|------|------|------|

**상태 탭 필터:** 전체 / 발송완료 / 초안 / 발송중 / 실패

**캠페인 상세 모달 (상세 버튼 클릭):**
- 캠페인 기본 정보
- 수신자별 발송 상태 목록 (이메일 / 상태 / 발송시각)
- 실패 수신자만 필터
- 재발송 버튼 (비활성 처리, 향후 구현)

---

### 섹션 5: 설정

| 항목 | 내용 |
|------|------|
| Resend 연결 상태 | API ping → 연결/미연결 배지 |
| 발신자 정보 | 발신 이름 / 이메일 (읽기 전용 표시) |
| 관리자 비밀번호 변경 | UI만 제공, 실제 변경은 `wrangler secret` 안내 |
| 위험 구역 | "구독 취소된 구독자 전체 삭제" (확인 모달 필수) |

---

## 7. 이메일 발송 — Resend API

**선택 이유:** REST API 1번 호출, Worker `fetch()` 지원, 무료 월 3,000건

**Worker 발송 패턴:**
```javascript
// 배포 시 인증된 Resend 도메인으로 교체
const FROM_EMAIL = 'LandingHub <no-reply@yourdomain.com>';

async function sendEmail(env, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,  // 배포 시 인증된 도메인으로 교체 (아래 FROM_EMAIL 상수 참조)
      to: [to], subject, html
    })
  });
  return res.ok ? await res.json() : null;
}
```

**이메일 유형:**
1. 환영 이메일 — 구독 직후 자동 발송
2. 뉴스레터 — admin.html에서 수동 발송
3. 구독 취소 확인 — 취소 링크 클릭 시 (향후)

---

## 8. 구현 순서

| # | 작업 | 실행 주체 | 비고 |
|---|------|----------|------|
| 1 | D1 DB 생성 | Claude (MCP) | `landinghub-newsletter` |
| 2 | 스키마 4개 테이블 적용 | Claude (MCP) | |
| 3 | `wrangler.toml` 생성 | Claude | DB ID 자동 채움 |
| 4 | `worker.js` 생성 | Claude | 전체 API ~450줄 |
| 5 | `showcase.html` 수정 | Claude | NOTIFY 폼 핸들러 |
| 6 | `admin.html` 생성 | Claude | 전체 관리자 프론트 |
| 7 | Resend API 키 설정 | **사용자** | `! wrangler secret put RESEND_API_KEY` |
| 8 | 관리자 비밀번호 해시 설정 | **사용자** | `! wrangler secret put ADMIN_PASSWORD_HASH` |
| 9 | Worker 배포 | **사용자** | `! wrangler deploy` |
| 10 | WORKER_URL 업데이트 | Claude | 배포 URL → showcase.html 반영 |

---

## 9. 기술적 주의사항

| 제약 | 해결책 |
|------|--------|
| Worker 30초 실행 제한 | `ctx.waitUntil()` 백그라운드 발송 |
| Resend 일 100건 제한 | admin.html에 오늘 발송 잔여량 표시 |
| 로컬 `file://` CORS | `! python -m http.server 8080` 로컬 서버 사용 |
| 비밀번호 평문 저장 금지 | SHA-256 hex 해시만 환경변수에 저장 |
| D1 대용량 조회 | cursor 기반 페이지네이션, 500행 단위 분할 |

---

## 10. 검증 방법

```bash
# 1. 구독 API 테스트
curl -X POST https://<worker>/api/subscribe \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com"}'
# 기대: { "message": "구독이 완료되었습니다!" }

# 2. D1 구독자 확인 (MCP)
# d1_database_query: SELECT * FROM subscribers

# 3. 관리자 로그인 → 구독자 목록 확인 (admin.html)
# 4. 캠페인 작성 → 발송 → Resend 대시보드 로그 확인
# 5. showcase.html NOTIFY 폼 실제 이메일 입력 → 성공 메시지 확인
```
