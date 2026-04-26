# LandingHub

국내 랜딩페이지 쇼케이스 + 뉴스레터 관리 시스템

## 배포 URL

| 서비스 | URL |
|---|---|
| 쇼케이스 | https://landinghub-api.lanfinghub-kr.workers.dev/showcase |
| 관리자 페이지 | https://landinghub-api.lanfinghub-kr.workers.dev/admin |
| API | https://landinghub-api.lanfinghub-kr.workers.dev |

## 기술 스택

- **Cloudflare Worker** — API 서버 + 정적 파일 서빙
- **Cloudflare D1** — SQLite 데이터베이스 (구독자, 캠페인, 발송 이력)
- **Resend** — 이메일 발송

## 주요 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/subscribe` | 뉴스레터 구독 |
| GET | `/api/unsubscribe?email=` | 구독 취소 |
| POST | `/api/admin/login` | 관리자 로그인 |
| GET | `/api/admin/stats` | 통계 조회 |
| GET | `/api/admin/subscribers` | 구독자 목록 |
| POST | `/api/admin/campaigns` | 캠페인 생성 |
| POST | `/api/admin/campaigns/:id/send` | 캠페인 발송 |

## 로컬 개발

```bash
# 시크릿 설정 (.dev.vars 파일 참고)
npx wrangler dev

# 배포
npx wrangler deploy
```
