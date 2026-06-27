/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LiveChat Radar — 라이브 쇼핑 전용 로컬 시뮬레이터 (S-2).
 *
 * OPENAI_API_KEY 미설정 / 호출 실패 시 폴백으로 동작하여 DEMO MODE를 보장한다.
 * 출력은 src/types/liveShopping.ts 의 `ShopAnalysisResult` 와 1:1, 즉 OpenAI strict
 * json_schema(`shopAnalyzeJsonSchema`)와 동일 shape를 키워드 규칙으로 채운다.
 *
 * 결정성: 테스트 가능성을 위해 Math.random 을 쓰지 않는다.
 * 단일 출처: 태그 enum/축 매핑은 liveShopping.ts 의 SHOP_TAGS / TAG_AXIS 를 재사용.
 */

import {
  LiveProduct,
  ProductInterest,
  Sentiment,
  ShopActionCard,
  ShopAnalysisResult,
  ShopCommentAnalysis,
  ShopFaqItem,
  ShopMetric,
  ShopMetricStatus,
  ShopReportResult,
  ShopTag,
  TAG_AXIS,
  UnansweredQuestion,
  UrgencyLevel,
} from '../types/liveShopping.js';

/** 서버 메시지 느슨한 형태 (server.ts 의 message 객체와 호환) */
export interface ShopRawMessage {
  id?: string;
  author?: string;
  message?: string;
  timestamp?: string;
}

type TagRule = {
  tag: ShopTag;
  keywords: string[];
  sentiment?: Sentiment;
  urgency?: UrgencyLevel;
  isQuestion?: boolean;
};

/**
 * 태그 판정 규칙. 위에서부터 첫 매칭이 채택되므로 더 구체적/강한 신호를 앞에 둔다.
 * (예: '구매완료' purchased 가 일반 '구매' purchase_intent 보다 먼저)
 */
const TAG_RULES: TagRule[] = [
  // ── 축 6. 방송·운영 (기술 이슈는 최우선 감지) ──
  { tag: 'stream_issue', keywords: ['안 들려', '안들려', '소리', '음량', '마이크', '끊겨', '끊김', '멈춤', '버퍼링', '랙', '싱크', '화면이'], sentiment: 'negative', urgency: 'high' },
  { tag: 'payment_issue', keywords: ['결제가 안', '결제 안', '결제안', '결제 오류', '결제 에러', '주문이 안', '에러 나', '오류 나'], sentiment: 'negative', urgency: 'high', isQuestion: true },

  // ── 축 1. 구매 퍼널 ──
  { tag: 'purchased', keywords: ['샀어', '샀습니다', '구매완료', '구매 완료', '결제했', '결제 완료', '결제완료', '주문했', '주문 완료', '주문완료', '주문번호', '득템', '겟했', '질렀'], sentiment: 'positive', urgency: 'low' },
  { tag: 'repurchase', keywords: ['또 샀', '또 구매', '재구매', '저번에 사', '지난번에', '단골', '벌써 두 번'], sentiment: 'positive', urgency: 'low' },
  { tag: 'purchase_intent', keywords: ['지금 살게', '살게요', '결제할게', '주문할게', '구매할게', '주문 들어', '담을게', '살래요', '바로 산다'], sentiment: 'positive', urgency: 'medium' },
  { tag: 'cart_abandon_signal', keywords: ['다음에', '담에 살', '나중에 살', '고민해볼', '보류', '안 살래', '패스'], sentiment: 'neutral', urgency: 'medium' },

  // ── 축 5. 신뢰·반론 ──
  { tag: 'doubt_authenticity', keywords: ['진짜 효과', '효과 있나', '광고 아니', '정품 맞', '믿어도', '가짜 아니', '진짜에요', '협찬'], sentiment: 'negative', urgency: 'high', isQuestion: true },
  { tag: 'negative_review', keywords: ['별로였', '안 좋았', '실망', '품질이 별로', '저번엔 별로', '환불했었'], sentiment: 'negative', urgency: 'high' },
  { tag: 'hesitation_trust', keywords: ['믿고 사도', '사도 될까', '괜찮을까', '불안한데', '믿어도 될'], sentiment: 'neutral', urgency: 'high' },
  { tag: 'hesitation_price', keywords: ['비싸서 고민', '가격만 아니', '돈만 있으면', '가격때문에'], sentiment: 'neutral', urgency: 'high' },
  { tag: 'hesitation_need', keywords: ['필요할까', '쓸까 말까', '필요한가', '있어도 될까'], sentiment: 'neutral', urgency: 'medium' },
  { tag: 'social_proof', keywords: ['저도 써', '저 이거 써', '진짜 좋아요', '강추', '잘 쓰고', '만족해', '재구매각', '후기 좋'], sentiment: 'positive', urgency: 'low' },

  // ── 축 3. 가격·프로모션 ──
  { tag: 'price_resistance', keywords: ['비싸', '비싼', '부담', '가격이 좀', '비싸네', '헉 가격'], sentiment: 'negative', urgency: 'high' },
  { tag: 'lowest_price_check', keywords: ['최저가', '더 싸', '다른 데가', '라방가', '여기보다', '쿠팡이'], urgency: 'medium', isQuestion: true },
  { tag: 'discount_request', keywords: ['할인 없', '쿠폰 없', '더 깎', '세일 안', '할인 좀', '깎아'], urgency: 'medium', isQuestion: true },
  { tag: 'promo_question', keywords: ['사은품', '적립', '세트', '증정', '혜택', '덤', '1+1', '사은'], urgency: 'medium', isQuestion: true },
  { tag: 'deadline_question', keywords: ['언제까지', '마감', '오늘까지', '이 가격 언제', '몇 시까지'], urgency: 'medium', isQuestion: true },
  { tag: 'price_question', keywords: ['얼마', '가격', '단가', '값이', '가격이'], urgency: 'medium', isQuestion: true },

  // ── 축 2. 상품·옵션 ──
  { tag: 'restock_request', keywords: ['재입고', '앵콜', '다시 입고', '재입고 알림', '품절인데'], urgency: 'medium' },
  { tag: 'stock_question', keywords: ['재고', '품절', '남았', '수량', '몇 개 남', '솔드아웃'], urgency: 'medium', isQuestion: true },
  { tag: 'option_question', keywords: ['사이즈', '색상', '컬러', '옵션', '용량', '구성', '몇 호', '무슨 색', '어떤 색'], urgency: 'medium', isQuestion: true },
  { tag: 'spec_question', keywords: ['소재', '성분', '재질', '스펙', '사용법', '어떻게 쓰', '원산지', '세탁'], urgency: 'medium', isQuestion: true },
  { tag: 'comparison_question', keywords: ['비교', '차이', '뭐가 달라', '다른 거랑', '어떤 게 나', '둘 중'], urgency: 'medium', isQuestion: true },
  { tag: 'usage_scenario', keywords: ['써도 되나', '적합', '어울릴까', '한테 써', '피부에', '아이한테', '쓸 수 있'], urgency: 'medium', isQuestion: true },
  { tag: 'product_switch_request', keywords: ['아까 그', '이전 상품', '다시 보여', '전에 보여준', '그 상품 다시', '앞에 거'], urgency: 'medium', isQuestion: true },

  // ── 축 4. 배송·CS·결제 ──
  { tag: 'exchange_return', keywords: ['교환', '반품', '환불', 'AS', '하자', '불량', '안 맞으면'], urgency: 'medium', isQuestion: true },
  { tag: 'bundle_delivery', keywords: ['묶음', '합배송', '같이 배송', '합포장', '같이 보내'], urgency: 'medium', isQuestion: true },
  { tag: 'delivery_question', keywords: ['배송', '택배', '언제 와', '언제 도착', '배송비', '며칠', '도서산간'], urgency: 'medium', isQuestion: true },
  { tag: 'link_request', keywords: ['링크', '어디서 사', '구매처', '주소', '어디로', '고정 댓글'], urgency: 'medium', isQuestion: true },
  { tag: 'order_help', keywords: ['주문 어떻게', '어떻게 사', '주문 방법', '구매 방법', '결제 어떻게', '주문하는'], urgency: 'medium', isQuestion: true },

  // ── 축 6. 방송·운영 (나머지) ──
  { tag: 'host_question_direct', keywords: ['사장님', '호스트님', '판매자님', '쇼호스트', '님 이거'], urgency: 'medium', isQuestion: true },
  { tag: 'abuse_troll', keywords: ['관종', '나가라', '광고충', '에휴', '꺼져'], sentiment: 'negative', urgency: 'high' },
  { tag: 'spam_promo', keywords: ['맞구독', '구독해주면', '제 채널', '방문하면', '홍보합니다'], sentiment: 'negative', urgency: 'medium' },
  { tag: 'engagement', keywords: ['1빠', '첫 댓', '안녕하세', 'ㅎㅇ', '이벤트', '참여합니다', '응원'], sentiment: 'positive', urgency: 'low' },

  // ── 축 1. 구매 퍼널 (약한 신호는 뒤로) ──
  { tag: 'consideration', keywords: ['살까', '살까말까', '고민', '장바구니', '담아', '담음', '찜'], sentiment: 'neutral', urgency: 'medium' },
  { tag: 'interest', keywords: ['예쁘', '이쁘', '궁금', '갖고 싶', '탐난', '좋아 보', '대박', '와 이거'], sentiment: 'positive', urgency: 'low' },
];

const QUESTION_HINTS = ['?', '나요', '까요', '가요', 'en가요', '어떻게', '얼마', '언제', '어디', '되나', '되요', '될까'];

function isLikelyQuestion(text: string, ruleIsQuestion: boolean | undefined): boolean {
  if (ruleIsQuestion) return true;
  return QUESTION_HINTS.some((h) => text.includes(h));
}

/** 등록 상품/옵션과 댓글을 매칭. 상품명 토큰 또는 옵션 라벨이 텍스트에 포함되면 매칭. */
function matchProduct(text: string, products: LiveProduct[]): { productId: string | null; optionLabel: string | null } {
  for (const p of products) {
    const nameTokens = p.name.split(/\s+/).filter((t) => t.length >= 2);
    const nameHit = p.name.length >= 2 && (text.includes(p.name) || nameTokens.some((t) => text.includes(t)));
    let optionHit: string | null = null;
    for (const opt of p.options ?? []) {
      const parts = opt.split(/[\/,]/).map((s) => s.trim()).filter(Boolean);
      if (text.includes(opt) || parts.some((part) => part.length >= 1 && text.includes(part))) {
        optionHit = opt;
        break;
      }
    }
    if (nameHit || optionHit) {
      return { productId: p.id, optionLabel: optionHit };
    }
  }
  // 활성 상품이 있으면 옵션만 단독 매칭되는 경우를 위해 기본값으로 활성 상품 부여
  const active = products.find((p) => p.isActive);
  if (active) {
    for (const opt of active.options ?? []) {
      const parts = opt.split(/[\/,]/).map((s) => s.trim()).filter(Boolean);
      if (parts.some((part) => part.length >= 1 && text.includes(part))) {
        return { productId: active.id, optionLabel: opt };
      }
    }
  }
  return { productId: null, optionLabel: null };
}

function classify(text: string): TagRule {
  const rule = TAG_RULES.find((r) => r.keywords.some((k) => text.includes(k)));
  return rule ?? { tag: 'other', sentiment: 'neutral', urgency: 'low', keywords: [] };
}

function status(value: number, warningAt: number, dangerAt: number): ShopMetricStatus {
  if (value >= dangerAt) return 'danger';
  if (value >= warningAt) return 'warning';
  return value > 0 ? 'normal' : 'good';
}

/** 태그별 추천 답변 템플릿 (미응답 큐 / FAQ 용) */
function suggestedAnswerFor(tag: ShopTag): string | null {
  const map: Partial<Record<ShopTag, string>> = {
    price_question: '가격은 화면과 고정 댓글에 안내드리고 있어요. 오늘 방송가 기준으로 다시 한 번 짚어드릴게요!',
    discount_request: '추가 혜택 궁금하시죠? 지금 적용되는 할인과 쿠폰을 정리해서 안내드리겠습니다.',
    promo_question: '사은품/적립 혜택 문의 주셨네요. 지금 구성에 포함된 혜택을 바로 보여드릴게요.',
    deadline_question: '이 가격은 방송 중에만 적용되는 한정가예요. 마감 시간 다시 공지드리겠습니다!',
    option_question: '옵션(색상/사이즈/구성) 문의 감사합니다. 선택 가능한 옵션을 화면으로 정리해 드릴게요.',
    stock_question: '재고 확인해서 바로 알려드릴게요. 인기 옵션은 빠르게 소진될 수 있어요!',
    restock_request: '재입고 문의 많으세요. 알림 신청 방법을 안내드리겠습니다.',
    spec_question: '소재/사용법 관련해서 상세 정보 짚어드릴게요. 잠시만요!',
    comparison_question: '옵션 간 차이 비교해서 어떤 분께 어떤 게 잘 맞는지 설명드리겠습니다.',
    usage_scenario: '사용 적합 여부 문의 주셨네요. 어떤 상황에 잘 맞는지 알려드릴게요.',
    delivery_question: '배송은 보통 영업일 기준 안내드리며, 배송비/지역 조건 다시 정리해 드릴게요.',
    bundle_delivery: '여러 상품 함께 주문하시면 합배송 가능 여부 확인해서 안내드리겠습니다.',
    exchange_return: '교환/반품/AS 정책은 안심하셔도 됩니다. 기준을 짧게 안내드릴게요.',
    payment_issue: '결제 오류 불편드려 죄송해요. 새로고침 후 재시도 안내와 대체 방법을 알려드릴게요.',
    link_request: '구매는 고정 댓글의 링크에서 옵션 선택 후 진행하시면 됩니다!',
    order_help: '주문 방법 차근차근 안내드릴게요. 링크 → 옵션 선택 → 결제 순서예요.',
    lowest_price_check: '오늘 방송가는 구성과 혜택까지 포함된 가격이라 단순 비교보다 더 유리하실 수 있어요.',
    doubt_authenticity: '믿고 보실 수 있도록 실사용 후기와 정보(성분/인증) 잠깐 보여드릴게요.',
    host_question_direct: '네! 질문 확인했습니다. 바로 답변드릴게요.',
  };
  return map[tag] ?? null;
}

export function generateSimulatedShopAnalysis(
  rawMessages: ShopRawMessage[],
  products: LiveProduct[] = [],
): ShopAnalysisResult {
  const now = Date.now();
  const messages = (rawMessages ?? []).filter((m) => (m.message ?? '').trim().length > 0);

  // 빈 입력 처리
  if (messages.length === 0) {
    return {
      analyses: [],
      metrics: emptyMetrics(),
      actionCards: [],
      unanswered: [],
      productInterest: products.map((p) => ({ productId: p.id, name: p.name, interestScore: 0, questionCount: 0, purchasedCount: 0 })),
      faq: [],
      recentSummary: '수집된 실시간 댓글이 부족하여 분석 대기 중입니다.',
      conversionAdvice: '시청자 댓글이 모이면 구매 신호를 분석해 클로징 타이밍을 알려드립니다.',
      analyzedAt: new Date().toLocaleTimeString(),
    };
  }

  // 1. 댓글별 분류 + 상품/옵션 매칭
  const analyses: ShopCommentAnalysis[] = messages.map((m, i) => {
    const text = (m.message ?? '').trim();
    const rule = classify(text);
    const { productId, optionLabel } = matchProduct(text, products);
    return {
      id: m.id ?? `sim-${i}`,
      text,
      author: m.author ?? null,
      timestamp: m.timestamp ?? new Date(now - (messages.length - i) * 8000).toISOString(),
      axis: TAG_AXIS[rule.tag],
      tag: rule.tag,
      productId,
      optionLabel,
      sentiment: rule.sentiment ?? 'neutral',
      urgency: rule.urgency ?? 'low',
      isQuestion: isLikelyQuestion(text, rule.isQuestion),
      answered: null,
    };
  });

  const count = (tag: ShopTag) => analyses.filter((a) => a.tag === tag).length;
  const countTags = (...tags: ShopTag[]) => analyses.filter((a) => tags.includes(a.tag)).length;

  const purchased = count('purchased') + count('repurchase');
  const intent = count('purchase_intent') + count('link_request') + count('order_help');
  const priceResist = countTags('price_resistance', 'discount_request', 'lowest_price_check');
  const hesitation = countTags('hesitation_price', 'hesitation_need', 'hesitation_trust', 'cart_abandon_signal');
  const trustRisk = countTags('doubt_authenticity', 'negative_review', 'hesitation_trust');

  // 2. 미응답 질문 큐 (질문류 + 미응답)
  const unanswered: UnansweredQuestion[] = analyses
    .filter((a) => a.isQuestion && a.answered !== true)
    .slice(0, 12)
    .map((a) => ({
      id: `q-${a.id}`,
      text: a.text,
      author: a.author,
      askedAt: a.timestamp,
      productId: a.productId,
      tag: a.tag,
      urgency: a.urgency,
      suggestedAnswer: suggestedAnswerFor(a.tag),
    }));

  // 3. KPI 메트릭
  const purchaseTemp = Math.min(100, intent * 22 + purchased * 18 + count('consideration') * 8);
  const metrics: ShopMetric[] = [
    metric('purchase_temperature', '구매 온도', purchaseTemp, '%', '구매 임박·인증·고려 신호를 합산한 전환 열기', purchaseTemp >= 50 ? 'good' : purchaseTemp > 0 ? 'normal' : 'good'),
    metric('sales_estimate', '실시간 판매 추정', purchased, '건', '구매 인증 댓글 기반 추정 판매량', purchased > 0 ? 'good' : 'normal'),
    metric('conversion_timing', '전환 타이밍', purchaseTemp >= 50 || intent >= 2 ? '지금' : '대기', null, '구매 유도 멘트를 칠 타이밍', purchaseTemp >= 50 || intent >= 2 ? 'good' : 'normal'),
    metric('price_resistance', '가격 저항도', priceResist, '건', '비싸다·할인요청·최저가 비교 신호', status(priceResist, 1, 3)),
    metric('hesitation_index', '망설임 지수', hesitation, '건', '가격/필요성/신뢰 망설임 + 이탈 신호', status(hesitation, 1, 3)),
    metric('unanswered_count', '미응답 질문 수', unanswered.length, '건', '호스트 답변이 필요한 미처리 질문', status(unanswered.length, 2, 5)),
    metric('trust_risk', '신뢰 위험도', trustRisk, '건', '효과 의심·부정 후기·신뢰 망설임', status(trustRisk, 1, 2)),
  ];

  // 4. 상품별 관심 랭킹
  const productInterest: ProductInterest[] = buildProductInterest(analyses, products);

  // 5. 액션 카드
  const actionCards = buildActionCards(analyses, {
    restock: count('restock_request'),
    priceResist,
    closing: purchaseTemp >= 50 || intent >= 2,
    trustRisk,
    unanswered: unanswered.length,
    streamIssue: count('stream_issue'),
    productInterest,
  });

  // 6. FAQ (질문 태그별 대표 1건)
  const faq = buildFaq(analyses);

  // 7. 요약 + 클로징 처방
  const topTag = mostFrequentTag(analyses);
  const recentSummary = buildSummary(topTag, purchased, priceResist, unanswered.length);
  const conversionAdvice = buildConversionAdvice(purchaseTemp, intent, priceResist, trustRisk, count('restock_request'));

  return {
    analyses,
    metrics,
    actionCards,
    unanswered,
    productInterest,
    faq,
    recentSummary,
    conversionAdvice,
    analyzedAt: new Date().toLocaleTimeString(),
  };
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function metric(id: string, label: string, value: number | string, unit: string | null, description: string, st: ShopMetricStatus): ShopMetric {
  return { id, label, value, unit, description, status: st };
}

function emptyMetrics(): ShopMetric[] {
  return [
    metric('purchase_temperature', '구매 온도', 0, '%', '구매 임박·인증·고려 신호를 합산한 전환 열기', 'good'),
    metric('sales_estimate', '실시간 판매 추정', 0, '건', '구매 인증 댓글 기반 추정 판매량', 'normal'),
    metric('conversion_timing', '전환 타이밍', '대기', null, '구매 유도 멘트를 칠 타이밍', 'normal'),
    metric('price_resistance', '가격 저항도', 0, '건', '비싸다·할인요청·최저가 비교 신호', 'good'),
    metric('hesitation_index', '망설임 지수', 0, '건', '가격/필요성/신뢰 망설임 + 이탈 신호', 'good'),
    metric('unanswered_count', '미응답 질문 수', 0, '건', '호스트 답변이 필요한 미처리 질문', 'good'),
    metric('trust_risk', '신뢰 위험도', 0, '건', '효과 의심·부정 후기·신뢰 망설임', 'good'),
  ];
}

function buildProductInterest(analyses: ShopCommentAnalysis[], products: LiveProduct[]): ProductInterest[] {
  const interestTags: ShopTag[] = ['interest', 'consideration', 'purchase_intent'];
  return products
    .map((p) => {
      const own = analyses.filter((a) => a.productId === p.id);
      const interest = own.filter((a) => interestTags.includes(a.tag)).length;
      const questions = own.filter((a) => a.isQuestion).length;
      const purchasedCount = own.filter((a) => a.tag === 'purchased' || a.tag === 'repurchase').length;
      const interestScore = Math.min(100, interest * 18 + questions * 10 + purchasedCount * 25 + (p.isActive ? 10 : 0));
      return { productId: p.id, name: p.name, interestScore, questionCount: questions, purchasedCount };
    })
    .sort((a, b) => b.interestScore - a.interestScore);
}

function buildActionCards(
  analyses: ShopCommentAnalysis[],
  ctx: { restock: number; priceResist: number; closing: boolean; trustRisk: number; unanswered: number; streamIssue: number; productInterest: ProductInterest[] },
): ShopActionCard[] {
  const evidenceFor = (tags: ShopTag[]) => analyses.filter((a) => tags.includes(a.tag)).slice(0, 3).map((a) => a.text);
  const cards: ShopActionCard[] = [];

  if (ctx.streamIssue > 0) {
    cards.push(card('stream-fix', 'high', '방송 품질 점검', `음향/화면 이슈 댓글 ${ctx.streamIssue}건 감지`, '음향과 화면 잠시 확인하겠습니다. 안 들리시는 분들은 새로고침 한 번 부탁드려요!', evidenceFor(['stream_issue']), null));
  }
  if (ctx.unanswered >= 3) {
    cards.push(card('unanswered-flush', 'high', '놓친 질문 정리', `미응답 질문 ${ctx.unanswered}건 적체`, '질문 몇 개 놓쳤네요. 지금 한 번에 정리해서 답변드릴게요!', evidenceFor(['price_question', 'option_question', 'delivery_question', 'host_question_direct']), null));
  }
  if (ctx.trustRisk > 0) {
    cards.push(card('objection-trust', 'high', '신뢰 회복', `효과 의심·부정 후기 ${ctx.trustRisk}건`, '효과 의심되실 수 있어요. 실사용 후기랑 정보(성분/인증)를 잠깐 보여드릴게요.', evidenceFor(['doubt_authenticity', 'negative_review', 'hesitation_trust']), null));
  }
  if (ctx.priceResist >= 1) {
    cards.push(card('price-defense', 'medium', '가격 방어', `가격 저항 신호 ${ctx.priceResist}건`, '가격 부담되실 수 있는데, 오늘 방송가에는 구성과 혜택까지 포함되어 있어요. 다시 정리해 드릴게요.', evidenceFor(['price_resistance', 'discount_request', 'lowest_price_check']), null));
  }
  if (ctx.restock > 0) {
    cards.push(card('restock-demand', 'medium', '재입고 안내', `재입고 문의 ${ctx.restock}건`, '재입고 문의 많으세요. 알림 신청 방법 안내드릴게요!', evidenceFor(['restock_request']), null));
  }
  if (ctx.closing) {
    cards.push(card('closing-now', 'high', '지금 클로징', '구매 온도가 높습니다', '지금 결제하신 분들 많아요! 수량 한정이라 지금이 가장 좋은 타이밍이에요.', evidenceFor(['purchase_intent', 'purchased', 'consideration']), null));
  }
  // 다른 상품 관심이 활성 상품보다 높으면 상품 전환 제안
  const top = ctx.productInterest[0];
  if (top && top.interestScore > 0) {
    cards.push(card('product-pivot', 'medium', '상품 우선순위', `'${top.name}' 관심도 최상위`, `'${top.name}' 문의가 많아요. 이 상품 먼저 짧게 보고 갈게요.`, evidenceFor(['product_switch_request']), top.productId));
  }

  // 우선순위 정렬 후 상위 3개
  const order: Record<UrgencyLevel, number> = { high: 0, medium: 1, low: 2 };
  return cards.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 3);
}

function card(id: string, priority: UrgencyLevel, title: string, reason: string, suggestedLine: string, evidence: string[], targetProductId: string | null): ShopActionCard {
  return { id, priority, title, reason, suggestedLine, evidence, targetProductId };
}

function buildFaq(analyses: ShopCommentAnalysis[]): ShopFaqItem[] {
  const questionTags: ShopTag[] = ['price_question', 'option_question', 'delivery_question', 'stock_question', 'exchange_return', 'spec_question', 'discount_request', 'promo_question'];
  const seen = new Set<ShopTag>();
  const faq: ShopFaqItem[] = [];
  for (const a of analyses) {
    if (!a.isQuestion || !questionTags.includes(a.tag) || seen.has(a.tag)) continue;
    seen.add(a.tag);
    const sameTag = analyses.filter((x) => x.tag === a.tag).length;
    faq.push({
      question: a.text.length > 30 ? a.text.slice(0, 30) + '…' : a.text,
      count: sameTag,
      templateAnswer: suggestedAnswerFor(a.tag) ?? '문의 주신 내용 확인해서 바로 안내드리겠습니다!',
      productId: a.productId,
    });
    if (faq.length >= 5) break;
  }
  return faq;
}

function mostFrequentTag(analyses: ShopCommentAnalysis[]): ShopTag {
  const counts = new Map<ShopTag, number>();
  for (const a of analyses) counts.set(a.tag, (counts.get(a.tag) ?? 0) + 1);
  let best: ShopTag = 'other';
  let max = -1;
  for (const [tag, c] of counts) {
    if (c > max) {
      max = c;
      best = tag;
    }
  }
  return best;
}

function buildSummary(topTag: ShopTag, purchased: number, priceResist: number, unanswered: number): string {
  const parts: string[] = [];
  parts.push(`최근 채팅은 '${topTag}' 신호가 가장 두드러집니다.`);
  if (purchased > 0) parts.push(`구매 인증이 ${purchased}건 포착되어 전환이 일어나고 있습니다.`);
  if (priceResist > 0) parts.push(`가격 관련 반응이 ${priceResist}건으로 가격 방어 멘트가 필요할 수 있습니다.`);
  if (unanswered > 0) parts.push(`미응답 질문이 ${unanswered}건 쌓여 있어 정리 안내가 권장됩니다.`);
  return parts.join(' ');
}

function buildConversionAdvice(purchaseTemp: number, intent: number, priceResist: number, trustRisk: number, restock: number): string {
  if (trustRisk >= 2) return '지금은 신뢰 회복이 먼저입니다. 실사용 후기와 인증 정보를 보여준 뒤 구매를 유도하세요.';
  if (priceResist >= 3) return '가격 저항이 높습니다. 혜택 포함 구성가를 강조하고 한정 혜택으로 마감 압박을 주세요.';
  if (purchaseTemp >= 50 || intent >= 2) return '구매 온도가 충분합니다. 지금 한정수량·마감 시간을 강조해 바로 클로징하세요.';
  if (restock > 0) return '재입고 수요가 있습니다. 알림 신청을 유도해 다음 회차 수요로 전환하세요.';
  return '아직 탐색 단계입니다. 상품의 핵심 강점과 사용 장면을 보여주며 관심을 끌어올리세요.';
}

// ── 종료 리포트 시뮬레이터 (S-7) ──────────────────────────────────────────────

/** OPENAI_API_KEY 없이 라이브 쇼핑 종료 리포트를 생성. 분석 결과를 재사용해 통계+마크다운 작성. */
export function generateSimulatedShopReport(
  rawMessages: ShopRawMessage[],
  products: LiveProduct[] = [],
  peakCpm = 0,
): ShopReportResult {
  const a = generateSimulatedShopAnalysis(rawMessages, products);
  const totalMessages = a.analyses.length;
  const estimatedSales = a.analyses.filter((x) => x.tag === 'purchased' || x.tag === 'repurchase').length;
  const top = a.productInterest[0];
  const topProduct = top && top.interestScore > 0 ? top.name : '-';
  const unansweredCount = a.unanswered.length;
  const questionCount = a.analyses.filter((x) => x.isQuestion).length;
  const answerRate = questionCount > 0 ? Math.round(((questionCount - unansweredCount) / questionCount) * 100) : 100;
  const priceResist = a.metrics.find((m) => m.id === 'price_resistance')?.value ?? 0;

  const productLines = a.productInterest.length > 0
    ? a.productInterest.map((p, i) => `${i + 1}. **${p.name}** — 관심도 ${p.interestScore} · 질문 ${p.questionCount}건 · 구매 인증 ${p.purchasedCount}건`).join('\n')
    : '- 등록된 상품이 없어 상품별 성과를 집계하지 못했습니다.';

  const missedLines = a.unanswered.length > 0
    ? a.unanswered.slice(0, 5).map((q) => `- "${q.text}"${q.author ? ` (${q.author})` : ''}`).join('\n')
    : '- 미응답으로 남은 질문이 없습니다. 응대가 훌륭했어요! 👍';

  const faqLines = a.faq.length > 0
    ? a.faq.map((f) => `- ${f.question} (${f.count}회)`).join('\n')
    : '- 반복 질문이 충분히 누적되지 않았습니다.';

  const reportMarkdown = `# 🛒 라이브 쇼핑 종료 성과 리포트

## 1. 🛒 판매 성과 요약
- **추정 판매 건수**: ${estimatedSales}건 (구매 인증 댓글 기반)
- **최고 분당 댓글수(Peak CPM)**: ${peakCpm} CPM
- **관심 최상위 상품**: ${topProduct}
- 한줄평: ${a.conversionAdvice}

## 2. 📦 상품별 성과
${productLines}

## 3. 🕳️ 놓친 기회
- 질문 응답률: 약 ${answerRate}% (미응답 ${unansweredCount}건)
${missedLines}

## 4. 🤔 망설임·반론 분석
- 망설임 지수: ${a.metrics.find((m) => m.id === 'hesitation_index')?.value ?? 0}건 / 신뢰 위험도: ${a.metrics.find((m) => m.id === 'trust_risk')?.value ?? 0}건
- 다음 방송에서는 가격/필요성/신뢰 망설임에 대한 선제 안내 멘트를 준비하세요.

## 5. 💸 가격·프로모션 반응
- 가격 저항 신호: ${priceResist}건
- 혜택 포함 구성가와 한정 마감을 강조했을 때 전환이 높아집니다.

## 6. ❓ 상품 FAQ 후보
${faqLines}

## 7. 🚀 다음 라이브 개선점
- 관심 최상위 상품(${topProduct})을 방송 초반에 배치해 구매 온도를 빠르게 끌어올리세요.
- 미응답 질문을 줄이기 위해 중간중간 "질문 정리 타임"을 운영하세요.`;

  return {
    reportMarkdown,
    summaryStats: {
      totalMessages,
      estimatedSales,
      topProduct,
      unansweredCount,
      answerRate,
      peakCpm,
    },
    generatedAt: new Date().toLocaleTimeString(),
  };
}
