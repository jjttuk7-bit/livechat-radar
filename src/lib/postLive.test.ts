import assert from 'node:assert/strict';
import { buildPostLiveInsights } from './postLive';
import type { MentionMark, ShopAnalysisResult, ShopTimelinePoint } from '../types/liveShopping';
import type { ViewerSummary } from './buildViewerProfiles';

const emptySummary: ViewerSummary = {
  total: 0,
  segments: { troll: 0, purchaser: 0, hotLead: 0, regular: 0, watching: 0 },
  hesitationByReason: [],
  trolls: [],
};

function tp(t: number, purchased: number, temp: number, extra: Partial<ShopTimelinePoint> = {}): ShopTimelinePoint {
  return { t, cpm: 0, purchaseTemp: temp, priceResistance: 0, unansweredCount: 0, purchased, ...extra };
}

function testGoldenMoments() {
  const base = Date.now();
  const timeline = [tp(base, 0, 20), tp(base + 1000, 1, 40), tp(base + 2000, 4, 70), tp(base + 3000, 4, 30)];
  const marks: MentionMark[] = [{ id: 'm', label: '사은품', at: new Date(base + 1500).toISOString(), baselinePurchased: 1, baselineTemp: 40 }];
  const ins = buildPostLiveInsights({ timeline, marks, analysis: null, summary: emptySummary });
  // 가장 큰 구매 증가(+3, base+2000)가 1위, 그 직전 사은품 멘트 매칭
  assert.equal(ins.goldenMoments[0].purchasedDelta, 3, '최대 구매 증가 +3');
  assert.equal(ins.goldenMoments[0].mention, '사은품', '직전 멘트 매칭');
  assert.ok(ins.timeBuckets.length > 0, '버킷 생성');
}

function testDropOff() {
  const base = Date.now();
  // 피크 80 후 20으로 식음
  const timeline = [tp(base, 0, 30), tp(base + 1000, 1, 80), tp(base + 2000, 1, 20)];
  const ins = buildPostLiveInsights({ timeline, marks: [], analysis: null, summary: emptySummary });
  assert.equal(ins.dropOff.detected, true, '이탈 감지');
}

function testChecklist() {
  const analysis = {
    analyses: [], metrics: [], actionCards: [],
    unanswered: [{ id: 'q', text: '?', author: null, askedAt: '', productId: null, tag: 'price_question', urgency: 'low', suggestedAnswer: null }],
    productInterest: [{ productId: 'p1', name: '크림', interestScore: 50, questionCount: 3, purchasedCount: 1 }],
    faq: [], recentSummary: '', conversionAdvice: '',
  } as ShopAnalysisResult;
  const ins = buildPostLiveInsights({ timeline: [], marks: [], analysis, summary: emptySummary });
  assert.ok(ins.checklist.some((c) => c.includes('크림')), '관심 1위 상품 체크리스트');
  assert.ok(ins.checklist.some((c) => c.includes('FAQ')), '미응답 FAQ 체크리스트');
}

function testEmpty() {
  const ins = buildPostLiveInsights({ timeline: [], marks: [], analysis: null, summary: emptySummary });
  assert.equal(ins.goldenMoments.length, 0);
  assert.equal(ins.timeBuckets.length, 0);
  assert.ok(ins.checklist.length > 0, '빈 상태도 기본 체크리스트');
}

testGoldenMoments();
testDropOff();
testChecklist();
testEmpty();

console.log('postLive tests passed');
