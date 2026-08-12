/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 크로스세션 파생 (P-11) — 저장된 회차들에서 계산한다.
 *
 * 매일 방송 + 고정 시청층이라는 정치·시사의 특성이 처음으로 자산이 되는 지점이다.
 * 쇼핑에서는 방송이 비정기라 이 계산이 의미가 없었다.
 *
 * ⚠️ D-8: 참여자는 해시로만 비교한다. 원문 닉네임은 이 계층에 존재하지 않는다.
 */

import type {
  AgendaTrend,
  SessionComparison,
  SessionRecord,
  TalkAnalysisResult,
  TalkReportResult,
} from '../types/liveTalk.js';
import { hashAuthor } from './sessionStore.js';

/**
 * 분석·리포트 결과를 저장 가능한 회차 레코드로 압축한다.
 *
 * 여기서 **원문이 떨어져 나간다**: 댓글 원문·닉네임은 남기지 않고, 집계치와 해시만 남는다.
 * 미응답 요구는 다음 방송 이월을 위해 질문 텍스트만 짧게 보관한다(작성자 정보 없이).
 */
export function buildSessionRecord(params: {
  id: string;
  title: string;
  startedAt: string;
  endedAt?: string;
  analysis: TalkAnalysisResult | null;
  report: TalkReportResult | null;
  timelineAvgHeat: number;
  peakCpm: number;
  authors: string[];
}): SessionRecord {
  const { analysis, report } = params;
  const stats = report?.summaryStats;

  return {
    id: params.id,
    title: params.title,
    startedAt: params.startedAt,
    endedAt: params.endedAt ?? new Date().toISOString(),
    totalMessages: stats?.totalMessages ?? 0,
    peakCpm: Math.round(params.peakCpm),
    avgRallyHeat: Math.round(params.timelineAvgHeat),
    supportCount: stats?.supportCount ?? 0,
    riskCount: stats?.riskCount ?? analysis?.riskAlerts?.length ?? 0,
    unansweredCount: stats?.unansweredCount ?? analysis?.unanswered?.length ?? 0,
    answerRate: stats?.answerRate ?? 0,
    agenda: (analysis?.agendaInterest ?? []).map((a) => ({
      title: a.title,
      interestScore: a.interestScore,
      mentionCount: a.mentionCount,
    })),
    // 원문 그대로가 아니라 길이를 잘라 보관 — 이월 목적에는 요지만 있으면 된다
    carryOverRequests: (analysis?.unanswered ?? []).slice(0, 10).map((u) => u.text.slice(0, 80)),
    // D-8: 해시만
    participantHashes: [...new Set(params.authors.filter(Boolean))].map((a) => hashAuthor(a)),
  };
}

/** 직전 회차 대비 비교 */
export function compareToPrevious(
  current: SessionRecord,
  history: SessionRecord[],
): SessionComparison {
  // 자기 자신을 제외하고, 시작 시각이 더 이른 것 중 가장 최근
  const previous =
    history
      .filter((r) => r.id !== current.id && r.startedAt < current.startedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;

  if (!previous) {
    return { current, previous: null, deltas: null, returningCount: 0, returningRate: 0 };
  }

  const prevSet = new Set(previous.participantHashes);
  const returningCount = current.participantHashes.filter((h) => prevSet.has(h)).length;

  return {
    current,
    previous,
    deltas: {
      totalMessages: current.totalMessages - previous.totalMessages,
      peakCpm: current.peakCpm - previous.peakCpm,
      avgRallyHeat: current.avgRallyHeat - previous.avgRallyHeat,
      supportCount: current.supportCount - previous.supportCount,
      riskCount: current.riskCount - previous.riskCount,
      answerRate: current.answerRate - previous.answerRate,
    },
    returningCount,
    returningRate:
      current.participantHashes.length > 0
        ? Math.round((returningCount / current.participantHashes.length) * 100)
        : 0,
  };
}

/**
 * 이슈별 회차 추이 — "이 사안이 며칠째 화제인가".
 *
 * 소재 수명을 보여주는 지표다. 관심도가 꺾이기 시작하면 다음 주제를 준비해야 한다.
 */
export function buildAgendaTrends(history: SessionRecord[], limit = 8): AgendaTrend[] {
  // 오래된 것부터 정렬해 시계열로 만든다
  const ordered = [...history].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const byTitle = new Map<string, AgendaTrend>();

  for (const session of ordered) {
    for (const item of session.agenda) {
      let t = byTitle.get(item.title);
      if (!t) {
        t = { title: item.title, points: [], direction: 'flat', streak: 0 };
        byTitle.set(item.title, t);
      }
      t.points.push({
        sessionId: session.id,
        at: session.startedAt,
        interestScore: item.interestScore,
        mentionCount: item.mentionCount,
      });
    }
  }

  const trends = [...byTitle.values()];

  for (const t of trends) {
    // 연속 등장 회차 — 마지막 회차부터 거슬러 올라가며 끊기지 않은 구간
    const sessionIds = ordered.map((s) => s.id);
    let streak = 0;
    for (let i = sessionIds.length - 1; i >= 0; i--) {
      if (t.points.some((p) => p.sessionId === sessionIds[i])) streak++;
      else break;
    }
    t.streak = streak;

    if (t.points.length >= 2) {
      const last = t.points[t.points.length - 1].interestScore;
      const prev = t.points[t.points.length - 2].interestScore;
      // 소폭 변동은 flat으로 — 매 회차 방향이 뒤집히면 신호로 쓸 수 없다
      const diff = last - prev;
      t.direction = diff > 5 ? 'rising' : diff < -5 ? 'falling' : 'flat';
    }
  }

  // 최근 관심도 높은 순
  return trends
    .sort((a, b) => {
      const av = a.points[a.points.length - 1]?.interestScore ?? 0;
      const bv = b.points[b.points.length - 1]?.interestScore ?? 0;
      return bv - av;
    })
    .slice(0, limit);
}

/**
 * 단골 누적 — 최근 N회차에 몇 번 참여했는가.
 *
 * 해시 단위이므로 "누구인지"는 알 수 없고 "몇 명이 얼마나 자주 오는가"만 알 수 있다.
 * 그것이 이 지표에 필요한 전부다 (D-1 / D-8).
 */
export interface ReturningStats {
  /** 비교 대상 회차 수 */
  sessions: number;
  /** 고유 참여자 수 (해시 기준) */
  uniqueParticipants: number;
  /** 2회 이상 참여 */
  returning: number;
  /** 절반 이상 참여 */
  core: number;
  /** 재방문율 % */
  returningRate: number;
  /** 참여 횟수 분포 — [1회, 2회, ...] */
  distribution: { visits: number; count: number }[];
}

export function buildReturningStats(history: SessionRecord[]): ReturningStats {
  const counts = new Map<string, number>();
  for (const s of history) {
    for (const h of new Set(s.participantHashes)) {
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
  }

  const unique = counts.size;
  const values = [...counts.values()];
  const returning = values.filter((v) => v >= 2).length;
  const half = Math.max(2, Math.ceil(history.length / 2));
  const core = values.filter((v) => v >= half).length;

  const distMap = new Map<number, number>();
  for (const v of values) distMap.set(v, (distMap.get(v) ?? 0) + 1);

  return {
    sessions: history.length,
    uniqueParticipants: unique,
    returning,
    core,
    returningRate: unique > 0 ? Math.round((returning / unique) * 100) : 0,
    distribution: [...distMap.entries()]
      .map(([visits, count]) => ({ visits, count }))
      .sort((a, b) => a.visits - b.visits),
  };
}

/**
 * 미해소 요구 이월 — 직전 회차에서 답하지 못한 질문을 오늘 큐 앞에 올린다.
 * 진행자가 "어제 못 답한 것부터"를 자동으로 챙기게 한다.
 */
export function buildCarryOver(history: SessionRecord[], limit = 5): string[] {
  const latest = [...history].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  return latest?.carryOverRequests?.slice(0, limit) ?? [];
}
