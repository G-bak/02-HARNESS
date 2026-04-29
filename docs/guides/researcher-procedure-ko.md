# Researcher 절차 통일 — 한국어 운영 가이드

**버전:** 1.0 | **최종 수정:** 2026-04-28  
**대상:** 02-HARNESS Analyst·운영자  
**용도:** 외부 검색·최신 사실 확인·공식 문서 검증을 수행할 때, 실행 방식과 무관하게 동일한 Research Summary를 남기기 위한 절차를 정의한다.

---

## 0. 문서 위치

이 문서는 **운영 가이드(Operational guide)** 클래스다. 권위 문서는 `docs/agents/researcher.md`와 `docs/agents/analyst.md`다.

---

## 1. 결론

Researcher 절차는 하나다.

```text
조사 질문 → scope/exclude → 공식/1차 출처 확인 → snippet/근거 요약 → confidence → Research Summary 기록
```

실행 방식은 세 가지 중 하나를 고른다.

| execution_mode | 사용 시점 |
|---|---|
| `in-session` | 공식 문서 1-2개 확인, 단순 최신 사실 검증 |
| `delegated` | 사용자가 명시적으로 서브에이전트/위임/병렬 작업을 요청한 경우 |
| `external_cli_fallback` | 장시간 조사, 다중 출처 충돌, 보안·아키텍처 영향 분석, 격리 실행 필요 |

중요한 기준은 "어떤 도구를 썼는가"가 아니라 **Research Summary가 남았는가**다.

---

## 2. Researcher로 라우팅해야 하는 경우

아래에 해당하면 Analyst 단독 답변으로 처리하지 않는다.

- 사용자가 검색, 조사, 최신, 현재, 공식 문서 확인을 요청함
- 모델 가용성, 가격, 정책, API 명세처럼 변동 가능한 외부 사실 확인이 필요함
- Generator가 외부 문서나 최신 API 정보를 필요로 한다고 보고함
- 여러 출처의 신뢰도 비교나 충돌 판정이 필요함

단순 로컬 파일 확인은 Researcher가 아니다.

---

## 3. Research Summary 템플릿

원장 또는 보고서에는 아래 구조를 남긴다.

```json
{
  "agent": "Researcher",
  "execution_mode": "in-session | delegated | external_cli_fallback",
  "research_question": "확인할 질문",
  "scope": {
    "include": ["허용 출처 또는 주제"],
    "exclude": ["제외 출처 또는 주제"]
  },
  "sources": [
    {
      "title": "문서명",
      "url": "출처 URL",
      "relevance": "HIGH | MEDIUM | LOW",
      "snippet": "근거가 되는 짧은 발췌 또는 요약"
    }
  ],
  "confidence": "HIGH | MEDIUM | LOW | NONE",
  "confidence_rationale": "신뢰도 판단 근거",
  "unverified_claims": ["근거가 부족하거나 버전 의존적인 주장"],
  "log": [
    {"timestamp": "ISO8601", "action": "수행 내용", "result": "결과"}
  ]
}
```

답변 전에 작성하는 것이 원칙이다. 부득이하게 누락되면 즉시 `AUDIT_NOTE`로 보정하고, 다음부터 같은 실수가 반복되지 않도록 한다.

---

## 4. external CLI fallback 기준

Codex CLI 같은 외부 실행은 기본값이 아니다. 아래 조건 중 하나에 해당할 때만 사용한다.

- 조사 시간이 길고 별도 컨텍스트 격리가 필요한 경우
- 다수 출처 충돌을 비교해야 하는 경우
- 보안·아키텍처·법적/정책적 영향처럼 판단 비용이 높은 경우
- 사용자가 명시적으로 서브에이전트 또는 별도 CLI 조사를 요청한 경우

사용했다면 반드시 기록한다.

```text
[ ] command
[ ] model
[ ] sandbox / 실행 환경
[ ] fallback 여부와 사유
[ ] 결과 파일 또는 Research Summary
```

모델 선택은 `docs/agents/researcher.md`의 기준을 따른다. 고위험·고가치 조사는 실행 환경에서 지원되는 최신 flagship 모델을 우선하고, 단순 조회는 경량 모델 또는 현재 세션 모델을 허용한다. 최신 모델이 지원되지 않으면 사유를 기록하고 지원되는 fallback 모델로 재시도한다.

> ⚠ **Known capability (INS-20260429-020-01 출처)** — Codex CLI는 built-in `image_gen.imagegen` skill을 내장한다. `OPENAI_API_KEY` 없이 작동하며 default 모델은 `gpt-image-2` (최대 4K), CLI fallback으로 `gpt-image-1.5` 사용 가능. read-only sandbox에서는 이미지가 `$CODEX_HOME/generated_images/`에만 저장되므로, **워크스페이스로 산출물을 이동시키려면 `-s workspace-write` 필요**. Researcher external_cli_fallback 호출 시 검색·분석·이미지 생성·파일 저장을 single invocation에서 처리할 수 있다 (TASK-20260429-020 입증). 부수: Codex sandbox는 외부 HTTP fetch를 차단할 수 있어 라이브 사이트 검증이 필요하면 사용자가 사전 fetch한 결과를 handoff에 포함하는 우회로 검토.

---

## 5. 실패 처리

Researcher가 실패해도 세션을 종료하지 않는다.

| 실패 | 처리 |
|---|---|
| 도구 접근 차단 | 범위 조정 또는 다른 허용 도구로 1회 재시도 |
| 모델 미지원 | fallback 사유 기록 후 지원 모델로 재시도 |
| rate limit | backoff 후 재시도. 반복 실패 시 Resource Failure |
| 인증·결제 문제 | Task HOLD, 사용자 조치 필요 보고 |
| 출처 신뢰도 없음 | `confidence: NONE`, Analyst가 사용자에게 질의 |

---

## 6. Generator 전달 규칙

Researcher 결과는 Generator에게 직접 전달하지 않는다.

올바른 흐름:

```text
Researcher → Research Summary → Analyst → handoff allowed_context.research_summary → Generator
```

Generator가 추가 원문 확인이 필요하다고 판단하면 직접 웹 검색하지 않고 Analyst에게 Researcher 재투입을 요청한다.

---

## 7. 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| 1.0 | 2026-04-28 | 최초 작성. 실행 방식과 무관한 Research Summary 절차 통일 |
