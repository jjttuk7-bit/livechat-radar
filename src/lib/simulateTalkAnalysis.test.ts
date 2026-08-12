/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 시뮬레이터 계약 완전성 테스트 (P-3).
 *
 * 핵심 목적은 "그럴듯한 값이 나오는가"가 아니라 **TalkAnalysisResult의 모든 필드가 채워지는가**다.
 * 키 없는 환경에서 필드 하나가 undefined면 UI가 그 자리에서 깨진다.
 */

import {
  generateSimulatedTalkAnalysis,
  generateSimulatedTalkReport,
} from './simulateTalkAnalysis.js';
import { TALK_TAGS, TAG_AXIS, RISK_TAGS } from '../types/liveTalk.js';
import type { LiveIssue } from '../types/liveTalk.js';
import type { ChatLike } from './dedupe.js';

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`✗ ${msg}`);
    failed++;
  }
}

let n = 0;
function m(message: string, author = `u${n}`): ChatLike {
  n++;
  return { id: `t${n}`, author, message, timestamp: new Date(1700000000000 + n * 1000).toISOString() };
}

const ISSUES: LiveIssue[] = [
  {
    id: 'iss-1',
    title: '예산안 처리',
    keywords: ['예산안', '예산'],
    figures: ['위원장'],
    isActive: true,
    presetFaqs: [{ q: '예산안 언제 처리되나요', a: '이번 주 본회의 일정에 따라 달라집니다.' }],
  },
  { id: 'iss-2', title: '청문회 일정', keywords: ['청문회'] },
];

/** TalkAnalysisResult의 최상위 필드가 하나도 빠지지 않았는지 */
const REQUIRED_KEYS = [
  'analyses', 'metrics', 'actionCards', 'unanswered',
  'agendaInterest', 'riskAlerts', 'faq', 'recentSummary', 'hostAdvice',
] as const;

// ── 1. 빈 입력 — UI가 깨지지 않는 완전한 응답 ────────────────────────────────
const empty = generateSimulatedTalkAnalysis([], ISSUES);
for (const k of REQUIRED_KEYS) {
  assert(k in empty, `빈 입력 응답에 '${k}' 누락`);
  assert((empty as never as Record<string, unknown>)[k] !== undefined, `빈 입력 '${k}'가 undefined`);
}
assert(Array.isArray(empty.analyses) && empty.analyses.length === 0, '빈 입력: analyses 빈 배열');
assert(empty.metrics.length === 9, `빈 입력에도 KPI 9종 (실제 ${empty.metrics.length})`);
assert(empty.recentSummary.length > 0, '빈 입력에도 요약 문구 존재');
assert(empty.hostAdvice.length > 0, '빈 입력에도 진행 조언 존재');

// ── 2. 일반 입력 — 전 필드 채움 + 형태 검증 ──────────────────────────────────
const msgs = [
  m('예산안 어떻게 되는 건가요'),
  m('자료 좀 화면에 띄워주세요'),
  m('위원장 발언 다시 들려주세요'),
  m('맞습니다 정확한 지적입니다'),
  m('그건 아니라고 봅니다'),
  m('화가 나네요 어이가 없습니다'),
  m('지겹네요 똑같은 얘기'),
  m('구독하고 갑니다'),
  m('슈퍼챗 보냅니다'),
  m('출석합니다'),
  m('카톡으로 받았는데 이거 사실인가요'),
  m('저건 명백한 범죄다 구속감이다'),
  m('소리가 안 들려요'),
  m('청문회 일정 다뤄주세요'),
];
const r = generateSimulatedTalkAnalysis(msgs, ISSUES);

for (const k of REQUIRED_KEYS) {
  assert((r as never as Record<string, unknown>)[k] !== undefined, `'${k}'가 undefined`);
}

// analyses의 모든 필드
for (const a of r.analyses) {
  assert(typeof a.id === 'string' && a.id.length > 0, 'analysis.id');
  assert(typeof a.text === 'string', 'analysis.text');
  assert(a.author === null || typeof a.author === 'string', 'analysis.author는 string|null');
  assert(typeof a.timestamp === 'string', 'analysis.timestamp');
  assert(TALK_TAGS.includes(a.tag), `analysis.tag가 enum 밖: ${a.tag}`);
  assert(TAG_AXIS[a.tag] === a.axis, `axis가 tag의 축과 불일치: ${a.tag}/${a.axis}`);
  assert(a.issueId === null || typeof a.issueId === 'string', 'analysis.issueId는 string|null');
  assert(a.figure === null || typeof a.figure === 'string', 'analysis.figure는 string|null');
  assert(['positive', 'neutral', 'negative'].includes(a.sentiment), 'analysis.sentiment');
  assert(['low', 'medium', 'high'].includes(a.urgency), 'analysis.urgency');
  assert(typeof a.isRequest === 'boolean', 'analysis.isRequest');
  assert(a.answered === null || typeof a.answered === 'boolean', 'analysis.answered는 boolean|null');
  assert(Number.isInteger(a.duplicateCount) && a.duplicateCount >= 1, 'analysis.duplicateCount');
}

// metrics
assert(r.metrics.length === 9, `KPI 9종 (실제 ${r.metrics.length})`);
for (const mt of r.metrics) {
  assert(typeof mt.id === 'string', 'metric.id');
  assert(typeof mt.label === 'string', 'metric.label');
  assert(typeof mt.value === 'number' || typeof mt.value === 'string', 'metric.value');
  assert(mt.unit === null || typeof mt.unit === 'string', 'metric.unit은 string|null');
  assert(typeof mt.description === 'string', 'metric.description');
  assert(['good', 'normal', 'warning', 'danger'].includes(mt.status), 'metric.status');
}

// riskAlerts
assert(r.riskAlerts.length > 0, '리스크 신호가 감지되어야 함 (미확인 전언 + 범죄 단정)');
for (const ra of r.riskAlerts) {
  assert(RISK_TAGS.includes(ra.tag), `riskAlert.tag가 RISK_TAGS 밖: ${ra.tag}`);
  assert(['low', 'medium', 'high'].includes(ra.severity), 'riskAlert.severity');
  assert(ra.reason.length > 0 && ra.recommendation.length > 0, 'riskAlert 사유·권고 문구');
  assert(Number.isInteger(ra.spreadCount), 'riskAlert.spreadCount');
}
// 심각도 정렬
const rank = { high: 0, medium: 1, low: 2 } as const;
for (let i = 1; i < r.riskAlerts.length; i++) {
  assert(
    rank[r.riskAlerts[i - 1].severity] <= rank[r.riskAlerts[i].severity],
    '리스크는 심각도순으로 정렬되어야 함',
  );
}

// unanswered
assert(r.unanswered.length > 0, '미응답 요구가 큐에 쌓여야 함');
for (const u of r.unanswered) {
  assert(typeof u.text === 'string' && u.text.length > 0, 'unanswered.text');
  assert(u.suggestedAnswer === null || typeof u.suggestedAnswer === 'string', 'suggestedAnswer는 string|null');
}

// agendaInterest — 큐시트 이슈 수만큼
assert(r.agendaInterest.length === ISSUES.length, `아젠다 랭킹은 이슈 수와 같아야 함 (실제 ${r.agendaInterest.length})`);
for (const ag of r.agendaInterest) {
  assert(typeof ag.isRising === 'boolean', 'agendaInterest.isRising');
  assert(ag.interestScore >= 0 && ag.interestScore <= 100, 'interestScore는 0-100');
}

// actionCards 최대 3개
assert(r.actionCards.length <= 3, `액션 카드 최대 3개 (실제 ${r.actionCards.length})`);
for (const c of r.actionCards) {
  assert(Array.isArray(c.evidence), 'actionCard.evidence는 배열');
  assert(c.targetIssueId === null || typeof c.targetIssueId === 'string', 'targetIssueId는 string|null');
  assert(c.suggestedLine.length > 0, 'suggestedLine 존재');
}

// ── 3. 이슈 매칭 ─────────────────────────────────────────────────────────────
const matched = r.analyses.filter((a) => a.issueId === 'iss-1');
assert(matched.length > 0, '예산안 키워드가 iss-1에 매칭되어야 함');

// ── 4. 안전 회귀 (D-4 / D-5) ─────────────────────────────────────────────────
// 시뮬레이터가 진위·위법을 단정하는 문구를 내보내면 안 된다.
const VERDICT_WORDS = ['가짜뉴스', '허위사실입니다', '거짓입니다', '위법입니다', '불법입니다', '유죄'];
const allText = [
  ...r.riskAlerts.map((x) => `${x.reason} ${x.recommendation}`),
  ...r.actionCards.map((x) => `${x.title} ${x.suggestedLine} ${x.reason}`),
  r.hostAdvice,
  r.recentSummary,
].join(' ');
for (const w of VERDICT_WORDS) {
  assert(!allText.includes(w), `D-4/D-5 위반: 단정 표현 '${w}'가 출력에 포함됨`);
}

// 개인 성향 라벨이 출력에 등장하면 안 된다 (D-1)
const STANCE_LABELS = ['보수 성향', '진보 성향', '지지자 명단', '성향 분류'];
for (const w of STANCE_LABELS) {
  assert(!allText.includes(w), `D-1 위반: 성향 라벨 '${w}'가 출력에 포함됨`);
}

// ── 5. 리포트 ────────────────────────────────────────────────────────────────
const rep = generateSimulatedTalkReport(msgs, ISSUES, 120);
assert(typeof rep.reportMarkdown === 'string' && rep.reportMarkdown.length > 100, '리포트 마크다운 생성');
const st = rep.summaryStats;
for (const k of ['totalMessages', 'peakCpm', 'topAgenda', 'supportCount', 'unansweredCount', 'answerRate', 'riskCount'] as const) {
  assert(st[k] !== undefined, `summaryStats.${k} 누락`);
}
assert(Number.isInteger(st.totalMessages) && st.totalMessages === msgs.length, 'totalMessages 일치');
assert(st.answerRate >= 0 && st.answerRate <= 100, 'answerRate는 0-100');
assert(rep.reportMarkdown.includes('법적 판정이 아닙니다'), '리포트에 면책 문구가 있어야 함 (D-5)');

// ── 6. 대량 입력에서도 응답이 상수 규모여야 한다 ─────────────────────────────
const many: ChatLike[] = [];
for (let i = 0; i < 8000; i++) many.push(m(`의견 ${i} 입니다`));
const t0 = performance.now();
const big = generateSimulatedTalkAnalysis(many, ISSUES);
const ms = performance.now() - t0;
assert(big.analyses.length <= 200, `analyses는 상한이 있어야 함 (실제 ${big.analyses.length})`);
assert(big.riskAlerts.length <= 20, 'riskAlerts 상한');
assert(big.unanswered.length <= 20, 'unanswered 상한');
assert(ms < 2000, `8천 건 시뮬레이션 ${ms.toFixed(0)}ms — 2000ms 이내`);

console.log(`  [perf] 8천 건 시뮬레이션 ${ms.toFixed(0)}ms → analyses ${big.analyses.length}건`);

if (failed > 0) {
  console.error(`\nsimulateTalkAnalysis tests FAILED (${failed}건)`);
  process.exitCode = 1;
} else {
  console.log('simulateTalkAnalysis tests passed');
}
