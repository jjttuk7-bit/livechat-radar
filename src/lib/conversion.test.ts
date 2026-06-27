import assert from 'node:assert/strict';
import { buildConversionFunnel, computeMentionLift, detectClosingWindow, detectPriceElasticityWarning } from './conversion';
import type { ShopAnalysisResult, ShopMetric, ViewerProfile } from '../types/liveShopping';

function vp(p: Partial<ViewerProfile>): ViewerProfile {
  return {
    author: p.author ?? 'a',
    commentCount: 1,
    firstSeen: '', lastSeen: '',
    leadScore: 0,
    funnelStage: p.funnelStage ?? 'none',
    interestedProductIds: [],
    topTags: [],
    hesitationReasons: [],
    hasUnanswered: false,
    isReturning: false,
    isPurchaser: p.isPurchaser ?? false,
    isMember: false,
    flag: 'normal',
  };
}

function testFunnelMonotonic() {
  const viewers = [
    vp({ author: '1', funnelStage: 'interest' }),
    vp({ author: '2', funnelStage: 'consideration' }),
    vp({ author: '3', funnelStage: 'purchase_intent' }),
    vp({ author: '4', funnelStage: 'purchased', isPurchaser: true }),
    vp({ author: '5', funnelStage: 'none' }),
  ];
  const f = buildConversionFunnel(viewers);
  // 단조 감소
  assert.ok(f.interest >= f.consideration, 'interest >= consideration');
  assert.ok(f.consideration >= f.intent, 'consideration >= intent');
  assert.ok(f.intent >= f.purchased, 'intent >= purchased');
  assert.equal(f.interest, 4, '관심 이상 4명 (none 제외)');
  assert.equal(f.consideration, 3);
  assert.equal(f.intent, 2);
  assert.equal(f.purchased, 1);
  assert.equal(f.conversionRate, 25, '1/4=25%');
}

function testEmpty() {
  const f = buildConversionFunnel([]);
  assert.equal(f.interest, 0);
  assert.equal(f.conversionRate, 0, '0명일 때 0% (NaN 아님)');
}

function testPurchaserCountsAllStages() {
  // 구매자는 모든 하위 단계에 포함되어야 함 (단계 표기가 낮아도)
  const f = buildConversionFunnel([vp({ funnelStage: 'repurchase', isPurchaser: true })]);
  assert.equal(f.interest, 1);
  assert.equal(f.intent, 1);
  assert.equal(f.purchased, 1);
}

// ── 클로징 윈도우 ────────────────────────────────────────────────────────────

function metric(id: string, value: number | string): ShopMetric {
  return { id, label: id, value, unit: null, description: '', status: 'good' };
}
function analysisWith(metrics: ShopMetric[], tags: string[] = []): ShopAnalysisResult {
  return {
    analyses: tags.map((t, i) => ({
      id: `a${i}`, text: 't', author: null, timestamp: '', axis: 'funnel', tag: t as any,
      productId: null, optionLabel: null, sentiment: 'neutral', urgency: 'low', isQuestion: false, answered: null,
    })),
    metrics, actionCards: [], unanswered: [], productInterest: [], faq: [],
    recentSummary: '', conversionAdvice: '',
  };
}

function testClosingWindow() {
  // null → 닫힘
  assert.equal(detectClosingWindow(null).open, false, 'null이면 닫힘');

  // 구매 온도 높음 → 열림
  const hot = detectClosingWindow(analysisWith([metric('purchase_temperature', 60), metric('conversion_timing', '지금')]));
  assert.equal(hot.open, true, '구매 온도 60 → 열림');
  assert.ok(hot.reasons.some((r) => r.includes('60')), '근거에 온도');
  assert.ok(hot.score > 60, '타이밍 가점 반영');

  // 온도 낮고 타이밍 대기 → 닫힘
  const cold = detectClosingWindow(analysisWith([metric('purchase_temperature', 10), metric('conversion_timing', '대기')]));
  assert.equal(cold.open, false, '온도 낮으면 닫힘');

  // 마감/재고 문의가 강도 가산
  const boosted = detectClosingWindow(analysisWith([metric('purchase_temperature', 55), metric('conversion_timing', '지금')], ['deadline_question', 'stock_question']));
  assert.ok(boosted.reasons.includes('마감 문의 감지') && boosted.reasons.includes('재고 문의 감지'), '마감/재고 근거');
}

function testPriceWarning() {
  assert.equal(detectPriceElasticityWarning(null), null, 'null이면 경고 없음');
  // 저항 4건 + 구매 0 → 경고
  const warn = detectPriceElasticityWarning(analysisWith([metric('price_resistance', 4), metric('sales_estimate', 0), metric('purchase_temperature', 20)]));
  assert.ok(warn && warn.includes('4건'), '가격 저항 경고 발생');
  // 저항 1건 → 경고 없음
  assert.equal(detectPriceElasticityWarning(analysisWith([metric('price_resistance', 1), metric('sales_estimate', 0), metric('purchase_temperature', 20)])), null, '저항 적으면 경고 없음');
  // 저항 높아도 구매/온도 충분하면 경고 없음
  assert.equal(detectPriceElasticityWarning(analysisWith([metric('price_resistance', 3), metric('sales_estimate', 5), metric('purchase_temperature', 70)])), null, '전환 좋으면 경고 없음');
}

function testMentionLift() {
  const mark = { id: 'm', label: '쿠폰', at: '', baselinePurchased: 2, baselineTemp: 40 };
  const lift = computeMentionLift(mark, 6, 55);
  assert.equal(lift.purchasedLift, 4, '구매 상승 +4');
  assert.equal(lift.tempLift, 15, '온도 상승 +15');
}

testFunnelMonotonic();
testEmpty();
testPurchaserCountsAllStages();
testClosingWindow();
testPriceWarning();
testMentionLift();

console.log('conversion tests passed');
