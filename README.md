# LandingHub

> 국내 랜딩페이지 쇼케이스 + 뉴스레터 관리 시스템

[![Deploy](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://landinghub-api.lanfinghub-kr.workers.dev)
[![GitHub](https://img.shields.io/badge/GitHub-G--bak%2F02--HARNESS-181717?logo=github)](https://github.com/G-bak/02-HARNESS)

---

## 라이브 서비스

| 서비스 | URL |
|---|---|
| 쇼케이스 | https://landinghub-api.lanfinghub-kr.workers.dev/showcase |
| 관리자 페이지 | https://landinghub-api.lanfinghub-kr.workers.dev/admin |
| API | https://landinghub-api.lanfinghub-kr.workers.dev |

---

## 소개

**LandingHub**는 국내 우수 랜딩페이지를 한눈에 볼 수 있는 쇼케이스 플랫폼입니다.  
방문자는 쇼케이스에서 랜딩페이지 트렌드를 탐색하고 뉴스레터를 구독할 수 있으며,  
관리자는 전용 대시보드에서 구독자 관리와 뉴스레터 발송을 직접 운영할 수 있습니다.

---

## 주요 기능

### 쇼케이스 (`/showcase`)
- 국내 랜딩페이지 카드 형태 전시
- 뉴스레터 구독 폼 (이메일 중복 방지, 환영 메일 자동 발송)

### 관리자 대시보드 (`/admin`)
- **대시보드** — 구독자 수, 발송 캠페인 수, 발송 성공률 실시간 통계
- **구독자 관리** — 구독자 목록 조회·삭제, 구독취소자 일괄 삭제
- **뉴스레터 작성** — HTML 에디터 + 실시간 미리보기, 임시저장(로컬스토리지), 초안 저장·불러오기·삭제
- **발송 이력** — 캠페인별 발송 성공/실패 현황, 상세 로그 조회
- **설정** — 다크/라이트 테마

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| 서버 | Cloudflare Workers (Edge Runtime) |
| 데이터베이스 | Cloudflare D1 (SQLite) |
| 이메일 | Resend API |
| 프론트엔드 | Vanilla JS + Tailwind CSS (CDN) |
| 배포 | Wrangler CLI |

### 아키텍처

```
브라우저
  │
  ├─ GET /showcase, /admin    → Cloudflare Workers (정적 파일 서빙)
  │
  └─ /api/*                  → Cloudflare Workers (API 라우터)
                                    │
                                    ├─ Cloudflare D1  (구독자 · 캠페인 · 발송 이력)
                                    └─ Resend API     (이메일 발송)
```

---

## API 레퍼런스

### 공개 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/subscribe` | 뉴스레터 구독 |
| `GET` | `/api/unsubscribe?email=` | 구독 취소 |

### 관리자 API (인증 필요)

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/admin/login` | 관리자 로그인 |
| `DELETE` | `/api/admin/logout` | 로그아웃 |
| `GET` | `/api/admin/stats` | 통계 조회 |
| `GET` | `/api/admin/subscribers` | 구독자 목록 |
| `DELETE` | `/api/admin/subscribers/:id` | 구독자 삭제 |
| `GET` | `/api/admin/campaigns` | 캠페인 목록 (`?status=all\|draft\|sent`) |
| `POST` | `/api/admin/campaigns` | 캠페인 생성 |
| `GET` | `/api/admin/campaigns/:id` | 캠페인 상세 |
| `PATCH` | `/api/admin/campaigns/:id` | 캠페인 수정 (초안만) |
| `DELETE` | `/api/admin/campaigns/:id` | 캠페인 삭제 (초안만) |
| `POST` | `/api/admin/campaigns/:id/send` | 캠페인 발송 |
| `GET` | `/api/admin/campaigns/:id/logs` | 발송 로그 |

---

## 로컬 개발

### 사전 준비

```bash
# Wrangler 설치
npm install -g wrangler

# Cloudflare 로그인
wrangler login
```

### 환경변수 설정

`.dev.vars` 파일을 프로젝트 루트에 생성하세요.

```
RESEND_API_KEY=re_...
ADMIN_PASSWORD_HASH=<SHA-256 해시값>
```

> `ADMIN_PASSWORD_HASH`는 관리자 비밀번호를 SHA-256으로 해싱한 값입니다.

### 로컬 실행

```bash
npx wrangler dev
```

로컬 D1 DB 초기화가 필요한 경우:

```bash
npx wrangler d1 execute landinghub-newsletter --local --file=api/schema.sql
```

---

## 배포

```bash
# 시크릿 등록 (최초 1회)
wrangler secret put RESEND_API_KEY
wrangler secret put ADMIN_PASSWORD_HASH

# 배포
npx wrangler deploy
```

---

## 데이터베이스 스키마

```sql
subscribers   -- 구독자 (email, status, created_at)
campaigns     -- 캠페인 (subject, body_html, status, sent_at)
send_logs     -- 발송 이력 (campaign_id, subscriber_id, status)
admin_sessions -- 관리자 세션 토큰
```

---

## 저장소

- **GitHub:** https://github.com/G-bak/02-HARNESS
