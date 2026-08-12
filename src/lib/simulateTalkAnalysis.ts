/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 정치·시사 로컬 시뮬레이터 (P-3) — OPENAI_API_KEY 없이도 앱이 동작하는 유일한 경로.
 *
 * L1 파이프라인(runPrefilter)을 그대로 재사용한다. 별도 규칙 세트를 만들면 시뮬레이터와
 * 실제 파이프라인이 갈라지고, 갈라지는 순간 "데모에서는 되는데 실사용에서 안 되는" 상황이 생긴다.
 *
 * ⚠️ 계약 완전성: TalkAnalysisResult의 **모든 필드**를 채운다. 하나라도 비면 UI가 undefined로 깨진다.
 *
 * ⚠️ 안전 (D-4 / D-5): 시뮬레이터도 진위·위법을 판정하지 않는다.
 *    reason/recommendation 문구는 "검증 필요", "확인 권장" 수준을 넘지 않는다.
 */

import {
  TALK_AXES,
  TAG_AXIS,
  type AgendaInterest,
  type LiveIssue,
  type RiskAlert,
  type RiskSeverity,
  type RiskTag,
  type Sentiment,
  type TalkActionCard,
  type TalkAnalysisResult,
  type TalkCommentAnalysis,
  type TalkFaqItem,
  type TalkMetric,
  type TalkReportResult,
  type TalkTag,
  type UnansweredRequest,
  type UrgencyLevel,
} from '../types/liveTalk.js';
import { runPrefilter, type PrefilterHit, type PrefilterStats } from './prefilter.js';
import { normalizeText, type ChatLike } from './dedupe.js';

/**
 * 동일 문구를 한 항목으로 접는다.
 *
 * 리스크 패널과 미응답 큐는 사람이 읽고 조치하는 화면이다. "자료 띄워주세요" 200건을
 * 200줄로 늘어놓으면 목록으로서 쓸모가 없다. 대표 1건 + 확산 수(duplicateCount)로 접어야
 * 진행자가 "이 요구가 200명에게서 왔다"를 한 줄로 파악한다.
 */
function foldByText(hits: PrefilterHit[]): PrefilterHit[] {
  const seen = new Set<string>();
  const out: PrefilterHit[] = [];
  for (const h of hits) {
    const key = normalizeText(h.message.message ?? '');
    if (key.length > 0) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(h);
  }
  return out;
}

/** 태그별 감정 성향 — 시뮬레이터 추정 */
const NEGATIVE_TAGS = new Set<TalkTag>([
  'outrage', 'anxiety', 'despair', 'ridicule', 'fatigue_disengage',
  'disagree_object', 'doubt_verify', 'whataboutism',
  'hate_slur', 'defamation_risk', 'misinfo_suspect', 'brigading_spam', 'stream_issue',
]);
const POSITIVE_TAGS = new Set<TalkTag>([
  'agree_support', 'hope_cheer', 'superchat', 'membership',
  'subscribe_share', 'attendance', 'community_bond',
]);

function sentimentFor(tag: TalkTag): Sentiment {
  if (NEGATIVE_TAGS.has(tag)) return 'negative';
  if (POSITIVE_TAGS.has(tag)) return 'positive';
  return 'neutral';
}

function urgencyFor(tag: TalkTag, dup: number): UrgencyLevel {
  if (tag === 'hate_slur' || tag === 'defamation_risk') return 'high';
  if (tag === 'host_question_direct' || tag === 'stream_issue') return 'high';
  if (dup >= 5) return 'high';
  if (TAG_AXIS[tag] === 'inquiry' || TAG_AXIS[tag] === 'risk') return 'medium';
  return 'low';
}

const REQUEST_TAGS = new Set<TalkTag>([
  'factual_question', 'explain_request', 'opinion_request', 'host_question_direct',
  'rerun_request', 'how_to_act', 'topic_request', 'followup_request',
  'guest_request', 'source_request',
]);

const RISK_SEVERITY: Partial<Record<RiskTag, RiskSeverity>> = {
  hate_slur: 'high',
  defamation_risk: 'high',
  misinfo_suspect: 'medium',
  election_law_watch: 'medium',
  brigading_spam: 'medium',
  stream_issue: 'low',
};

/** 판정이 아니라 신호임이 드러나는 문구만 쓴다 (D-4 / D-5) */
const RISK_REASON: Record<RiskTag, string> = {
  hate_slur: '비하·욕설 형식의 표현이 감지되었습니다.',
  defamation_risk: '특정 대상에 대한 단정적 표현이 감지되었습니다. 명예훼손 소지를 검토해 보십시오.',
  misinfo_suspect: '출처가 확인되지 않은 전언 형식입니다. 사실 여부는 확인이 필요합니다.',
  election_law_watch: '선거 관련 주의가 필요한 표현입니다. 위법 여부는 판단하지 않습니다.',
  brigading_spam: '동일 문구가 짧은 시간에 반복·확산되고 있습니다.',
  stream_issue: '방송 품질 관련 언급입니다.',
};

const RISK_RECOMMENDATION: Record<RiskTag, string> = {
  hate_slur: '삭제 검토 및 모더레이터 확인을 권장합니다.',
  defamation_risk: '모더레이터 확인을 권장합니다. 진행자도 단정적 표현을 피하십시오.',
  misinfo_suspect: '확인 전까지 언급을 보류하고, 필요 시 "확인 후 말씀드리겠습니다"로 대응하십시오.',
  election_law_watch: '모더레이터 확인을 권장합니다.',
  brigading_spam: '슬로우 모드 적용과 모더레이터 확인을 권장합니다.',
  stream_issue: '음향·화면 상태를 확인하십시오.',
};

function metric(
  id: string,
  label: string,
  value: number | string,
  unit: string | null,
  description: string,
  status: TalkMetric['status'],
): TalkMetric {
  return { id, label, value, unit, description, status };
}

function toAnalysis(hit: PrefilterHit, issues: LiveIssue[]): TalkCommentAnalysis {
  const text = hit.message.message ?? '';
  const issue = issues.find(
    (i) =>
      (i.keywords ?? []).some((k) => k && text.includes(k)) ||
      (i.figures ?? []).some((f) => f && text.includes(f)),
  );
  const figure = issue?.figures?.find((f) => f && text.includes(f)) ?? null;

  return {
    id: hit.message.id,
    text,
    author: hit.message.author ?? null,
    timestamp: hit.message.timestamp ?? new Date().toISOString(),
    axis: hit.axis,
    tag: hit.tag,
    issueId: issue?.id ?? null,
    figure,
    sentiment: sentimentFor(hit.tag),
    urgency: urgencyFor(hit.tag, hit.duplicateCount),
    isRequest: REQUEST_TAGS.has(hit.tag),
    answered: null,
    duplicateCount: hit.duplicateCount,
  };
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function statusFor(value: number, warn: number, danger: number): TalkMetric['status'] {
  if (value >= danger) return 'danger';
  if (value >= warn) return 'warning';
  if (value === 0) return 'good';
  return 'normal';
}

/** 빈 입력에서도 UI가 깨지지 않는 완전한 응답을 만든다 */
function emptyResult(): TalkAnalysisResult {
  return {
    analyses: [],
    metrics: [
      metric('rally_heat', '결집 온도', 0, '%', '아직 데이터가 없습니다.', 'normal'),
      metric('support_signal', '후원 신호', 0, '건', '아직 데이터가 없습니다.', 'normal'),
      metric('appeal_timing', '어필 타이밍', '대기', null, '채팅이 쌓이면 판단합니다.', 'normal'),
      metric('dispute_level', '이견·논쟁 강도', 0, '건', '아직 데이터가 없습니다.', 'good'),
      metric('churn_risk', '이탈 위험', 0, '%', '아직 데이터가 없습니다.', 'good'),
      metric('unanswered', '미응답 요구', 0, '건', '0 유지가 목표입니다.', 'good'),
      metric('risk_index', '리스크 지수', 0, '건', '아직 데이터가 없습니다.', 'good'),
      metric('agenda_focus', '아젠다 집중도', 0, '%', '아직 데이터가 없습니다.', 'normal'),
      metric('cpm', '채팅 활성도', 0, 'CPM', '아직 데이터가 없습니다.', 'normal'),
    ],
    actionCards: [],
    unanswered: [],
    agendaInterest: [],
    riskAlerts: [],
    faq: [],
    recentSummary: '아직 수집된 댓글이 없습니다. 방송이 시작되면 실시간으로 분석합니다.',
    hostAdvice: '채팅이 쌓이는 대로 아젠다와 리스크를 알려드리겠습니다.',
  };
}

/**
 * 로컬 시뮬레이터 진입점.
 * L1 통계를 그대로 KPI·카드·큐로 변환한다. AI 호출은 없다.
 */
export function generateSimulatedTalkAnalysis(
  messages: ChatLike[],
  issues: LiveIssue[] = [],
  precomputed?: PrefilterStats,
): TalkAnalysisResult {
  if (!messages || messages.length === 0) return emptyResult();

  const stats =
    precomputed ??
    runPrefilter(messages, {
      issueKeywords: issues.flatMap((i) => i.keywords ?? []),
      figures: issues.flatMap((i) => i.figures ?? []),
    });

  const allHits = [...stats.riskCandidates, ...stats.requestCandidates, ...stats.others];
  // 동일 문구는 접어서 대표 1건 + duplicateCount로 전달한다 (AI 경로의 층화 표본과 같은 원리)
  const foldedRisk = foldByText(stats.riskCandidates);
  const foldedRequests = foldByText(stats.requestCandidates);
  const analyses = foldByText(allHits).slice(0, 200).map((h) => toAnalysis(h, issues));

  const total = stats.total;
  const tc = stats.tagCounts;
  const ac = stats.axisCounts;

  // ── KPI ────────────────────────────────────────────────────────────────────
  const rallyRaw = tc.agree_support + tc.outrage + tc.hope_cheer + tc.community_bond;
  const rallyHeat = pct(rallyRaw, total);
  const supportSignal = tc.superchat + tc.membership;
  const disputeLevel = tc.disagree_object + tc.whataboutism;
  const churnRisk = pct(tc.fatigue_disengage + tc.despair, total);
  const riskIndex =
    tc.hate_slur + tc.defamation_risk + tc.misinfo_suspect + tc.election_law_watch + tc.brigading_spam;
  // 미응답 "요구 수"는 서로 다른 요구의 개수여야 한다. 같은 질문을 200명이 했으면
  // 진행자가 답할 것은 1건이지 200건이 아니다. (총 발생 건수는 duplicateCount로 표현)
  const unansweredCount = foldedRequests.length;

  const topAxisCount = Math.max(...TALK_AXES.map((a) => ac[a]));
  const agendaFocus = pct(topAxisCount, total);
  const appealOpen = rallyHeat >= 30 && riskIndex === 0;

  const metrics: TalkMetric[] = [
    metric('rally_heat', '결집 온도', rallyHeat, '%', '동의·환호·분노의 합산 비율입니다.', rallyHeat >= 40 ? 'good' : 'normal'),
    metric('support_signal', '후원 신호', supportSignal, '건', '슈퍼챗·멤버십 관련 언급 수입니다.', supportSignal > 0 ? 'good' : 'normal'),
    metric('appeal_timing', '어필 타이밍', appealOpen ? '지금' : '대기', null, appealOpen ? '결집 온도가 높고 리스크가 없습니다.' : '조건이 갖춰지면 알려드립니다.', appealOpen ? 'good' : 'normal'),
    metric('dispute_level', '이견·논쟁 강도', disputeLevel, '건', '반대·맞불 표현 수입니다.', statusFor(disputeLevel, 5, 15)),
    metric('churn_risk', '이탈 위험', churnRisk, '%', '피로·체념 표현 비율입니다.', statusFor(churnRisk, 10, 25)),
    metric('unanswered', '미응답 요구', unansweredCount, '건', '0 유지가 목표입니다.', statusFor(unansweredCount, 3, 8)),
    metric('risk_index', '리스크 지수', riskIndex, '건', '혐오·명예훼손 소지·미확인 주장·도배 합계입니다.', statusFor(riskIndex, 2, 5)),
    metric('agenda_focus', '아젠다 집중도', agendaFocus, '%', '관심이 한 축으로 모인 정도입니다.', 'normal'),
    metric('cpm', '채팅 활성도', Math.round(stats.cpm), 'CPM', stats.spike ? '직전 대비 급증했습니다.' : '분당 댓글 수입니다.', stats.spike ? 'warning' : 'normal'),
  ];

  // ── 리스크 알림 ────────────────────────────────────────────────────────────
  const riskAlerts: RiskAlert[] = foldedRisk
    .filter((h) => h.tag !== 'other')
    .slice(0, 20)
    .map((h, idx) => {
      const tag = h.tag as RiskTag;
      return {
        id: `risk-${idx}-${h.message.id}`,
        tag,
        severity: RISK_SEVERITY[tag] ?? 'low',
        text: h.message.message ?? '',
        author: h.message.author ?? null,
        detectedAt: h.message.timestamp ?? new Date().toISOString(),
        spreadCount: h.duplicateCount,
        reason: RISK_REASON[tag] ?? '검토가 필요한 표현입니다.',
        recommendation: RISK_RECOMMENDATION[tag] ?? '모더레이터 확인을 권장합니다.',
      };
    })
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      return rank[a.severity] - rank[b.severity] || b.spreadCount - a.spreadCount;
    });

  // ── 미응답 요구 큐 ─────────────────────────────────────────────────────────
  const unanswered: UnansweredRequest[] = foldedRequests
    .slice(0, 20)
    .map((h, idx) => {
      const text = h.message.message ?? '';
      const issue = issues.find((i) => (i.keywords ?? []).some((k) => k && text.includes(k)));
      const preset = issue?.presetFaqs?.find((f) => f.q && text.includes(f.q.slice(0, 4)));
      return {
        id: `req-${idx}-${h.message.id}`,
        text,
        author: h.message.author ?? null,
        askedAt: h.message.timestamp ?? new Date().toISOString(),
        issueId: issue?.id ?? null,
        tag: h.tag,
        urgency: urgencyFor(h.tag, h.duplicateCount),
        suggestedAnswer: preset?.a ?? null,
      };
    });

  // ── 아젠다 랭킹 ────────────────────────────────────────────────────────────
  const agendaInterest: AgendaInterest[] = issues.map((issue) => {
    const matched = allHits.filter((h) => {
      const t = h.message.message ?? '';
      return (
        (issue.keywords ?? []).some((k) => k && t.includes(k)) ||
        (issue.figures ?? []).some((f) => f && t.includes(f))
      );
    });
    const mentionCount = matched.reduce((s, h) => s + h.duplicateCount, 0);
    const requestCount = matched.filter((h) => REQUEST_TAGS.has(h.tag)).length;
    return {
      issueId: issue.id,
      title: issue.title,
      interestScore: Math.min(100, pct(mentionCount, Math.max(1, total)) * 2),
      mentionCount,
      requestCount,
      isRising: false,
    };
  }).sort((a, b) => b.interestScore - a.interestScore);

  // ── 액션 카드 ──────────────────────────────────────────────────────────────
  const actionCards: TalkActionCard[] = [];
  // 건수만으로 판단하면 놓치는 경우가 있다: 9개 계정이 같은 문구를 뿌리는 조직적 도배는
  // 태그 카운트로는 1건이지만 진행자가 즉시 알아야 하는 상황이다.
  // 심각도와 도배 신호를 함께 본다.
  const hasHighRisk = riskAlerts.some((r) => r.severity === 'high');
  const needsRiskCard =
    riskAlerts.length > 0 && (riskIndex >= 2 || hasHighRisk || stats.brigading.length > 0);
  if (needsRiskCard) {
    actionCards.push({
      id: 'card-risk',
      priority: 'high',
      title: '댓글창 리스크 확인 필요',
      reason:
        stats.brigading.length > 0
          ? `동일 문구가 반복·확산되고 있습니다 (도배 신호 ${stats.brigading.length}건).`
          : `리스크 신호 ${riskIndex}건이 감지되었습니다.`,
      suggestedLine: '댓글창이 조금 과열된 것 같습니다. 잠시 정리하겠습니다.',
      evidence: riskAlerts.slice(0, 3).map((r) => r.text),
      targetIssueId: null,
    });
  }
  if (unansweredCount >= 3) {
    actionCards.push({
      id: 'card-answer',
      priority: unansweredCount >= 8 ? 'high' : 'medium',
      title: '미응답 요구 정리',
      reason: `답변 대기 중인 질문·요구가 ${unansweredCount}건입니다.`,
      suggestedLine: '질문 몇 개 놓쳤네요. 지금 한 번에 정리해서 답변드리겠습니다.',
      evidence: unanswered.slice(0, 3).map((u) => u.text),
      targetIssueId: null,
    });
  }
  if (tc.source_request >= 2) {
    actionCards.push({
      id: 'card-source',
      priority: 'medium',
      title: '근거 자료 요청 집중',
      reason: `자료·출처 요청이 ${tc.source_request}건입니다.`,
      suggestedLine: '근거 자료 요청이 많으십니다. 원문을 화면에 띄우겠습니다.',
      evidence: [],
      targetIssueId: agendaInterest[0]?.issueId ?? null,
    });
  }
  if (churnRisk >= 10 && actionCards.length < 3) {
    actionCards.push({
      id: 'card-fatigue',
      priority: 'medium',
      title: '이탈 신호 감지',
      reason: `피로·체념 표현이 ${churnRisk}%입니다.`,
      suggestedLine: '주제를 한 번 전환하거나 시청자 사연을 받아보겠습니다.',
      evidence: [],
      targetIssueId: null,
    });
  }
  if (appealOpen && actionCards.length < 3) {
    actionCards.push({
      id: 'card-appeal',
      priority: 'low',
      title: '구독·후원 안내 적기',
      reason: `결집 온도 ${rallyHeat}%로 반응이 좋습니다.`,
      suggestedLine: '오늘 방송 도움이 되셨다면 구독과 알림 설정 부탁드립니다.',
      evidence: [],
      targetIssueId: null,
    });
  }

  // ── FAQ 후보 ───────────────────────────────────────────────────────────────
  const faq: TalkFaqItem[] = stats.clusters
    .filter((c) => c.count >= 2 && !c.key.startsWith(' empty:'))
    .slice(0, 5)
    .map((c) => ({
      question: c.representative.message ?? '',
      count: c.count,
      templateAnswer: '방송 중 자세히 설명드리겠습니다. 관련 자료도 함께 안내하겠습니다.',
      issueId: null,
    }));

  const topAgenda = agendaInterest[0]?.title;
  const recentSummary =
    `최근 ${total}건(고유 ${stats.unique}건)의 채팅을 확인했습니다. ` +
    `결집 온도 ${rallyHeat}%, 이견 ${disputeLevel}건, 미응답 요구 ${unansweredCount}건입니다. ` +
    (riskIndex > 0
      ? `리스크 신호 ${riskIndex}건이 있어 댓글창 확인이 필요합니다.`
      : '리스크 신호는 감지되지 않았습니다.');

  const hostAdvice =
    riskIndex >= 2
      ? '댓글창 정리를 먼저 하시고, 단정적 표현은 피해 주십시오.'
      : unansweredCount >= 3
        ? '쌓인 질문부터 한 번에 정리해 답변하시는 것이 좋겠습니다.'
        : topAgenda
          ? `지금은 "${topAgenda}" 관심이 가장 높습니다. 이 사안을 이어가십시오.`
          : '지금 흐름이 안정적입니다. 현재 주제를 이어가십시오.';

  return {
    analyses,
    metrics,
    actionCards: actionCards.slice(0, 3),
    unanswered,
    agendaInterest,
    riskAlerts,
    faq,
    recentSummary,
    hostAdvice,
  };
}

/** 종료 리포트 시뮬레이터 — 키 없는 환경에서도 리포트를 제공한다 */
export function generateSimulatedTalkReport(
  messages: ChatLike[],
  issues: LiveIssue[] = [],
  peakCpm = 0,
): TalkReportResult {
  const analysis = generateSimulatedTalkAnalysis(messages, issues);
  const stats = runPrefilter(messages, {
    issueKeywords: issues.flatMap((i) => i.keywords ?? []),
    figures: issues.flatMap((i) => i.figures ?? []),
  });

  const supportCount = stats.tagCounts.superchat + stats.tagCounts.membership;
  const unansweredCount = analysis.unanswered.length;
  const riskCount = analysis.riskAlerts.length;
  const topAgenda = analysis.agendaInterest[0]?.title ?? '-';
  const requestTotal = stats.requestCandidates.length;
  const answerRate = requestTotal > 0 ? Math.max(0, 100 - Math.round((unansweredCount / requestTotal) * 100)) : 100;

  const reportMarkdown = [
    '## 📊 방송 성과 요약',
    `- 총 댓글 **${stats.total}건** (고유 문구 ${stats.unique}건, 중복률 ${stats.dedupeRate.toFixed(1)}%)`,
    `- 고유 참여자 **${stats.authorCount}명**, 최고 분당 댓글 **${peakCpm} CPM**`,
    `- 후원 신호 **${supportCount}건**`,
    '',
    '## 🎯 아젠다별 반응',
    analysis.agendaInterest.length > 0
      ? analysis.agendaInterest
          .map((a) => `- **${a.title}** — 언급 ${a.mentionCount}건, 요구 ${a.requestCount}건 (관심도 ${a.interestScore})`)
          .join('\n')
      : '- 등록된 큐시트가 없어 이슈별 집계를 생략합니다.',
    '',
    '## ⚡ 골든 모먼트',
    '- 세부 시계열은 대시보드의 타임라인에서 확인하실 수 있습니다.',
    '',
    '## 🕳️ 놓친 요구',
    `- 미응답으로 남은 요구 **${unansweredCount}건**, 응답률 약 **${answerRate}%**`,
    analysis.unanswered.slice(0, 5).map((u) => `  - "${u.text}"`).join('\n') || '  - 없음',
    '',
    '## ⚠️ 리스크 결산',
    `- 리스크 신호 **${riskCount}건**`,
    riskCount > 0
      ? analysis.riskAlerts.slice(0, 5).map((r) => `  - [${r.severity}] ${r.reason}`).join('\n')
      : '  - 감지된 신호가 없습니다.',
    '',
    '> 리스크 판단은 참고용이며 법적 판정이 아닙니다.',
    '',
    '## 💜 시청자 결산',
    `- 고유 참여자 ${stats.authorCount}명, 후원 신호 ${supportCount}건`,
    '',
    '## 🚀 다음 방송 아젠다 추천',
    unansweredCount > 0
      ? '- 오늘 답하지 못한 요구를 다음 방송 앞부분에서 먼저 정리하십시오.'
      : '- 미해소 요구가 없습니다. 급상승 이슈를 새로 준비하십시오.',
    topAgenda !== '-' ? `- "${topAgenda}" 후속 전개를 준비하십시오.` : '',
  ].join('\n');

  return {
    reportMarkdown,
    summaryStats: {
      totalMessages: stats.total,
      peakCpm: Math.round(peakCpm),
      topAgenda,
      supportCount,
      unansweredCount,
      answerRate,
      riskCount,
    },
  };
}
