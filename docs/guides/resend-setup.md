# Resend API 연동 가이드

**버전:** 1.0 | **최종 수정:** 2026-04-26  
**목적:** 뉴스레터 실제 이메일 발송 기능 활성화  
**소요 시간:** 약 10~15분  
**비용:** 무료 (월 3,000건, 일 100건 한도)

---

## 1. Resend 계정 생성

1. [https://resend.com](https://resend.com) 접속
2. **Sign Up** 클릭
3. 이메일 + 비밀번호로 가입 (GitHub 소셜 로그인도 가능)
4. 가입 확인 이메일 수신 후 인증 완료

---

## 2. API 키 발급

1. 로그인 후 좌측 사이드바 **API Keys** 클릭
2. **Create API Key** 버튼 클릭
3. 이름 입력 (예: `landinghub-local`)
4. Permission: **Full Access** 선택
5. **Add** 클릭
6. 발급된 키 복사 (`re_` 로 시작하는 문자열)

> ⚠️ 키는 생성 직후에만 전체 확인 가능 — 반드시 즉시 복사해둘 것

---

## 3. 발신자 도메인 설정 (선택 — 무료 테스트는 생략 가능)

### 3-1. 테스트 단계 (도메인 없이)
- Resend 무료 플랜은 `onboarding@resend.dev` 를 발신자로 사용 가능
- `worker.js` 의 `FROM_EMAIL` 을 아래로 설정하면 도메인 없이 바로 테스트 가능:
  ```
  onboarding@resend.dev
  ```
- **단, 수신자가 본인 이메일로만 발송 가능** (Resend 정책)

### 3-2. 실제 운영 (커스텀 도메인)
1. Resend 사이드바 **Domains** 클릭
2. **Add Domain** → 보유한 도메인 입력 (예: `landinghub.kr`)
3. 안내된 DNS 레코드 3개를 도메인 등록업체에서 추가
   - SPF, DKIM, DMARC
4. Resend에서 **Verify** 클릭 → 초록색 Verified 확인
5. 이후 `noreply@landinghub.kr` 등 자유롭게 발신자 설정 가능

---

## 4. 로컬 환경 연동 (.dev.vars)

`.dev.vars` 파일을 열어 아래 값 교체:

```
# 수정 전
RESEND_API_KEY=your_resend_api_key_here

# 수정 후
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

그리고 `worker.js` 상단의 발신자 이메일 확인:

```javascript
// api/worker.js 상단부 sendEmail 함수 내
from: 'LandingHub <onboarding@resend.dev>',  // 도메인 없을 때
// from: 'LandingHub <noreply@landinghub.kr>',  // 도메인 있을 때
```

---

## 5. wrangler dev 재시작

```bash
wrangler dev
```

재시작 후 `admin.html` → 설정 탭 → **연결 확인** 버튼 클릭  
→ 🟢 **연결됨 — API 키 확인** 으로 표시되면 완료

---

## 6. 실제 배포 시 (wrangler secret)

배포 환경에서는 `.dev.vars` 를 사용하지 않으므로 아래 명령어로 시크릿 등록:

```bash
wrangler secret put RESEND_API_KEY
# 프롬프트에 API 키 붙여넣기
```

등록 후 배포:

```bash
wrangler deploy
```

---

## 7. 발송 테스트

1. `admin.html` → **뉴스레터 작성** 탭
2. 제목, 본문 HTML 작성
3. **발송** 버튼 클릭
4. [https://resend.com/emails](https://resend.com/emails) 에서 발송 로그 확인

---

## 주의사항

| 항목 | 내용 |
|------|------|
| 무료 한도 | 월 3,000건 / 일 100건 |
| 테스트 발신자 | `onboarding@resend.dev` (도메인 인증 전) |
| 수신자 제한 | 테스트 계정은 본인 이메일만 수신 가능 |
| `.dev.vars` | Git에 절대 커밋 금지 (`.gitignore` 에 추가 권장) |
| API 키 노출 | 클라이언트 코드에 절대 포함 금지 — Worker 환경변수로만 사용 |
