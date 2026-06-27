/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-1-1 핫리드 보드 — author 단위 시청자 프로필 집계.
 *
 * AI/시뮬레이터 응답의 `analyses`(ShopCommentAnalysis[])를 author로 묶어
 * 구매 가능성(leadScore)·퍼널 단계·망설임 사유 등을 산출한다. 신규 인프라/호출 없음.
 */

import {
  FunnelTag,
  ShopCommentAnalysis,
  ShopTag,
  TrustTag,
  UnansweredQuestion,
  ViewerFlag,
  ViewerProfile,
} from '../types/liveShopping';

/** 퍼널 단계 가중치 (leadScore 기여). 이탈 신호는 감점. */
const FUNNEL_WEIGHT: Record<FunnelTag, number> = {
  interest: 1,
  consideration: 3,
  purchase_intent: 6,
  purchased: 10,
  repurchase: 8,
  cart_abandon_signal: -3,
};

/** 퍼널 단계 우선순위 (높을수록 상위 단계) — funnelStage 결정용 */
const FUNNEL_RANK: Record<FunnelTag, number> = {
  cart_abandon_signal: 0,
  interest: 1,
  consideration: 2,
  repurchase: 3,
  purchase_intent: 4,
  purchased: 5,
};

const HESITATION_TAGS: TrustTag[] = ['hesitation_price', 'hesitation_need', 'hesitation_trust'];

function isFunnelTag(tag: ShopTag): tag is FunnelTag {
  return tag in FUNNEL_WEIGHT;
}

interface LiteMessage {
  author?: string;
  isSponsor?: boolean;
}

/**
 * author 단위 시청자 프로필을 leadScore 내림차순으로 반환.
 * @param analyses  분석된 댓글
 * @param unanswered 미응답 큐 (author 매칭으로 hasUnanswered 산출)
 * @param messages  멤버십(sponsor) 플래그 보강용 (선택)
 */
export function buildViewerProfiles(
  analyses: ShopCommentAnalysis[],
  unanswered: UnansweredQuestion[] = [],
  messages: LiteMessage[] = [],
): ViewerProfile[] {
  const unansweredAuthors = new Set(unanswered.map((q) => q.author).filter(Boolean) as string[]);
  const memberAuthors = new Set(messages.filter((m) => m.isSponsor && m.author).map((m) => m.author as string));

  const byAuthor = new Map<string, ShopCommentAnalysis[]>();
  for (const a of analyses) {
    if (!a.author) continue;
    const list = byAuthor.get(a.author);
    if (list) list.push(a);
    else byAuthor.set(a.author, [a]);
  }

  const profiles: ViewerProfile[] = [];
  for (const [author, items] of byAuthor) {
    const tagCounts = new Map<ShopTag, number>();
    const productIds = new Set<string>();
    const hesitation = new Set<TrustTag>();
    let funnelScore = 0;
    let bestRank = -1;
    let funnelStage: FunnelTag | 'none' = 'none';
    let questionCount = 0;
    let trollCount = 0;
    let isPurchaser = false;
    let isReturning = false;
    let firstSeen = items[0].timestamp;
    let lastSeen = items[0].timestamp;

    for (const a of items) {
      tagCounts.set(a.tag, (tagCounts.get(a.tag) ?? 0) + 1);
      if (a.productId) productIds.add(a.productId);
      if (a.isQuestion) questionCount++;
      if (a.tag === 'abuse_troll' || a.tag === 'spam_promo') trollCount++;
      if (HESITATION_TAGS.includes(a.tag as TrustTag)) hesitation.add(a.tag as TrustTag);
      if (a.tag === 'purchased' || a.tag === 'repurchase') isPurchaser = true;
      if (a.tag === 'repurchase') isReturning = true;
      if (isFunnelTag(a.tag)) {
        funnelScore += FUNNEL_WEIGHT[a.tag];
        if (FUNNEL_RANK[a.tag] > bestRank) {
          bestRank = FUNNEL_RANK[a.tag];
          funnelStage = a.tag;
        }
      }
      if (a.timestamp < firstSeen) firstSeen = a.timestamp;
      if (a.timestamp > lastSeen) lastSeen = a.timestamp;
    }

    const isMember = memberAuthors.has(author);
    const hasUnanswered = unansweredAuthors.has(author);

    // leadScore: 퍼널 가중 + 질문/빈도 관여 + 단골/멤버 가점 - 망설임 감점
    const raw =
      funnelScore +
      questionCount * 2 +
      items.length * 1 +
      (isReturning ? 10 : 0) +
      (isMember ? 5 : 0) -
      hesitation.size * 2;
    const leadScore = Math.max(0, Math.min(100, Math.round(raw * 5)));

    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);

    let flag: ViewerFlag = 'normal';
    if (trollCount >= 2) flag = 'troll';
    else if (isReturning) flag = 'regular';
    else if (!isPurchaser && bestRank >= FUNNEL_RANK.consideration && leadScore >= 40) flag = 'hot_lead';

    profiles.push({
      author,
      commentCount: items.length,
      firstSeen,
      lastSeen,
      leadScore,
      funnelStage,
      interestedProductIds: [...productIds],
      topTags,
      hesitationReasons: [...hesitation],
      hasUnanswered,
      isReturning,
      isPurchaser,
      isMember,
      flag,
    });
  }

  // 핫리드 우선 → leadScore 내림차순. 트롤은 뒤로.
  return profiles.sort((a, b) => {
    if (a.flag === 'troll' && b.flag !== 'troll') return 1;
    if (b.flag === 'troll' && a.flag !== 'troll') return -1;
    return b.leadScore - a.leadScore;
  });
}

// ── G-1-2/3/4: 세그먼트 · 망설임 · 트롤 요약 ──────────────────────────────────

export interface ViewerSummary {
  total: number;
  /** 배타적 세그먼트 (합 = total): 트롤 > 구매자 > 핫리드 > 단골 > 관망 */
  segments: { troll: number; purchaser: number; hotLead: number; regular: number; watching: number };
  hesitationByReason: Array<{ reason: TrustTag; count: number }>;
  trolls: string[]; // 트롤 author 목록
}

export function summarizeViewers(viewers: ViewerProfile[]): ViewerSummary {
  const segments = { troll: 0, purchaser: 0, hotLead: 0, regular: 0, watching: 0 };
  const hesitation = new Map<TrustTag, number>();
  const trolls: string[] = [];

  for (const v of viewers) {
    if (v.flag === 'troll') {
      segments.troll++;
      trolls.push(v.author);
    } else if (v.isPurchaser) {
      segments.purchaser++;
    } else if (v.flag === 'hot_lead') {
      segments.hotLead++;
    } else if (v.isReturning) {
      segments.regular++;
    } else {
      segments.watching++;
    }
    for (const r of v.hesitationReasons) hesitation.set(r, (hesitation.get(r) ?? 0) + 1);
  }

  const hesitationByReason = [...hesitation.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return { total: viewers.length, segments, hesitationByReason, trolls };
}
