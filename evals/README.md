# LiveChat Radar — 라이브 쇼핑 분석 회귀 평가 스위트

`/api/analyze/shop`의 OpenAI 응답 품질을 **고정된 쇼핑 댓글 시나리오**로 자동 채점하는 회귀 평가 도구.

다음 변경 직후 반드시 실행:
- `src/prompts.ts`의 `STATIC_SHOP_ANALYZE_SYSTEM_PROMPT` 수정
- `src/prompts.ts`의 `shopAnalyzeJsonSchema` 수정
- `src/lib/simulateShopAnalysis.ts` 시뮬레이터 규칙 수정 (dry-run이 이를 채점)
- `gpt-4o-mini` ↔ `gpt-4o` 모델 교체

## 사용법

```bash
# Dry-run (기본) — 결정적 로컬 시뮬레이터로 universal + fixture-specific 모두 채점. OpenAI 호출 없음.
npm run eval

# Live — 실제 OpenAI 호출 + universal + fixture-specific 채점 (비용 발생!)
npm run eval:live

# 모델 오버라이드
npm run eval -- --model gpt-4o
npm run eval:live -- --model gpt-4o
```

## Fixture 목록

| # | Fixture | 시나리오 | 핵심 assertion |
|---|---------|---------|---------------|
| 01 | `purchase_heavy` | 구매 의사·가격 우세 (상품 등록됨) | 구매 인증 ≥ 2, faq ≥ 3, `closing-now` 카드 |
| 02 | `stream_issues` | 방송 장애 빈발 | 방송 장애 ≥ 3, `stream-fix` 카드 |
| 03 | `complaint_dominant` | 불만/항의 우세 | 미응답 ≥ 2, `unanswered-flush`/`objection-trust` 카드 |
| 04 | `mixed_sentiment` | 균형 분포 | conversionAdvice/recentSummary 비어있지 않음 |
| 05 | `question_heavy` | 질문 다수 | 미응답 ≥ 5 |
| 06 | `low_volume` | 저밀도 트래픽 | schema 완전성 + conversionAdvice |

## Universal Assertions (모든 fixture)

- `analyses.tag` ∈ SHOP_TAGS(37) / `analyses.axis` ∈ SHOP_AXES(6) / axis-tag 매핑 일치
- `analyses.sentiment` ∈ {positive,neutral,negative} / `analyses.urgency` ∈ {low,medium,high}
- `metrics` 비어있지 않음 + `status` ∈ {good,normal,warning,danger}
- `actionCards` ≤ 3 + `priority` 유효
- `unanswered` tag/urgency 유효
- `productInterest`/`faq` 배열
- `recentSummary`/`conversionAdvice` 비어있지 않음

## 신규 Fixture 추가 방법

1. `fixtures/0N_scenario.json` 생성 — `name`, `description`, `streamTitle`, `products[]`(선택), `messages[]`, `assertions{}`
2. `assertions{}` 키는 `evals/assertions.ts`의 `FixtureAssertions` 인터페이스 참조
3. `npm run eval`로 dry-run 통과 확인 → `npm run eval:live`로 실제 채점

## 신규 Assertion 추가 방법

1. `evals/assertions.ts`의 `FixtureAssertions`에 필드 추가
2. `runFixtureSpecific()`에 검증 로직 추가
3. 관련 fixture의 `assertions{}`에 키 추가
> dry-run은 결정적 시뮬레이터(`generateSimulatedShopAnalysis`) 출력을 채점하므로 별도 mock 보완은 불필요.

## 비용 안내

- Dry-run: $0
- Live 1회 (6 fixture): 약 $0.005 (gpt-4o-mini), $0.05 (gpt-4o) 수준
- Prompt Caching으로 2회차 이후 system 토큰 50% 할인. 비용은 종료 시 자동 출력.
