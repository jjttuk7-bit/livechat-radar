/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-4-4 멀티상품 타임블록 — 상품 소개 구간별 소요시간·댓글·구매 집계. 외부 호출 없음.
 */

import { ProductBlock, ShopTimelinePoint } from '../types/liveShopping';

interface LiteMsg {
  timestamp: string;
}

export interface BlockSummary {
  durationSec: number;
  comments: number;
  purchased: number;
  isLive: boolean;
}

/** 한 타임블록의 구간 지표를 계산. nowMs는 진행중 블록의 종료 기준. */
export function summarizeBlock(
  block: ProductBlock,
  messages: LiteMsg[],
  timeline: ShopTimelinePoint[],
  nowMs: number = Date.now(),
): BlockSummary {
  const start = Date.parse(block.startedAt);
  const end = block.endedAt ? Date.parse(block.endedAt) : nowMs;
  const durationSec = Math.max(0, Math.round((end - start) / 1000));

  const comments = messages.filter((m) => {
    const t = Date.parse(m.timestamp);
    return !Number.isNaN(t) && t >= start && t <= end;
  }).length;

  const purchasedAt = (boundary: number): number => {
    let val = 0;
    for (const p of timeline) {
      if (p.t <= boundary) val = p.purchased;
      else break;
    }
    return val;
  };
  const purchased = Math.max(0, purchasedAt(end) - purchasedAt(start));

  return { durationSec, comments, purchased, isLive: block.endedAt === null };
}

/** 초 → "m분 s초" 표기 */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}
