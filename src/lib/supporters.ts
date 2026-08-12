/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 시청자 인텔리전스 (P-8) — author 단위 누적 집계.
 *
 * ⚠️ 안전 제약 (D-1 / D-2) — 이 파일의 존재 이유이자 한계
 *   쇼핑 트랙의 "핫리드 보드"(구매 가능성 점수)를 그대로 옮기면 안 된다.
 *   정치 도메인에서 개인을 성향으로 라벨링한 명단은 민감정보이며 방어 불가다.
 *
 *   따라서 여기서 계산하는 것은 **비민감 축만**이다:
 *     참여 빈도 · 후원/멤버십 여부 · 재방문 · 미응답 보유 · (행위 기준) 리스크 건수
 *
 *   계산하지 않는 것: 정치성향, 진영, 지지 정당, 특정 인물에 대한 호오.
 *   flag도 "행위" 기준이지 "생각" 기준이 아니다.
 *
 * 신규 AI 호출 없이 analyses에서 파생된다.
 */

import type {
  SupporterProfile,
  SupporterFlag,
  SupporterSummary,
  TalkCommentAnalysis,
  TalkTag,
  UnansweredRequest,
} from '../types/liveTalk.js';

/** 참여·충성 가중치 — 구매 가능성이 아니라 참여도다 */
const LOYALTY_WEIGHT: Partial<Record<TalkTag, number>> = {
  superchat: 25,
  membership: 25,
  subscribe_share: 10,
  attendance: 8,
  community_bond: 6,
  petition_action: 4,
  agree_support: 2,
  topic_request: 3,
  followup_request: 4, // 지난 방송을 기억하고 있다 = 재방문 신호
};

/** 행위 기준 리스크 태그 — 생각이 아니라 행동으로만 판단한다 */
const RISK_BEHAVIOR_TAGS = new Set<TalkTag>([
  'hate_slur',
  'defamation_risk',
  'brigading_spam',
]);

interface MessageLike {
  author?: string | null;
  isSponsor?: boolean;
  isModerator?: boolean;
}

export function buildSupporterProfiles(
  analyses: TalkCommentAnalysis[],
  unanswered: UnansweredRequest[],
  messages: MessageLike[] = [],
): SupporterProfile[] {
  if (analyses.length === 0) return [];

  // 멤버십 여부는 YouTube authorDetails.isChatSponsor에서 온다
  const memberAuthors = new Set<string>();
  for (const m of messages) {
    if (m.isSponsor && m.author) memberAuthors.add(m.author);
  }

  const unansweredAuthors = new Set(
    unanswered.map((u) => u.author).filter((a): a is string => !!a),
  );

  const map = new Map<string, SupporterProfile>();

  for (const a of analyses) {
    const author = a.author;
    if (!author) continue;

    // duplicateCount를 참여 가중치로 반영 — 표본 1건이 n건을 대표한다
    const weight = Math.max(1, a.duplicateCount);

    let p = map.get(author);
    if (!p) {
      p = {
        author,
        commentCount: 0,
        firstSeen: a.timestamp,
        lastSeen: a.timestamp,
        loyaltyScore: 0,
        topTags: [],
        interestedIssueIds: [],
        hasUnanswered: unansweredAuthors.has(author),
        isReturning: false,
        isSupporter: false,
        isMember: memberAuthors.has(author),
        riskFlagCount: 0,
        flag: 'normal',
      };
      map.set(author, p);
    }

    p.commentCount += weight;
    if (a.timestamp < p.firstSeen) p.firstSeen = a.timestamp;
    if (a.timestamp > p.lastSeen) p.lastSeen = a.timestamp;

    if (!p.topTags.includes(a.tag)) p.topTags.push(a.tag);
    if (a.issueId && !p.interestedIssueIds.includes(a.issueId)) {
      p.interestedIssueIds.push(a.issueId);
    }

    if (a.tag === 'superchat' || a.tag === 'membership') p.isSupporter = true;
    if (a.tag === 'attendance' || a.tag === 'followup_request') p.isReturning = true;
    if (RISK_BEHAVIOR_TAGS.has(a.tag)) p.riskFlagCount += 1;

    p.loyaltyScore += (LOYALTY_WEIGHT[a.tag] ?? 1) * Math.min(weight, 3);
  }

  for (const p of map.values()) {
    // 참여 빈도 보너스 (체감 곡선 — 도배가 점수를 지배하지 않도록 로그 스케일)
    p.loyaltyScore += Math.round(Math.log2(p.commentCount + 1) * 5);
    // 행위 기준 감점
    p.loyaltyScore -= p.riskFlagCount * 15;
    p.loyaltyScore = Math.max(0, Math.min(100, Math.round(p.loyaltyScore)));
    p.topTags = p.topTags.slice(0, 4);
    p.flag = classify(p);
  }

  return [...map.values()].sort((a, b) => b.loyaltyScore - a.loyaltyScore);
}

/** flag는 **행위** 기준이다. 정치적 견해로 사람을 분류하지 않는다. */
function classify(p: SupporterProfile): SupporterFlag {
  if (p.riskFlagCount >= 2) return 'troll';
  if (p.isSupporter || p.isMember) return 'core_supporter';
  if (p.isReturning || p.commentCount >= 3) return 'regular';
  return 'normal';
}

/** 배타적 세그먼트 결산 — 한 사람이 한 칸에만 들어간다 */
export function summarizeSupporters(profiles: SupporterProfile[]): SupporterSummary {
  const s: SupporterSummary = {
    total: profiles.length,
    supporters: 0,
    members: 0,
    regulars: 0,
    onlookers: 0,
    trolls: 0,
  };

  for (const p of profiles) {
    if (p.flag === 'troll') s.trolls++;
    else if (p.isSupporter) s.supporters++;
    else if (p.isMember) s.members++;
    else if (p.flag === 'regular') s.regulars++;
    else s.onlookers++;
  }

  return s;
}
