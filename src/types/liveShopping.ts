/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LiveChat Radar — 유튜브 라이브 쇼핑 전용 타입 계약 (S-1).
 *
 * 단일 출처(single source of truth): 백엔드 응답(server.ts) · OpenAI strict json_schema(src/prompts.ts)
 * · 프론트 hook(App.tsx)이 이 파일을 공유한다.
 *
 * AI 응답으로 채워지는 인터페이스(Shop* / Unanswered* / ProductInterest)는 OpenAI Structured Outputs
 * strict 모드와 1:1 매핑된다. strict는 옵셔널(`?`)을 허용하지 않으므로, 비어있을 수 있는 필드는
 * `| null`로 표현하고 schema에서 required + nullable(`type: ['x','null']`)로 둔다.
 * 단, `analyzedAt`처럼 서버가 응답 직후 주입하는 메타 필드는 schema에 포함하지 않고 TS에서만 옵셔널로 둔다.
 *
 * 설계 근거: docs/plans/liveshopping-pivot.md 6~7절.
 */

// ── 분류 축 & 세부 태그 (6축 × 37 태그) ───────────────────────────────────────

export type ShopAxis = 'funnel' | 'product' | 'price' | 'logistics' | 'trust' | 'stream';

/** 축 1. 구매 퍼널 — 의사결정 단계 (전환 온도/판매 추정의 핵심) */
export type FunnelTag =
  | 'interest'              // 관심 표명
  | 'consideration'        // 적극 고려
  | 'purchase_intent'      // 구매 임박
  | 'purchased'            // 구매 인증 (실판매 추정 지표)
  | 'repurchase'           // 재구매/단골
  | 'cart_abandon_signal'; // 이탈 신호

/** 축 2. 상품·옵션 문의 */
export type ProductTag =
  | 'option_question'        // 색상/사이즈/구성/용량
  | 'stock_question'         // 재고/품절/수량
  | 'restock_request'        // 재입고/앵콜
  | 'spec_question'          // 소재/성분/스펙/사용법
  | 'comparison_question'    // 옵션 간·타사 대비 비교
  | 'usage_scenario'         // 적합성 ("○○한테 써도 되나요")
  | 'product_switch_request';// "아까 그 상품 다시"

/** 축 3. 가격·프로모션 */
export type PriceTag =
  | 'price_question'      // 가격/단가
  | 'price_resistance'    // 가격 저항 ("비싸다")
  | 'discount_request'    // 추가 할인/쿠폰 요청
  | 'promo_question'      // 사은품/적립/세트 혜택
  | 'lowest_price_check'  // 최저가/라방가 검증
  | 'deadline_question';  // "이 가격 언제까지"

/** 축 4. 배송·CS·결제 */
export type LogisticsTag =
  | 'delivery_question'  // 배송비/기간/지역
  | 'bundle_delivery'    // 묶음/합배송
  | 'exchange_return'    // 교환/반품/AS
  | 'payment_issue'      // 결제 오류/장애
  | 'link_request'       // 구매 링크/위치
  | 'order_help';        // 주문 방법/단계

/** 축 5. 신뢰·반론 (망설임 클로징의 핵심) */
export type TrustTag =
  | 'social_proof'        // 실사용 후기/추천
  | 'doubt_authenticity'  // 정품/효과 의심
  | 'hesitation_price'    // 가격 망설임
  | 'hesitation_need'     // 필요성 망설임
  | 'hesitation_trust'    // 신뢰 망설임
  | 'negative_review';    // 부정 경험/불만

/** 축 6. 방송·운영 */
export type StreamTag =
  | 'stream_issue'         // 음향/화면/끊김
  | 'engagement'           // 인사/호응/이벤트 참여
  | 'spam_promo'           // 도배/외부·경쟁사 홍보
  | 'abuse_troll'          // 비방/어그로/트롤
  | 'host_question_direct';// 호스트 지목 질문

/** 어느 축에도 안 맞는 댓글 */
export type ShopTag =
  | FunnelTag
  | ProductTag
  | PriceTag
  | LogisticsTag
  | TrustTag
  | StreamTag
  | 'other';

export type Sentiment = 'positive' | 'neutral' | 'negative';
export type UrgencyLevel = 'low' | 'medium' | 'high';
export type ShopMetricStatus = 'good' | 'normal' | 'warning' | 'danger';

/** 태그 enum 단일 출처 — schema enum/시뮬레이터/검증이 이 배열을 공유한다. (강제 망라 체크 포함) */
export const SHOP_AXES: readonly ShopAxis[] = ['funnel', 'product', 'price', 'logistics', 'trust', 'stream'];

export const SHOP_TAGS: readonly ShopTag[] = [
  // funnel
  'interest', 'consideration', 'purchase_intent', 'purchased', 'repurchase', 'cart_abandon_signal',
  // product
  'option_question', 'stock_question', 'restock_request', 'spec_question', 'comparison_question', 'usage_scenario', 'product_switch_request',
  // price
  'price_question', 'price_resistance', 'discount_request', 'promo_question', 'lowest_price_check', 'deadline_question',
  // logistics
  'delivery_question', 'bundle_delivery', 'exchange_return', 'payment_issue', 'link_request', 'order_help',
  // trust
  'social_proof', 'doubt_authenticity', 'hesitation_price', 'hesitation_need', 'hesitation_trust', 'negative_review',
  // stream
  'stream_issue', 'engagement', 'spam_promo', 'abuse_troll', 'host_question_direct',
  // fallback
  'other',
] as const;

/** 각 태그가 속한 축. 분포 집계/색상 매핑에 사용. */
export const TAG_AXIS: Record<ShopTag, ShopAxis> = {
  interest: 'funnel', consideration: 'funnel', purchase_intent: 'funnel', purchased: 'funnel', repurchase: 'funnel', cart_abandon_signal: 'funnel',
  option_question: 'product', stock_question: 'product', restock_request: 'product', spec_question: 'product', comparison_question: 'product', usage_scenario: 'product', product_switch_request: 'product',
  price_question: 'price', price_resistance: 'price', discount_request: 'price', promo_question: 'price', lowest_price_check: 'price', deadline_question: 'price',
  delivery_question: 'logistics', bundle_delivery: 'logistics', exchange_return: 'logistics', payment_issue: 'logistics', link_request: 'logistics', order_help: 'logistics',
  social_proof: 'trust', doubt_authenticity: 'trust', hesitation_price: 'trust', hesitation_need: 'trust', hesitation_trust: 'trust', negative_review: 'trust',
  stream_issue: 'stream', engagement: 'stream', spam_promo: 'stream', abuse_troll: 'stream', host_question_direct: 'stream',
  other: 'stream',
};

// ── 입력 계약: 방송 등록 상품 ─────────────────────────────────────────────────

/** 상품 사전 등록 예상 질문·답변 (G-4-3 스크립트 어시스트) */
export interface PresetFaq {
  q: string;
  a: string;
}

/** 방송 시작 시 셀러가 등록하는 상품. 분석 호출의 컨텍스트로 AI에 함께 전달된다. */
export interface LiveProduct {
  id: string;
  name: string;
  price?: number;
  options?: string[];        // ['블랙/M', '화이트/L', …]
  isActive?: boolean;        // 현재 소개 중 상품
  sellingPoints?: string[];  // G-4-3 셀링포인트 (한 번에 읽기용)
  presetFaqs?: PresetFaq[];  // G-4-3 예상 질문·답변 (자동 매칭용)
}

/** G-4-4 멀티상품 타임블록 — 활성 상품이 소개된 구간 */
export interface ProductBlock {
  id: string;
  productId: string;
  name: string;
  startedAt: string;        // ISO
  endedAt: string | null;   // null = 현재 방송중
}

// ── AI 응답 계약 (OpenAI strict json_schema와 1:1) ────────────────────────────

/** 댓글 1건의 6축 태깅 + 상품/옵션 매칭 결과 */
export interface ShopCommentAnalysis {
  id: string;
  text: string;
  author: string | null;
  timestamp: string;
  axis: ShopAxis;
  tag: ShopTag;
  productId: string | null;   // 매칭된 등록 상품 id (없으면 null)
  optionLabel: string | null; // 매칭된 옵션 라벨 (없으면 null)
  sentiment: Sentiment;
  urgency: UrgencyLevel;
  isQuestion: boolean;        // 미응답 큐 적재 후보 여부
  answered: boolean | null;   // 호스트 응답 매칭 여부 (미정 시 null)
}

/** KPI 대시보드 메트릭 1개 */
export interface ShopMetric {
  id: string;
  label: string;
  value: number | string;   // 수치형 KPI 또는 "지금"/"대기" 같은 신호 라벨
  unit: string | null;      // '%','건' 등 (없으면 null)
  description: string;
  status: ShopMetricStatus;
}

/** 실시간 액션(처방 멘트) 카드 */
export interface ShopActionCard {
  id: string;
  priority: UrgencyLevel;
  title: string;
  reason: string;            // 근거 (관련 댓글 n건 등)
  suggestedLine: string;     // 호스트가 바로 말할 처방 멘트
  evidence: string[];        // 근거 댓글 원문
  targetProductId: string | null; // 관련 상품 (전체 대상이면 null)
}

/** 미응답 질문 큐 항목 */
export interface UnansweredQuestion {
  id: string;
  text: string;
  author: string | null;
  askedAt: string;
  productId: string | null;
  tag: ShopTag;
  urgency: UrgencyLevel;
  suggestedAnswer: string | null; // FAQ 매칭 추천 답변 (없으면 null)
}

/** 상품별 관심 랭킹 ("다음에 띄울 상품" 우선순위) */
export interface ProductInterest {
  productId: string;
  name: string;
  interestScore: number;   // 0-100 정규화
  questionCount: number;
  purchasedCount: number;  // 해당 상품 구매 인증 댓글 수
}

/** 상품 FAQ 후보 */
export interface ShopFaqItem {
  question: string;
  count: number;
  templateAnswer: string;
  productId: string | null;
}

/** /api/analyze (쇼핑) 응답 최상위 — analyzedAt만 서버 주입 메타. */
export interface ShopAnalysisResult {
  analyses: ShopCommentAnalysis[];
  metrics: ShopMetric[];
  actionCards: ShopActionCard[];
  unanswered: UnansweredQuestion[];
  productInterest: ProductInterest[];
  faq: ShopFaqItem[];
  recentSummary: string;
  conversionAdvice: string;  // 지금 클로징 전략 한 줄
  analyzedAt?: string;       // 서버가 응답 직후 주입 (strict schema 비포함)
}

// ── 타임라인 스냅샷 (B-4 쇼핑 축 확장) ────────────────────────────────────────

export interface ShopTimelinePoint {
  t: number;               // Unix ms
  cpm: number;             // 분당 댓글 수
  purchaseTemp: number;    // 구매 온도 %
  priceResistance: number; // 가격 저항 건수
  unansweredCount: number; // 미응답 질문 누적
  purchased: number;       // 구매 인증 누적(추정 판매) — 모멘텀 산출용
}

// ── 전환 퍼널 (G-2-1) ────────────────────────────────────────────────────────

/** 시청자 단위 구매 퍼널 단계별 인원 + 추정 전환율 */
export interface ConversionFunnel {
  interest: number;       // 관심 이상 도달 시청자
  consideration: number;  // 고려 이상
  intent: number;         // 구매 임박 이상
  purchased: number;      // 구매 완료
  conversionRate: number; // purchased / interest * 100 (0-100)
}

// ── 클로징 윈도우 (G-2-3) ────────────────────────────────────────────────────

/** 지금이 구매 유도(클로징) 적기인지 감지한 결과 */
export interface ClosingWindow {
  open: boolean;          // 클로징 타이밍 도달 여부
  score: number;          // 강도 0-100
  reasons: string[];      // 근거 (구매 온도/마감/재고/타이밍)
  suggestedLine: string;  // 바로 칠 클로징 멘트
}

// ── 멘트 효과 마킹 (G-2-4) ───────────────────────────────────────────────────

/** 호스트가 혜택 멘트를 친 시점 마킹 — 직후 구매/온도 변화로 효과 측정 */
export interface MentionMark {
  id: string;
  label: string;            // 쿠폰/한정/사은품/가격 강조 등
  at: string;               // ISO
  baselinePurchased: number;// 마킹 시점 누적 구매 인증
  baselineTemp: number;     // 마킹 시점 구매 온도
}

// ── 시청자(댓글러) 인텔리전스 (G-1) ──────────────────────────────────────────

export type ViewerFlag = 'hot_lead' | 'regular' | 'troll' | 'normal';

/** author 단위로 누적 집계한 시청자 프로필 (핫리드 보드). 클라이언트에서 analyses로부터 파생. */
export interface ViewerProfile {
  author: string;
  commentCount: number;
  firstSeen: string;
  lastSeen: string;
  leadScore: number;                 // 0-100 구매 가능성 점수
  funnelStage: FunnelTag | 'none';   // 도달한 최고 퍼널 단계
  interestedProductIds: string[];    // 관심 보인 상품 id
  topTags: ShopTag[];                // 자주 단 태그 상위
  hesitationReasons: TrustTag[];     // hesitation_* 사유
  hasUnanswered: boolean;            // 미응답 질문 보유
  isReturning: boolean;              // 단골/재구매
  isPurchaser: boolean;              // 구매 인증
  isMember: boolean;                 // 멤버십(sponsor)
  flag: ViewerFlag;
}

// ── 종료 리포트 (S-7, 쇼핑 성과 중심) ─────────────────────────────────────────

/** 리포트 상단 요약 통계 — 쇼핑 성과 지표 */
export interface ShopReportSummaryStats {
  totalMessages: number;
  estimatedSales: number;  // 구매 인증 댓글 수 기반 추정 판매 건수
  topProduct: string;      // 관심도 최상위 상품명 (없으면 '-')
  unansweredCount: number; // 미응답으로 남은 질문 수
  answerRate: number;      // 질문 응답률 % (0-100)
  peakCpm: number;
}

/** /api/report/shop 응답 — reportMarkdown은 판매 성과 섹션 전체를 포함. */
export interface ShopReportResult {
  reportMarkdown: string;
  summaryStats: ShopReportSummaryStats;
  generatedAt?: string;    // 서버 주입 메타 (strict schema 비포함)
}

// ── 종료 후 심화 분석 (G-3, 세션 데이터에서 클라이언트 파생) ───────────────────

export interface GoldenMoment {
  t: number;              // Unix ms
  purchasedDelta: number;// 그 구간 구매 인증 증가
  temp: number;          // 그 시점 구매 온도
  mention: string | null;// 직전 호스트 멘트 마킹 (있으면)
}

export interface TimeBucket {
  label: string;         // "구간 1" 또는 시각 범위
  avgTemp: number;       // 평균 구매 온도
  purchased: number;     // 그 구간 구매 인증 증가
}

export interface PostLiveInsights {
  goldenMoments: GoldenMoment[];
  timeBuckets: TimeBucket[];
  dropOff: { detected: boolean; note: string };
  checklist: string[];   // 다음 방송 액션 체크리스트
}
