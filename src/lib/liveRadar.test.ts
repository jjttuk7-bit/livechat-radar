import assert from 'node:assert/strict';
import { analyzeComments, buildPostLiveReport } from './analyzeComments';
import { generateActionCards } from './generateActionCards';

const commerceComments = [
  '가격 얼마예요?',
  '배송은 언제 되나요?',
  '지금 사면 할인되나요?',
  '링크 어디 있어요?',
  '사고 싶은데 사이즈가 고민돼요',
];

const issueComments = [
  '그 주장은 근거가 있나요?',
  '팩트체크 필요합니다',
  '정책 효과보다 예산 문제가 핵심 아닌가요?',
  '인신공격 말고 근거로 봅시다',
  '이 논점은 다른 문제로 넘어간 것 같아요',
];

function testCommerceAnalysis() {
  const result = analyzeComments({
    mode: 'commerce',
    comments: commerceComments,
  });

  assert.equal(result.analyses.length, commerceComments.length);
  assert.ok(result.metrics.some((metric) => metric.id === 'purchase_temperature'));
  assert.ok(result.metrics.some((metric) => metric.id === 'price_questions' && metric.value === 2));
  assert.equal(result.distribution.price_question, 2);
  assert.equal(result.distribution.delivery_question, 1);
  assert.equal(result.distribution.link_request, 1);
}

function testActionCardsHavePresenterLines() {
  const result = analyzeComments({
    mode: 'issue',
    comments: issueComments,
  });
  const cards = generateActionCards('issue', result.analyses);

  assert.equal(cards.length, 3);
  assert.ok(cards.some((card) => card.title.includes('팩트체크')));
  assert.ok(cards.every((card) => card.suggestedLine.length > 20));
  assert.ok(cards.every((card) => !card.suggestedLine.includes('지지')));
}

function testModeSpecificReportSections() {
  const result = analyzeComments({
    mode: 'fandom',
    comments: ['ㅋㅋㅋㅋㅋㅋ', '이거 클립 따야 한다', '방금 말 공식 밈 가자'],
  });
  const report = buildPostLiveReport('fandom', result.analyses);

  assert.equal(report.mode, 'fandom');
  assert.ok(report.sections.some((section) => section.title === '오늘의 밈 후보'));
  assert.ok(report.sections.some((section) => section.title === '클립 후보'));
}

testCommerceAnalysis();
testActionCardsHavePresenterLines();
testModeSpecificReportSections();

console.log('liveRadar tests passed');
