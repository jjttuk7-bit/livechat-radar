import assert from 'node:assert/strict';
import { buildViewerProfiles, summarizeViewers } from './buildViewerProfiles';
import type { ShopCommentAnalysis, ShopTag, UnansweredQuestion } from '../types/liveShopping';

let n = 0;
function mk(author: string, tag: ShopTag, opts: Partial<ShopCommentAnalysis> = {}): ShopCommentAnalysis {
  n++;
  return {
    id: `c${n}`,
    text: 't',
    author,
    timestamp: new Date(2026, 0, 1, 0, 0, n).toISOString(),
    axis: 'funnel',
    tag,
    productId: opts.productId ?? null,
    optionLabel: null,
    sentiment: 'neutral',
    urgency: 'low',
    isQuestion: opts.isQuestion ?? false,
    answered: null,
  };
}

function testHotLeadRanking() {
  const analyses: ShopCommentAnalysis[] = [
    // 핫리드: 관심→고려→임박 상승
    mk('핫리드', 'interest'),
    mk('핫리드', 'consideration', { productId: 'p1' }),
    mk('핫리드', 'purchase_intent'),
    mk('핫리드', 'price_question', { isQuestion: true }),
    // 일반 관심
    mk('구경꾼', 'interest'),
    // 트롤
    mk('트롤', 'abuse_troll'),
    mk('트롤', 'abuse_troll'),
  ];
  const unanswered: UnansweredQuestion[] = [
    { id: 'q1', text: '가격?', author: '핫리드', askedAt: analyses[3].timestamp, productId: null, tag: 'price_question', urgency: 'medium', suggestedAnswer: null },
  ];

  const profiles = buildViewerProfiles(analyses, unanswered);

  // 핫리드가 1위, 트롤은 맨 뒤
  assert.equal(profiles[0].author, '핫리드', '핫리드가 최상위');
  assert.equal(profiles[profiles.length - 1].author, '트롤', '트롤은 맨 뒤');

  const hot = profiles.find((p) => p.author === '핫리드')!;
  assert.equal(hot.flag, 'hot_lead', 'hot_lead 플래그');
  assert.equal(hot.funnelStage, 'purchase_intent', '최고 퍼널 단계');
  assert.ok(hot.leadScore > profiles.find((p) => p.author === '구경꾼')!.leadScore, '핫리드 점수 > 구경꾼');
  assert.ok(hot.interestedProductIds.includes('p1'), '관심 상품 매핑');
  assert.equal(hot.hasUnanswered, true, '미응답 보유');
  assert.equal(hot.commentCount, 4, '댓글 수');

  const troll = profiles.find((p) => p.author === '트롤')!;
  assert.equal(troll.flag, 'troll', 'troll 플래그');
}

function testReturningAndPurchaser() {
  const analyses: ShopCommentAnalysis[] = [
    mk('단골', 'repurchase'),
    mk('단골', 'purchased'),
  ];
  const messages = [{ author: '단골', isSponsor: true }];
  const profiles = buildViewerProfiles(analyses, [], messages);
  const reg = profiles[0];
  assert.equal(reg.isReturning, true, '재구매=단골');
  assert.equal(reg.isPurchaser, true, '구매자');
  assert.equal(reg.isMember, true, '멤버십');
  assert.equal(reg.flag, 'regular', 'regular 플래그');
}

function testHesitation() {
  const analyses: ShopCommentAnalysis[] = [
    mk('고민러', 'consideration'),
    mk('고민러', 'hesitation_price'),
    mk('고민러', 'hesitation_trust'),
  ];
  const p = buildViewerProfiles(analyses)[0];
  assert.ok(p.hesitationReasons.includes('hesitation_price') && p.hesitationReasons.includes('hesitation_trust'), '망설임 사유 수집');
}

function testNullAuthorSkipped() {
  const analyses: ShopCommentAnalysis[] = [
    { ...mk('x', 'interest'), author: null },
    mk('유효', 'interest'),
  ];
  const profiles = buildViewerProfiles(analyses);
  assert.equal(profiles.length, 1, 'author null 제외');
  assert.equal(profiles[0].author, '유효');
}

function testSummarize() {
  const analyses: ShopCommentAnalysis[] = [
    mk('핫', 'consideration'), mk('핫', 'purchase_intent'), mk('핫', 'price_question', { isQuestion: true }),
    mk('구매', 'purchased'),
    mk('단골', 'repurchase'),
    mk('고민', 'hesitation_price'), mk('고민', 'hesitation_trust'),
    mk('관망', 'interest'),
    mk('트롤', 'abuse_troll'), mk('트롤', 'abuse_troll'),
  ];
  const s = summarizeViewers(buildViewerProfiles(analyses));
  // 배타적 세그먼트 합 = total
  const sum = s.segments.troll + s.segments.purchaser + s.segments.hotLead + s.segments.regular + s.segments.watching;
  assert.equal(sum, s.total, '세그먼트 합 = total');
  assert.equal(s.segments.troll, 1, '트롤 1');
  // 구매(purchased)+단골(repurchase)은 둘 다 isPurchaser → 세그먼트 우선순위상 '구매자'
  assert.equal(s.segments.purchaser, 2, '구매자 2 (purchased + repurchase)');
  assert.ok(s.segments.hotLead >= 1, '핫리드 ≥ 1');
  assert.ok(s.hesitationByReason.some((h) => h.reason === 'hesitation_price'), '망설임 사유 집계');
  assert.deepEqual(s.trolls, ['트롤'], '트롤 목록');
}

testHotLeadRanking();
testReturningAndPurchaser();
testHesitation();
testNullAuthorSkipped();
testSummarize();

console.log('buildViewerProfiles tests passed');
