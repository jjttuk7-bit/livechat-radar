/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 시청자 집계 + 참여 퍼널 + 어필 윈도우 테스트 (P-8).
 *
 * 기능 검증과 함께 **D-1/D-2 회귀**를 고정한다: SupporterProfile에 정치성향 필드가
 * 생기거나, flag가 행위가 아닌 견해 기준으로 바뀌면 실패해야 한다.
 */

import { buildSupporterProfiles, summarizeSupporters } from './supporters.js';
import { buildParticipationFunnel, detectAppealWindow, deriveStats } from './engagement.js';
import type {
  TalkCommentAnalysis,
  TalkTag,
  TalkAnalysisResult,
  TalkTimelinePoint,
} from '../types/liveTalk.js';
import { TAG_AXIS } from '../types/liveTalk.js';

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`✗ ${msg}`);
    failed++;
  }
}

let seq = 0;
function a(author: string, tag: TalkTag, dup = 1): TalkCommentAnalysis {
  seq++;
  return {
    id: `a${seq}`,
    text: `댓글 ${seq}`,
    author,
    timestamp: new Date(1700000000000 + seq * 1000).toISOString(),
    axis: TAG_AXIS[tag],
    tag,
    issueId: null,
    figure: null,
    sentiment: 'neutral',
    urgency: 'low',
    isRequest: false,
    answered: null,
    duplicateCount: dup,
  };
}

// ── 1. 기본 집계 ─────────────────────────────────────────────────────────────
const analyses: TalkCommentAnalysis[] = [
  a('후원자', 'superchat'),
  a('후원자', 'agree_support'),
  a('단골', 'attendance'),
  a('단골', 'followup_request'),
  a('단골', 'agree_support'),
  a('관망', 'agree_support'),
  a('악성', 'hate_slur'),
  a('악성', 'defamation_risk'),
  a('악성', 'brigading_spam'),
];

const profiles = buildSupporterProfiles(analyses, [], [{ author: '멤버', isSponsor: true }]);

assert(profiles.length === 4, `프로필 4명 (실제 ${profiles.length})`);

const byName = (n: string) => profiles.find((p) => p.author === n)!;

assert(byName('후원자').isSupporter, '슈퍼챗 → isSupporter');
assert(byName('후원자').flag === 'core_supporter', '후원자 flag=core_supporter');
assert(byName('단골').isReturning, '출석·후속 요청 → isReturning');
assert(byName('단골').flag === 'regular', `단골 flag=regular (실제 ${byName('단골').flag})`);
assert(byName('관망').flag === 'normal', '1회 참여 → normal');

// 행위 기준 분류 — 견해가 아니라 행동
assert(byName('악성').riskFlagCount === 3, `리스크 행위 3건 (실제 ${byName('악성').riskFlagCount})`);
assert(byName('악성').flag === 'troll', '리스크 행위 2건 이상 → troll');
assert(byName('악성').loyaltyScore < byName('단골').loyaltyScore, '리스크 행위는 감점되어야 함');

// 정렬
for (let i = 1; i < profiles.length; i++) {
  assert(profiles[i - 1].loyaltyScore >= profiles[i].loyaltyScore, 'loyaltyScore 내림차순 정렬');
}

// 점수 범위
for (const p of profiles) {
  assert(p.loyaltyScore >= 0 && p.loyaltyScore <= 100, `loyaltyScore 0-100 (${p.author}=${p.loyaltyScore})`);
}

// ── 2. D-1 / D-2 회귀: 성향 필드가 존재하면 안 된다 ──────────────────────────
const FORBIDDEN_FIELDS = [
  'stance', 'politicalStance', 'lean', 'party', 'ideology',
  'camp', 'side', 'affiliation', 'supportsFigure',
];
for (const p of profiles) {
  for (const f of FORBIDDEN_FIELDS) {
    assert(
      !(f in (p as unknown as Record<string, unknown>)),
      `D-1 위반: SupporterProfile에 성향 필드 '${f}'가 존재함. ` +
        `개인 정치성향은 민감정보이므로 프로필에 두지 않는다.`,
    );
  }
}

// flag는 행위 기준 4종만 허용
const ALLOWED_FLAGS = ['core_supporter', 'regular', 'troll', 'normal'];
for (const p of profiles) {
  assert(ALLOWED_FLAGS.includes(p.flag), `flag가 허용 집합 밖: ${p.flag}`);
}

// 동의/반대는 flag에 영향을 주면 안 된다 — 같은 참여량이면 같은 분류여야 한다
const agreeOnly = buildSupporterProfiles([a('찬성자', 'agree_support'), a('찬성자', 'agree_support'), a('찬성자', 'agree_support')], []);
const disagreeOnly = buildSupporterProfiles([a('반대자', 'disagree_object'), a('반대자', 'disagree_object'), a('반대자', 'disagree_object')], []);
assert(
  agreeOnly[0].flag === disagreeOnly[0].flag,
  `D-1 위반: 동의(${agreeOnly[0].flag})와 반대(${disagreeOnly[0].flag})가 다르게 분류됨. ` +
    `견해가 아니라 참여 행위로만 분류해야 한다.`,
);

// ── 3. 멤버십 ────────────────────────────────────────────────────────────────
const withMember = buildSupporterProfiles([a('멤버', 'agree_support')], [], [{ author: '멤버', isSponsor: true }]);
assert(withMember[0].isMember, 'isSponsor → isMember');
assert(withMember[0].flag === 'core_supporter', '멤버는 core_supporter');

// ── 4. duplicateCount 가중 ───────────────────────────────────────────────────
const dup = buildSupporterProfiles([a('반복자', 'agree_support', 10)], []);
assert(dup[0].commentCount === 10, `duplicateCount가 참여량에 반영 (실제 ${dup[0].commentCount})`);

// ── 5. 세그먼트 결산 — 배타적 ────────────────────────────────────────────────
const sum = summarizeSupporters(profiles);
assert(sum.total === 4, '결산 total');
assert(
  sum.supporters + sum.members + sum.regulars + sum.onlookers + sum.trolls === sum.total,
  '세그먼트 합이 total과 같아야 함 (배타적 분류)',
);

// ── 6. 참여 퍼널 ─────────────────────────────────────────────────────────────
const funnel = buildParticipationFunnel(profiles);
assert(funnel.commented === 4, '퍼널 commented');
assert(funnel.engaged <= funnel.commented, '단계는 포함 관계 (engaged ≤ commented)');
assert(funnel.supported <= funnel.advocated, '단계는 포함 관계 (supported ≤ advocated)');
assert(funnel.supportRate >= 0 && funnel.supportRate <= 100, 'supportRate 0-100');

const emptyFunnel = buildParticipationFunnel([]);
assert(emptyFunnel.commented === 0 && emptyFunnel.supportRate === 0, '빈 입력에서 0으로 안전');

// ── 7. 어필 윈도우 ───────────────────────────────────────────────────────────
/**
 * 어필 윈도우 입력 생성.
 *
 * metrics가 아니라 **analyses**로 조건을 만든다. 파생 로직이 태그에서 계산하도록
 * 바뀌었기 때문이며, 이것이 의도된 계약이다 (모델의 metric 작명에 의존하지 않는다).
 */
function mkAnalysis(
  rallyN: number, supportN: number, churnN: number, filler: number,
  risks: TalkAnalysisResult['riskAlerts'],
): TalkAnalysisResult {
  const items: TalkCommentAnalysis[] = [
    ...Array.from({ length: rallyN }, (_, i) => a(`r${i}`, 'agree_support')),
    ...Array.from({ length: supportN }, (_, i) => a(`s${i}`, 'superchat')),
    ...Array.from({ length: churnN }, (_, i) => a(`c${i}`, 'fatigue_disengage')),
    ...Array.from({ length: filler }, (_, i) => a(`f${i}`, 'factual_question')),
  ];
  return {
    analyses: items, actionCards: [], unanswered: [], agendaInterest: [], faq: [],
    recentSummary: '', hostAdvice: '', metrics: [],
    riskAlerts: risks,
  };
}

const timeline: TalkTimelinePoint[] = [
  { t: 1, cpm: 50, rallyHeat: 40, disputeLevel: 0, unansweredCount: 0, riskCount: 0, supportCount: 2 },
  { t: 2, cpm: 60, rallyHeat: 55, disputeLevel: 0, unansweredCount: 0, riskCount: 0, supportCount: 5 },
];

// 동의 6 + 후원 2 중 총 10건 → 결집 60%, 후원 2건, 이탈 0%
const good = detectAppealWindow(mkAnalysis(6, 2, 0, 2, []), timeline);
assert(good.open, `좋은 조건에서 창이 열려야 함 (score ${good.score})`);
assert(good.suggestedLine.length > 0, '열렸으면 안내 멘트가 있어야 함');
assert(good.reasons.length > 0, '근거가 있어야 함');

// 이탈 신호가 크면 감점된다
const churny = detectAppealWindow(mkAnalysis(3, 1, 4, 2, []), timeline);
assert(churny.score < good.score, '이탈 신호가 크면 점수가 낮아야 함');

// 리스크가 있으면 닫힌다 — 채널 방어가 후원 안내보다 우선
const withHighRisk = detectAppealWindow(
  mkAnalysis(8, 2, 0, 0, [
    { id: 'r1', tag: 'hate_slur', severity: 'high', text: '', author: null, detectedAt: '', spreadCount: 1, reason: '', recommendation: '' },
  ]),
  timeline,
);
assert(!withHighRisk.open, '심각도 높은 리스크가 있으면 창이 닫혀야 함');
assert(withHighRisk.score === 0, '높은 리스크에서 점수는 0');

const noAnalysis = detectAppealWindow(null);
assert(!noAnalysis.open && noAnalysis.score === 0, '분석 없으면 안전하게 닫힘');

// ── 7-b. 모델이 metric id를 다르게 지어내도 파생이 동작해야 한다 ─────────────
// 실제로 같은 프롬프트에서 어떤 호출은 rally_heat 등 9개를, 어떤 호출은
// "총 댓글 수" 같은 임의 id 4개를 냈다. 기계가 읽는 값을 모델 작명에 맡기면 안 된다.
const weirdMetrics: TalkAnalysisResult = {
  analyses: [
    a('u1', 'agree_support'), a('u2', 'agree_support'), a('u3', 'hope_cheer'),
    a('u4', 'superchat'), a('u5', 'fatigue_disengage'), a('u6', 'disagree_object'),
  ],
  metrics: [
    { id: '총 댓글 수', label: '총 댓글 수', value: 6, unit: '건', description: '', status: 'normal' },
  ],
  actionCards: [], unanswered: [], agendaInterest: [], riskAlerts: [], faq: [],
  recentSummary: '', hostAdvice: '',
};

const derived = deriveStats(weirdMetrics);
assert(derived.rallyHeat > 0, `metric id가 없어도 결집 온도가 계산되어야 함 (실제 ${derived.rallyHeat})`);
assert(derived.supportSignal === 1, `후원 신호 1건 (실제 ${derived.supportSignal})`);
assert(derived.disputeLevel === 1, `논쟁 1건 (실제 ${derived.disputeLevel})`);
assert(derived.churnRisk > 0, '이탈 위험이 계산되어야 함');

const weirdAppeal = detectAppealWindow(weirdMetrics, timeline);
assert(weirdAppeal.score > 0, 'metric id가 달라도 어필 점수가 계산되어야 함');

// duplicateCount 가중
const weighted = deriveStats({
  ...weirdMetrics,
  analyses: [a('u1', 'agree_support', 9), a('u2', 'disagree_object', 1)],
});
assert(weighted.rallyHeat === 90, `duplicateCount 가중 반영 (기대 90 / 실제 ${weighted.rallyHeat})`);

const emptyDerived = deriveStats(null);
assert(emptyDerived.rallyHeat === 0 && emptyDerived.riskCount === 0, '빈 입력에서 0으로 안전');

// D-6: 안내 멘트에 공격적 표현이 없어야 한다
const ATTACK_WORDS = ['응징', '심판합시다', '몰아냅', '박살', '척결'];
for (const w of ATTACK_WORDS) {
  assert(!good.suggestedLine.includes(w), `D-6 위반: 어필 멘트에 공격 표현 '${w}'`);
}

if (failed > 0) {
  console.error(`\nsupporters tests FAILED (${failed}건)`);
  process.exitCode = 1;
} else {
  console.log('supporters tests passed');
}
