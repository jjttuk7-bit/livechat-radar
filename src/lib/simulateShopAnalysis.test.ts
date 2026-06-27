import assert from 'node:assert/strict';
import { generateSimulatedShopAnalysis } from './simulateShopAnalysis';
import { SHOP_AXES, SHOP_TAGS, TAG_AXIS } from '../types/liveShopping';
import type { LiveProduct } from '../types/liveShopping';

const products: LiveProduct[] = [
  { id: 'p1', name: '수분 크림', price: 29000, options: ['50ml', '100ml'], isActive: true },
  { id: 'p2', name: '클렌징 폼', price: 15000, options: ['단품', '2개세트'] },
];

const messages = [
  { id: 'm1', author: '유저A', message: '수분 크림 100ml 얼마예요?' },
  { id: 'm2', author: '유저B', message: '이거 좀 비싸지 않나요?' },
  { id: 'm3', author: '유저C', message: '방금 결제 완료했어요!' },
  { id: 'm4', author: '유저D', message: '클렌징 폼 재입고 언제 되나요' },
  { id: 'm5', author: '유저E', message: '진짜 효과 있나요? 광고 아니죠?' },
  { id: 'm6', author: '유저F', message: '소리가 안 들려요' },
  { id: 'm7', author: '유저G', message: '저도 써봤는데 진짜 좋아요 강추' },
  { id: 'm8', author: '유저H', message: '배송은 며칠 걸려요?' },
  { id: 'm9', author: '유저I', message: '50ml 재고 남았나요?' },
  { id: 'm10', author: '유저J', message: '음 살까말까 고민되네' },
];

function find(result: ReturnType<typeof generateSimulatedShopAnalysis>, sub: string) {
  const a = result.analyses.find((x) => x.text.includes(sub));
  assert.ok(a, `"${sub}" 분석 결과 존재`);
  return a!;
}

function testClassificationAndMatching() {
  const r = generateSimulatedShopAnalysis(messages, products);

  assert.equal(find(r, '100ml').tag, 'price_question');
  assert.equal(find(r, '100ml').productId, 'p1');
  assert.equal(find(r, '100ml').optionLabel, '100ml');
  assert.equal(find(r, '비싸').tag, 'price_resistance');
  assert.equal(find(r, '결제 완료').tag, 'purchased');
  assert.equal(find(r, '재입고').tag, 'restock_request');
  assert.equal(find(r, '재입고').productId, 'p2');
  assert.equal(find(r, '광고 아니').tag, 'doubt_authenticity');
  assert.equal(find(r, '안 들려').tag, 'stream_issue');
  assert.equal(find(r, '강추').tag, 'social_proof');
}

function testEnumIntegrity() {
  const r = generateSimulatedShopAnalysis(messages, products);
  for (const a of r.analyses) {
    assert.ok(SHOP_TAGS.includes(a.tag), `tag ${a.tag} enum 포함`);
    assert.ok(SHOP_AXES.includes(a.axis), `axis ${a.axis} enum 포함`);
    assert.equal(a.axis, TAG_AXIS[a.tag], `axis-tag 매핑 일치 (${a.tag})`);
    assert.ok(['positive', 'neutral', 'negative'].includes(a.sentiment));
    assert.ok(['low', 'medium', 'high'].includes(a.urgency));
  }
}

function testMetricsAndQueue() {
  const r = generateSimulatedShopAnalysis(messages, products);
  assert.equal(r.metrics.length, 7);
  assert.equal(r.metrics.find((m) => m.id === 'sales_estimate')!.value, 1);
  assert.ok(r.unanswered.length > 0, '미응답 큐 채워짐');
  assert.ok(r.unanswered.every((q) => SHOP_TAGS.includes(q.tag)));
  assert.ok(r.actionCards.length >= 1 && r.actionCards.length <= 3, '액션카드 1~3개');
  assert.ok(r.actionCards.every((c) => c.suggestedLine.length > 10));
  assert.equal(r.productInterest.length, 2);
  assert.ok(r.conversionAdvice.length > 0);
}

function testStreamIssueGetsHighPriorityCard() {
  const r = generateSimulatedShopAnalysis(messages, products);
  const streamCard = r.actionCards.find((c) => c.id === 'stream-fix');
  assert.ok(streamCard, '방송 이슈 액션카드 생성');
  assert.equal(streamCard!.priority, 'high');
}

function testEmptyInput() {
  const r = generateSimulatedShopAnalysis([], products);
  assert.equal(r.analyses.length, 0);
  assert.equal(r.metrics.length, 7);
  assert.equal(r.unanswered.length, 0);
  assert.equal(r.productInterest.length, 2);
  assert.ok(r.recentSummary.length > 0);
  assert.ok(r.conversionAdvice.length > 0);
}

testClassificationAndMatching();
testEnumIntegrity();
testMetricsAndQueue();
testStreamIssueGetsHighPriorityCard();
testEmptyInput();

console.log('simulateShopAnalysis tests passed');
