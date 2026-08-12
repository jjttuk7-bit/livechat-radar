/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 참여 퍼널 + 어필 윈도우 (P-8).
 *
 * 쇼핑의 "전환 퍼널/클로징 윈도우"에 대응하지만 대상이 다르다.
 * 쇼핑은 구매(관심→고려→임박→구매), 정치·시사는 참여(채팅→반복→능동행동→후원)다.
 *
 * ⚠️ D-6: 어필 멘트는 구독·후원 안내에 한정한다. 시청자를 결집시켜 특정 대상을
 *   겨냥하게 하는 문구는 만들지 않는다.
 *
 * 신규 AI 호출 없이 파생된다.
 */

import type {
  AppealWindow,
  ParticipationFunnel,
  SupporterProfile,
  TalkAnalysisResult,
  TalkTimelinePoint,
} from '../types/liveTalk.js';

/**
 * 파생 지표 — **AI가 지어낸 metric id에 의존하지 않고** analyses에서 직접 계산한다.
 *
 * 왜 이렇게 하는가: metrics 배열의 `id`는 모델이 자유롭게 만드는 문자열이다. 실제로
 * 같은 프롬프트에서 어떤 호출은 9개(`rally_heat` 등)를, 어떤 호출은 4개(`총 댓글 수` 등)를
 * 냈다. 기계가 읽어야 하는 값을 모델의 작명에 맡기면 조용히 0이 되고, 어필 윈도우와
 * 타임라인이 통째로 잘못된다. metrics는 **표시 전용**으로 두고 계산은 태그에서 한다.
 */
export interface DerivedStats {
  /** 결집 온도 % — 동의·환호·유대·분노의 가중 비율 */
  rallyHeat: number;
  /** 이견·논쟁 건수 */
  disputeLevel: number;
  /** 이탈 위험 % — 피로·체념 비율 */
  churnRisk: number;
  /** 후원 신호 건수 */
  supportSignal: number;
  /** 리스크 알림 건수 */
  riskCount: number;
  /** 심각도 높은 리스크 건수 */
  highRiskCount: number;
}

const RALLY_TAGS = new Set(['agree_support', 'hope_cheer', 'community_bond', 'outrage']);
const DISPUTE_TAGS = new Set(['disagree_object', 'whataboutism']);
const CHURN_TAGS = new Set(['fatigue_disengage', 'despair']);
const SUPPORT_TAGS = new Set(['superchat', 'membership']);

export function deriveStats(analysis: TalkAnalysisResult | null): DerivedStats {
  const empty: DerivedStats = {
    rallyHeat: 0, disputeLevel: 0, churnRisk: 0,
    supportSignal: 0, riskCount: 0, highRiskCount: 0,
  };
  if (!analysis) return empty;

  const items = analysis.analyses ?? [];
  let total = 0;
  let rally = 0;
  let dispute = 0;
  let churn = 0;
  let support = 0;

  for (const a of items) {
    // duplicateCount를 가중치로 — 표본 1건이 n건을 대표한다
    const w = Math.max(1, a.duplicateCount);
    total += w;
    if (RALLY_TAGS.has(a.tag)) rally += w;
    if (DISPUTE_TAGS.has(a.tag)) dispute += w;
    if (CHURN_TAGS.has(a.tag)) churn += w;
    if (SUPPORT_TAGS.has(a.tag)) support += w;
  }

  const risks = analysis.riskAlerts ?? [];

  return {
    rallyHeat: total > 0 ? Math.round((rally / total) * 100) : 0,
    disputeLevel: dispute,
    churnRisk: total > 0 ? Math.round((churn / total) * 100) : 0,
    supportSignal: support,
    riskCount: risks.length,
    highRiskCount: risks.filter((r) => r.severity === 'high').length,
  };
}

/**
 * 참여 퍼널.
 *
 * 단계는 포함 관계다(상위 단계는 하위 단계에도 포함). 그래야 "고려는 많은데 결제로
 * 안 넘어간다" 같은 단계별 이탈 해석이 성립한다.
 */
export function buildParticipationFunnel(profiles: SupporterProfile[]): ParticipationFunnel {
  const commented = profiles.length;
  const engaged = profiles.filter((p) => p.commentCount >= 2).length;

  const ADVOCACY_TAGS = new Set(['subscribe_share', 'community_bond', 'petition_action']);
  const advocated = profiles.filter(
    (p) => p.isSupporter || p.isMember || p.topTags.some((t) => ADVOCACY_TAGS.has(t)),
  ).length;

  const supported = profiles.filter((p) => p.isSupporter || p.isMember).length;

  return {
    commented,
    engaged,
    advocated,
    supported,
    supportRate: commented > 0 ? Math.round((supported / commented) * 100) : 0,
  };
}

/**
 * 어필 윈도우 — 지금이 구독·후원 안내 적기인가.
 *
 * 리스크가 있으면 열지 않는다. 댓글창이 과열된 순간에 후원 안내를 하면
 * 진행자가 상황을 놓치고 있다는 인상만 준다.
 */
export function detectAppealWindow(
  analysis: TalkAnalysisResult | null,
  timeline: TalkTimelinePoint[] = [],
): AppealWindow {
  if (!analysis) {
    return { open: false, score: 0, reasons: [], suggestedLine: '' };
  }

  // metric id가 아니라 태그에서 파생 — 모델 작명에 의존하지 않는다
  const { rallyHeat: heat, supportSignal: support, churnRisk: churn, riskCount: risk, highRiskCount: highRisk } =
    deriveStats(analysis);

  const reasons: string[] = [];
  let score = 0;

  if (heat >= 50) {
    score += 40;
    reasons.push(`결집 온도 ${heat}%로 반응이 좋습니다.`);
  } else if (heat >= 30) {
    score += 20;
    reasons.push(`결집 온도 ${heat}%로 분위기가 안정적입니다.`);
  }

  // 후원 가속 — 최근 두 포인트의 증가분
  if (timeline.length >= 2) {
    const last = timeline[timeline.length - 1];
    const prev = timeline[timeline.length - 2];
    const delta = last.supportCount - prev.supportCount;
    if (delta > 0) {
      score += 25;
      reasons.push(`직전 구간 대비 후원 신호가 ${delta}건 늘었습니다.`);
    }
  }

  if (support > 0) {
    score += 15;
    reasons.push(`후원·멤버십 언급이 ${support}건 있습니다.`);
  }

  if (churn >= 20) {
    score -= 20;
    reasons.push(`이탈 신호 ${churn}%가 감지되어 타이밍이 좋지 않습니다.`);
  }

  // 리스크가 있으면 창을 닫는다 — 우선순위는 채널 방어다
  if (highRisk > 0) {
    score = 0;
    reasons.push('심각도 높은 리스크가 있어 지금은 안내 시점이 아닙니다.');
  } else if (risk >= 3) {
    score -= 30;
    reasons.push(`리스크 신호 ${risk}건을 먼저 정리하십시오.`);
  }

  score = Math.max(0, Math.min(100, score));
  const open = score >= 50;

  return {
    open,
    score,
    reasons,
    suggestedLine: open
      ? '오늘 내용이 도움이 되셨다면 구독과 알림 설정 부탁드립니다. 후원해 주신 분들께도 감사드립니다.'
      : '',
  };
}
