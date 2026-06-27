import assert from 'node:assert/strict';
import { matchPresetAnswers } from './scriptAssist';
import type { LiveProduct, UnansweredQuestion } from '../types/liveShopping';

function q(id: string, text: string): UnansweredQuestion {
  return { id, text, author: null, askedAt: '', productId: null, tag: 'other', urgency: 'low', suggestedAnswer: null };
}

const products: LiveProduct[] = [
  {
    id: 'p1',
    name: '수분 크림',
    presetFaqs: [
      { q: '배송 며칠 걸려요', a: '영업일 기준 2~3일 내 출고됩니다.' },
      { q: '환불 되나요', a: '단순 변심도 7일 내 가능합니다.' },
    ],
  },
];

function testMatch() {
  const matches = matchPresetAnswers([q('1', '배송 얼마나 걸리나요?'), q('2', '아무 상관 없는 잡담')], products);
  // '배송' 토큰 매칭
  const m = matches.find((x) => x.questionId === '1');
  assert.ok(m, '배송 질문 매칭됨');
  assert.equal(m!.answer, '영업일 기준 2~3일 내 출고됩니다.', '준비된 답변');
  assert.equal(m!.productName, '수분 크림');
  // 무관 질문은 매칭 안 됨
  assert.equal(matches.find((x) => x.questionId === '2'), undefined, '무관 질문 제외');
}

function testNoFaqs() {
  assert.deepEqual(matchPresetAnswers([q('1', '배송?')], [{ id: 'p', name: 'x' }]), [], 'presetFaqs 없으면 빈 배열');
}

testMatch();
testNoFaqs();

console.log('scriptAssist tests passed');
