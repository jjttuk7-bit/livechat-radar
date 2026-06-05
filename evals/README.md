# LiveChat Radar — Prompt Regression Evaluation Suite

`/api/analyze`의 OpenAI 응답 품질을 **고정된 댓글 시나리오**로 자동 채점하는 회귀 평가 도구.

다음 변경 직후 반드시 실행:
- `src/prompts.ts`의 `STATIC_ANALYZE_SYSTEM_PROMPT` 수정
- `src/prompts.ts`의 `analyzeJsonSchema` 수정
- `gpt-4o-mini` ↔ `gpt-4o` 모델 교체

## 사용법

```bash
# Dry-run (기본) — fixture 파싱 + universal assertion self-test, OpenAI 호출 없음
# fixture-specific assertion은 mock으로 채점할 수 없으므로 스킵됨
npm run eval

# Live — 실제 OpenAI 호출 + universal + fixture-specific 모두 채점 (비용 발생!)
npm run eval:live

# 모델 오버라이드
npm run eval -- --model gpt-4o
npm run eval:live -- --model gpt-4o

# 비교: 같은 fixture를 두 모델에 돌려보고 결과 표 비교
npm run eval:live -- --model gpt-4o-mini
npm run eval:live -- --model gpt-4o
```

## Fixture 목록

| # | Fixture | 시나리오 | 핵심 assertion |
|---|---------|---------|---------------|
| 01 | `purchase_heavy` | 쇼핑 라이브, 구매 의사 우세 | purchase_signal ≥ 2, positive ≥ 40 |
| 02 | `stream_issues` | 기술 장애 빈발 | stream_issue ≥ 1, negative ≥ 20, urgent/음향 액션 |
| 03 | `complaint_dominant` | 불만/항의 우세 | complaint ≥ 1, negative ≥ 30 |
| 04 | `mixed_sentiment` | 균형 분포 | 어떤 카테고리도 70 미만 |
| 05 | `question_heavy` | 질문 다수 | faq ≥ 3 |
| 06 | `low_volume` | 저밀도 트래픽 | schema 완전성 + suggestedTopic 비어있지 않음 |

## Universal Assertions (모든 fixture에 적용)

- `sentiment` 합이 100
- `topKeywords` 1~5개
- `specialComments` ≤ 5개
- `specialComments.category` ∈ {complaint, purchase_signal, stream_issue}
- `presenterActions` 1~5개
- `presenterActions.type` ∈ {urgent, info, action}
- `recentSummary` 비어있지 않음 (길이 > 5)
- `suggestedTopic` 비어있지 않음 (길이 > 5)

## 신규 Fixture 추가 방법

1. `fixtures/0N_my_scenario.json` 파일 생성 — 기존 fixture 구조 참조 (`name`, `description`, `streamTitle`, `messages[]`, `assertions{}`)
2. `assertions{}`에 검증할 키를 채워 넣음 (지원되는 키는 `evals/assertions.ts` `FixtureAssertions` 인터페이스 참조)
3. `npm run eval`로 dry-run 통과 확인 → `npm run eval:live`로 실제 채점

## 신규 Assertion 추가 방법

1. `evals/assertions.ts`의 `FixtureAssertions` 인터페이스에 필드 추가
2. `runFixtureSpecific()`에 검증 로직 추가
3. `buildMockResponse()`도 새 assertion이 통과하도록 보완 (dry-run 안정성)
4. 관련 fixture(들)의 `assertions{}`에 키 추가

## 비용 안내

- Dry-run: $0
- Live 1회 (6 fixture): 약 $0.005 (gpt-4o-mini), $0.05 (gpt-4o) 수준
- Prompt Caching이 활성화되어 2회차 이후 system 토큰 50% 할인 적용

비용은 종료 시 자동 출력됨 (`예상 비용: ~$X.XX (model 기준)`).

## CI 통합 (선택)

`npm run eval` (dry-run)을 CI pipeline에 포함하면 fixture/assertion 구조 오류만으로도 빌드 실패 처리 가능. Live 모드는 비용/시간 비용이 있어 PR 라벨 기반 트리거 권장.
