# LiveChat Radar → 유튜브 라이브 쇼핑 전용 재기획

> 작성일 2026-06-27 · 상태: 기획 확정 대기 · 후속: 단계별 풀스택 구현

## 0. 방향 전환 요약 (Pivot)

| 항목 | AS-IS (현재) | TO-BE (목표) |
|------|--------------|--------------|
| 제품 정체성 | 범용 라이브 조연출 (커머스/교육/팬덤/이슈 4모드) | **유튜브 라이브 쇼핑 전용 AI 판매 조연출** |
| 모드 선택 | `ModeSelector`로 목적 전환 | 모드 개념 제거. 진입 즉시 쇼핑 대시보드 |
| 분석 단위 | 방송 전체 단일 흐름 | **상품(SKU) × 옵션(색/사이즈/구성) 단위** 다층 분석 |
| 커머스 카테고리 | 10개 (price/purchase/delivery…) | **6개 축 · 30+ 세부 태그**로 확장 |
| 핵심 가치 | "지금 무슨 말을 할까" | "지금 **무슨 말을 해서 무엇을 팔까** + 놓친 질문 0건" |

**결정 사항 (확정):**
1. 멀티상품 + 옵션 단위 분석 지원 (현재 소개 중인 상품 추적 포함)
2. 기존 교육/팬덤/이슈 모드 및 `ModeSelector` **완전 제거**
3. 이 문서는 기획 산출물. 구현은 이후 단계별 진행

---

## 1. 제품 비전 & 핵심 사용자

**한 줄 비전:** 라이브 쇼핑 호스트 옆에서 "지금 이 상품을 팔기 위해, 어떤 망설임을 어떤 멘트로 풀고, 어떤 질문에 먼저 답해야 하는지"를 1초 단위로 처방하는 AI 판매 조연출.

**핵심 사용자 (1차):** 1인~소규모 라이브 커머스 셀러 / 쇼호스트. 채팅을 직접 읽으며 진행하느라 질문을 놓치고, 망설이는 시청자를 클로징하지 못하는 사람.

**대표 시나리오:**
- 호스트가 A상품 소개 중인데 채팅엔 B상품 재입고 문의가 쌓임 → "B 재입고 문의 5건, 잠깐 안내 필요" 알림
- "이거 세일 끝나면 얼마예요?" 류 가격 저항이 급증 → 클로징 멘트 카드 처방
- 답변 안 된 질문이 큐에 쌓임 → 미응답 질문 큐 + 추천 답변 템플릿
- 방송 종료 → 상품별 전환 추정·미응답 질문·망설임 사유·다음 방송 개선점 리포트

---

## 2. 분석 체계 (핵심) — 6축 × 세부 태그 Taxonomy

라이브 쇼핑 채팅을 6개 대분류 축으로 나누고, 각 축 아래 세부 태그를 둔다. 각 댓글은 **(축, 세부태그, 대상 상품, 대상 옵션, 감정, 긴급도, 액션필요)** 로 분해된다.

### 축 1. 구매 퍼널 (Purchase Funnel)
구매 의사결정 단계. 전환 온도 산정의 핵심.
| 세부 태그 | 의미 | 예시 |
|-----------|------|------|
| `interest` | 관심 표명 | "오 예쁘다", "이거 궁금" |
| `consideration` | 적극 고려 | "이거 살까 말까", "장바구니 담음" |
| `purchase_intent` | 구매 임박 | "지금 결제할게요", "주문 들어갑니다" |
| `purchased` | **구매 인증** (실판매 추정 지표) | "샀어요", "결제 완료", "주문번호 뜸" |
| `repurchase` | 재구매/단골 | "또 샀어요", "지난번에 좋아서 또" |
| `cart_abandon_signal` | 이탈 신호 | "다음에", "고민해볼게요", "담에 살게요" |

### 축 2. 상품·옵션 문의 (Product & Option)
어떤 상품·옵션이 화제인지. 멀티상품 라이브의 핵심.
| 세부 태그 | 의미 |
|-----------|------|
| `option_question` | 색상/사이즈/구성/용량 문의 |
| `stock_question` | 재고/품절/수량 문의 |
| `restock_request` | 재입고/앵콜 요청 |
| `spec_question` | 소재/성분/스펙/사용법 문의 |
| `comparison_question` | 옵션 간·타사 대비 비교 |
| `usage_scenario` | "○○한테 써도 되나요" 적합성 문의 |
| `product_switch_request` | "아까 그 상품 다시 보여주세요" |

### 축 3. 가격·프로모션 (Price & Promo)
| 세부 태그 | 의미 |
|-----------|------|
| `price_question` | 가격/단가 문의 |
| `price_resistance` | 가격 저항 ("비싸다", "할인 없어요?") |
| `discount_request` | 추가 할인/쿠폰 요청 |
| `promo_question` | 사은품/적립/세트 혜택 문의 |
| `lowest_price_check` | 최저가/라방가 검증 ("다른 데가 더 싸던데") |
| `deadline_question` | "이 가격 언제까지예요?" 마감 문의 |

### 축 4. 배송·CS·결제 (Logistics & CS)
| 세부 태그 | 의미 |
|-----------|------|
| `delivery_question` | 배송비/기간/지역 문의 |
| `bundle_delivery` | 묶음/합배송 문의 |
| `exchange_return` | 교환/반품/AS 정책 문의 |
| `payment_issue` | 결제 오류/장애 호소 |
| `link_request` | 구매 링크/위치 문의 |
| `order_help` | 주문 방법/단계 안내 요청 |

### 축 5. 신뢰·반론 (Trust & Objection)
망설임 클로징의 핵심. 반론 처리(objection handling) 멘트와 직결.
| 세부 태그 | 의미 |
|-----------|------|
| `social_proof` | 실사용 후기/추천 ("저 이거 진짜 좋아요") |
| `doubt_authenticity` | 정품/효과 의심 ("진짜 효과 있어요?", "광고 아님?") |
| `hesitation_price` | 가격 때문에 망설임 |
| `hesitation_need` | 필요성 망설임 ("살까 말까 필요할까") |
| `hesitation_trust` | 신뢰 때문에 망설임 |
| `negative_review` | 부정 경험/불만 ("저번에 별로였어요") |

### 축 6. 방송·운영 (Stream & Moderation)
| 세부 태그 | 의미 |
|-----------|------|
| `stream_issue` | 음향/화면/끊김 ("안 들려요", "화면 멈춤") |
| `engagement` | 인사/호응/이벤트 참여 ("1빠", "이벤트 참여") |
| `spam_promo` | 도배/외부·경쟁사 홍보 |
| `abuse_troll` | 비방/어그로/트롤 |
| `host_question_direct` | 호스트 지목 질문 ("사장님 이거요") |

> **미분류 처리:** 어느 태그에도 안 맞으면 `other`. 시뮬레이터/AI 모두 `other` 허용 (strict 스키마 enum에 포함).

---

## 3. 실시간 메트릭 (KPI 대시보드)

방송 전체 단위 핵심 지표. 상태(good/normal/warning/danger)로 색상 처방.

| 메트릭 | 산식 (개념) | 의미 |
|--------|-------------|------|
| **구매 온도** | purchase_intent·purchased 가중합 / CPM 정규화 | 지금 클로징해야 할 열기 |
| **실시간 판매 추정** | `purchased` 태그 카운트 (누적/분당) | 구매 인증 댓글 기반 추정 판매량 |
| **전환 타이밍 신호** | 온도 + 임박 누적 임계 도달 시 "지금" | 구매 유도 멘트 타이밍 |
| **가격 저항도** | price_resistance·discount_request 비율 | 가격 방어 멘트 필요도 |
| **망설임 지수** | hesitation_* 합산 (사유별 분해) | 반론 처리 필요도 |
| **미응답 질문 수** | 질문류 중 호스트 응답 매칭 안 된 수 | **0 유지가 목표** |
| **신뢰 위험도** | doubt_authenticity·negative_review | 신뢰 회복 멘트 필요도 |
| **상품별 관심 랭킹** | 상품별 (interest+consideration+question) | 다음에 띄울 상품 우선순위 |
| **채팅 활성도(CPM)** | 분당 댓글 수 | 기존 유지, 타임라인 X축 |

---

## 4. 실시간 액션 카드 (조연출 어시스트)

규칙 기반 트리거 + 추천 멘트(suggestedLine). 라이브 쇼핑 특화 규칙으로 전면 교체.

| 규칙 ID | 트리거 | 처방 멘트 예시 |
|---------|--------|----------------|
| `restock-demand` | restock_request 임계 초과 | "○○ 재입고 문의 많으세요. 알림 신청 방법 안내드릴게요." |
| `price-defense` | price_resistance 급증 | "가격 부담되실 수 있는데, 오늘 방송가에 ○○까지 포함된 구성이에요." |
| `closing-now` | 구매 온도 임계 + 마감 임박 | "지금 결제하신 분들 많아요. 수량 한정이라 지금이 가장 좋은 타이밍이에요." |
| `objection-trust` | doubt_authenticity 감지 | "효과 의심되실 수 있어요. 실사용 후기랑 성분표 잠깐 보여드릴게요." |
| `unanswered-flush` | 미응답 질문 큐 적체 | "질문 몇 개 놓쳤네요. 지금 한 번에 정리해서 답변드릴게요." |
| `product-pivot` | 다른 상품 문의 집중 | "○○ 상품 문의 많으신데, 이거 먼저 짧게 보고 갈게요." |
| `stream-fix` | stream_issue 급증 | "음향/화면 확인 중입니다. 잠시만요." |

각 카드: `{ priority, title, reason(근거 댓글 n건), suggestedLine, evidence[], targetProduct? }`

---

## 5. 미응답 질문 큐 (신규 핵심 기능)

라이브 쇼핑 호스트의 1번 페인 = "질문 놓침". 별도 패널로 승격.
- 질문류 태그(option/spec/price/delivery/exchange/host_question…) 댓글을 큐에 적재
- 호스트 발화(수동 체크 or 향후 STT)로 응답 처리 → 큐에서 제거
- 미응답 시간 경과 → 긴급도 상승(노랑→빨강)
- 각 질문에 **추천 답변 템플릿**(FAQ 매칭) 자동 첨부
- 상품/옵션 태그로 그룹핑

---

## 6. 데이터 모델 설계 (src/types)

기존 `liveRadar.ts`의 멀티모드 타입을 라이브 쇼핑 전용으로 대체.

```ts
// 6축 enum
export type FunnelTag = 'interest'|'consideration'|'purchase_intent'|'purchased'|'repurchase'|'cart_abandon_signal';
export type ProductTag = 'option_question'|'stock_question'|'restock_request'|'spec_question'|'comparison_question'|'usage_scenario'|'product_switch_request';
export type PriceTag = 'price_question'|'price_resistance'|'discount_request'|'promo_question'|'lowest_price_check'|'deadline_question';
export type LogisticsTag = 'delivery_question'|'bundle_delivery'|'exchange_return'|'payment_issue'|'link_request'|'order_help';
export type TrustTag = 'social_proof'|'doubt_authenticity'|'hesitation_price'|'hesitation_need'|'hesitation_trust'|'negative_review';
export type StreamTag = 'stream_issue'|'engagement'|'spam_promo'|'abuse_troll'|'host_question_direct';
export type ShopTag = FunnelTag|ProductTag|PriceTag|LogisticsTag|TrustTag|StreamTag|'other';
export type ShopAxis = 'funnel'|'product'|'price'|'logistics'|'trust'|'stream';

export interface LiveProduct {           // 방송 상품 등록
  id: string; name: string; price?: number;
  options?: string[];                    // ['블랙/M', '화이트/L', …]
  isActive?: boolean;                    // 현재 소개 중 상품
}

export interface ShopCommentAnalysis {
  id: string; text: string; author?: string; timestamp: string;
  axis: ShopAxis; tag: ShopTag;
  productId?: string;                    // 매칭된 상품
  optionLabel?: string;                  // 매칭된 옵션
  sentiment: 'positive'|'neutral'|'negative';
  urgency: 'low'|'medium'|'high';
  isQuestion: boolean;                   // 미응답 큐 적재 여부
  answered?: boolean;
}

export interface ShopMetric { id; label; value; unit?; description; status; }
export interface ShopActionCard { id; priority; title; reason; suggestedLine; evidence[]; targetProductId?; }
export interface UnansweredQuestion { id; text; author?; askedAt; productId?; tag; urgency; suggestedAnswer?; }
export interface ProductInterest { productId; name; interestScore; questionCount; purchasedCount; }
```

타임라인(B-4) 스냅샷도 쇼핑 축으로 확장: `purchaseTemp`, `priceResistance`, `unansweredCount`, 상품별 관심 시계열.

---

## 7. AI 스키마 설계 (OpenAI Structured Outputs, strict)

`server.ts`의 분석 엔드포인트를 쇼핑 전용 단일 스키마로 교체. (`openai-schema-design` 스킬 패턴 준수: 모든 객체 `additionalProperties:false`, 전 필드 `required`, enum 고정)

응답 최상위 필드:
```
{
  analyses: ShopCommentAnalysis[],   // 댓글별 6축 태깅 + 상품/옵션 매칭
  metrics: ShopMetric[],             // 9개 KPI
  actionCards: ShopActionCard[],     // 우선순위 3개
  unanswered: UnansweredQuestion[],  // 미응답 질문 큐 + 추천 답변
  productInterest: ProductInterest[],// 상품별 관심 랭킹
  faq: { question; count; templateAnswer; productId? }[],
  recentSummary: string,
  conversionAdvice: string           // 지금 클로징 전략 한 줄
}
```
- 입력 컨텍스트에 **등록된 상품/옵션 목록**을 함께 전달 → AI가 `productId`/`optionLabel` 매칭
- `gpt-4o-mini` 우선 / `gpt-4o` 폴백, Prompt Caching(A-1) systemPrompt 분리 유지
- 키 미설정 시 `generateSimulated…` 시뮬레이터가 동일 shape 반환 (키워드 규칙 기반, 현 `analyzeComments.ts` 확장)

---

## 8. 대시보드 UI 구성 (High Density 다크)

`ModeSelector`/`ModeDashboard` 제거. 새 단일 레이아웃:

```
┌─ 상단: 상품 바 (등록 상품 칩, 현재 소개중 하이라이트) ────────────┐
├─ KPI 스트립: 구매온도 · 판매추정 · 미응답수 · 가격저항 · 망설임 ──┤
├─ 좌(2/3) ─────────────────────┬─ 우(1/3) ──────────────────────┤
│ ① 실시간 액션 카드 (처방 멘트) │ ③ 미응답 질문 큐 (긴급도순)     │
│ ② 6축 분포 + 상품별 관심 랭킹  │ ④ 라이브 피드 (태그 색상칩)     │
├─ 하단: 타임라인 (구매온도/가격저항/미응답 추이) ────────────────┤
└──────────────────────────────────────────────────────────────┘
```
- 상품 등록 모달: 방송 시작 시 상품명/가격/옵션 입력 (멀티상품)
- 색상 시스템: 축별 색(퍼널=시안, 가격=앰버, 신뢰=바이올렛, 운영=슬레이트)
- 기존 `react-high-density-ui` 디자인 토큰(#020617, JetBrains Mono, 글로우) 준수

---

## 9. 종료 리포트 (Post-Live)

쇼핑 성과 중심으로 재구성:
1. **판매 추정 요약** — 구매 인증 댓글 수, 상품별 분해, 피크 구간
2. **상품별 성과** — 관심도·질문수·전환 추정 랭킹
3. **놓친 기회** — 미응답 질문 TOP, 응답률, 이탈(cart_abandon) 구간
4. **망설임·반론 분석** — 사유별 분해(가격/필요성/신뢰) + 대응 권장
5. **가격/프로모션 반응** — 가격 저항 구간, 효과적이었던 혜택 멘트
6. **상품 FAQ 후보** — 다음 방송 사전 안내용
7. **다음 라이브 개선점**

---

## 10. 단계별 구현 로드맵

| 단계 | 범위 | 산출물 |
|------|------|--------|
| **S-1 타입/스키마** | `liveRadar.ts` 쇼핑 타입 교체, `LiveProduct` 추가, AI json_schema strict 설계 | types + server 스키마 단일 계약 |
| **S-2 시뮬레이터** | `analyzeComments.ts` → 6축 키워드 규칙 + 상품/옵션 매칭 시뮬레이터 | 키 없이 동작하는 데모 |
| **S-3 백엔드** | `server.ts` 쇼핑 분석 엔드포인트 + 상품 컨텍스트 입력 + 리포트 | /api 교체 |
| **S-4 모드 제거** | `ModeSelector`/`liveModes` 교육·팬덤·이슈 삭제, `App.tsx` 단일화 | 멀티모드 제거 |
| **S-5 핵심 UI** | 상품 바·KPI 스트립·액션카드·6축 분포 | 메인 대시보드 |
| **S-6 미응답 큐** | 질문 큐 패널 + 추천 답변 + 긴급도 | 신규 핵심 패널 |
| **S-7 타임라인/리포트** | 쇼핑 축 타임라인 + 종료 리포트 재구성 | 성과 분석 |
| **S-8 QA/Eval** | `livechat-qa-validation` + evals fixture를 쇼핑용으로 교체 | 경계면 정합성 |

각 단계는 `livechat-feature-build` 5인 팀 워크플로우로 진행. S-1이 모든 단계의 선행.

---

## 11. 변경 영향 범위 (파일)

- **교체:** `src/types/liveRadar.ts`, `src/config/liveModes.ts`(→`liveShopping.ts`), `src/lib/analyzeComments.ts`, `src/lib/generateActionCards.ts`, `src/prompts.ts`
- **제거:** `src/components/ModeSelector.tsx`, 멀티모드 분기 (`ModeDashboard` 일부)
- **신규:** 상품 등록 모달, 미응답 큐 패널, 상품 관심 랭킹 카드
- **수정:** `src/App.tsx`(단일화), `server.ts`(엔드포인트/스키마/리포트), `src/components/TimelineDashboard.tsx`(축 확장), `src/types.ts`(레거시 `AnalysisResult` 정리), `evals/*`
- **문서:** `README.md`, `docs/roadmap.md` 변경 이력, `CLAUDE.md` 하네스 메모

---

## 12. 미해결/추후 결정

- **호스트 응답 매칭**: 1차는 수동 체크(큐에서 클릭 제거), 추후 STT/YouTube 호스트 메시지 자동 매칭
- **실판매 연동**: `purchased` 태그 기반 추정 → 추후 스마트스토어/쇼핑API 실데이터 연동 여지
- **상품 자동 인식**: 1차는 수동 등록, 추후 방송 화면 OCR/제목 파싱
