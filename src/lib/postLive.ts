/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-3 종료 후 심화 분석 — 세션 데이터(타임라인·멘트 마킹·분석·시청자 요약)에서
 * 골든 모먼트 / 시간대 히트맵 / 이탈 분석 / 다음 방송 체크리스트를 파생. 외부 호출 없음.
 */

import {
  GoldenMoment,
  MentionMark,
  PostLiveInsights,
  ShopAnalysisResult,
  ShopTimelinePoint,
  TimeBucket,
} from '../types/liveShopping';
import { ViewerSummary } from './buildViewerProfiles';

const MENTION_WINDOW_MS = 60_000;

interface PostLiveInput {
  timeline: ShopTimelinePoint[];
  marks: MentionMark[];
  analysis: ShopAnalysisResult | null;
  summary: ViewerSummary;
}

function nearestMention(t: number, marks: MentionMark[]): string | null {
  let best: string | null = null;
  let bestDiff = MENTION_WINDOW_MS;
  for (const m of marks) {
    const mt = new Date(m.at).getTime();
    const diff = t - mt; // 멘트가 그 시점 직전(0~window)일 때
    if (diff >= 0 && diff <= bestDiff) {
      bestDiff = diff;
      best = m.label;
    }
  }
  return best;
}

function buildGoldenMoments(timeline: ShopTimelinePoint[], marks: MentionMark[]): GoldenMoment[] {
  const deltas: GoldenMoment[] = [];
  for (let i = 1; i < timeline.length; i++) {
    const delta = timeline[i].purchased - timeline[i - 1].purchased;
    if (delta > 0) {
      deltas.push({
        t: timeline[i].t,
        purchasedDelta: delta,
        temp: timeline[i].purchaseTemp,
        mention: nearestMention(timeline[i].t, marks),
      });
    }
  }
  return deltas.sort((a, b) => b.purchasedDelta - a.purchasedDelta || b.temp - a.temp).slice(0, 3);
}

function buildTimeBuckets(timeline: ShopTimelinePoint[], bucketCount = 6): TimeBucket[] {
  if (timeline.length === 0) return [];
  const n = Math.min(bucketCount, timeline.length);
  const size = Math.ceil(timeline.length / n);
  const buckets: TimeBucket[] = [];
  for (let i = 0; i < timeline.length; i += size) {
    const slice = timeline.slice(i, i + size);
    const avgTemp = Math.round(slice.reduce((s, p) => s + p.purchaseTemp, 0) / slice.length);
    const purchased = slice[slice.length - 1].purchased - (i > 0 ? timeline[i - 1].purchased : 0);
    buckets.push({ label: `구간 ${buckets.length + 1}`, avgTemp, purchased: Math.max(0, purchased) });
  }
  return buckets;
}

function detectDropOff(timeline: ShopTimelinePoint[]): { detected: boolean; note: string } {
  if (timeline.length < 3) return { detected: false, note: '추이 데이터가 충분하지 않습니다.' };
  let peak = 0;
  let peakIdx = 0;
  timeline.forEach((p, i) => {
    if (p.purchaseTemp > peak) {
      peak = p.purchaseTemp;
      peakIdx = i;
    }
  });
  const last = timeline[timeline.length - 1];
  const maxUnanswered = Math.max(...timeline.map((p) => p.unansweredCount));
  if (peak >= 40 && last.purchaseTemp <= peak * 0.5 && peakIdx < timeline.length - 1) {
    return { detected: true, note: `구매 온도가 피크(${peak}%) 이후 ${last.purchaseTemp}%로 식었습니다 — 그 구간 직전 신호를 점검하세요.` };
  }
  if (maxUnanswered >= 5) {
    return { detected: true, note: `미응답 질문이 한때 ${maxUnanswered}건까지 쌓였습니다 — 응대 누락이 이탈로 이어졌을 수 있습니다.` };
  }
  return { detected: false, note: '뚜렷한 이탈 구간은 감지되지 않았습니다.' };
}

function buildChecklist(analysis: ShopAnalysisResult | null, summary: ViewerSummary, timeline: ShopTimelinePoint[]): string[] {
  const list: string[] = [];
  const topProduct = analysis?.productInterest?.slice().sort((a, b) => b.interestScore - a.interestScore)[0];
  if (topProduct && topProduct.interestScore > 0) {
    list.push(`관심 1위 '${topProduct.name}'을 다음 방송 초반에 배치해 구매 온도를 빠르게 올리세요.`);
  }
  const unanswered = analysis?.unanswered?.length ?? 0;
  if (unanswered > 0) {
    list.push(`미응답 질문 ${unanswered}건을 다음 방송 사전 FAQ로 미리 안내하세요.`);
  }
  if (summary.hesitationByReason.length > 0) {
    const top = summary.hesitationByReason[0];
    list.push(`망설임 사유 1위에 대한 선제 안내 멘트를 준비하세요 (해당 사유 ${top.count}명).`);
  }
  if (summary.segments.hotLead > 0) {
    list.push(`미전환 핫리드 ${summary.segments.hotLead}명 — 클로징 멘트와 한정 혜택을 더 강하게.`);
  }
  const maxPriceResist = timeline.length > 0 ? Math.max(...timeline.map((p) => p.priceResistance)) : 0;
  if (maxPriceResist >= 3) {
    list.push('가격 저항이 높았던 구간이 있었습니다 — 혜택 포함 구성가를 더 자주 강조하세요.');
  }
  if (list.length === 0) {
    list.push('데이터가 더 쌓이면 다음 방송 개선 액션을 자동 제안합니다.');
  }
  return list;
}

export function buildPostLiveInsights({ timeline, marks, analysis, summary }: PostLiveInput): PostLiveInsights {
  return {
    goldenMoments: buildGoldenMoments(timeline, marks),
    timeBuckets: buildTimeBuckets(timeline),
    dropOff: detectDropOff(timeline),
    checklist: buildChecklist(analysis, summary, timeline),
  };
}
