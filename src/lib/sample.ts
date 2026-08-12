/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * L1 층화 표본 (P-2) — AI에 넘길 대표 댓글을 뽑는다.
 *
 * 이 모듈이 파이프라인의 핵심이다. **단순 무작위나 말단 N건은 대표성이 없다.**
 * CPM 300에서 `slice(-80)`은 40초 윈도우의 60%를 버리고, 버려지는 쪽이 무엇인지도 통제하지 못한다.
 *
 * 세 가지 원칙:
 *  1) 각 축에서 대표를 뽑는다 — 한 축이 표본에서 통째로 빠지면 AI가 그 축을 인식하지 못한다.
 *  2) 놓치면 안 되는 것은 전수로 넣는다 — 리스크·요구 후보는 확률에 맡기지 않는다.
 *  3) dedupe를 활용한다 — 대표 1건 + duplicateCount로 "n번 반복됐다"를 토큰 1건에 담는다.
 *
 * 표본 크기를 늘려도 **CPM과 무관하게 상수**라는 성질이 유지되어야 한다.
 *
 * 설계 근거: docs/plans/politics-pivot.md 4-2절.
 */

import { TALK_AXES, type TalkAxis, type TalkTag } from '../types/liveTalk.js';
import type { PrefilterHit, PrefilterStats } from './prefilter.js';

export interface SampledItem {
  id: string;
  text: string;
  author: string | null;
  timestamp: string | null;
  /** L1 추정 태그 — AI가 최종 확정하되 힌트로 제공 */
  l1Tag: TalkTag;
  axis: TalkAxis;
  /** 이 문구가 총 몇 건이었는지 */
  duplicateCount: number;
  /** 전수 포함(리스크·요구)인지 층화 표본으로 뽑힌 것인지 */
  inclusion: 'mandatory' | 'sampled';
}

export interface SampleResult {
  items: SampledItem[];
  /** 전수 포함 건수 */
  mandatoryCount: number;
  /** 층화 표본으로 뽑힌 건수 */
  sampledCount: number;
  /** 축별 포함 건수 — 커버리지 확인용 */
  axisCoverage: Record<TalkAxis, number>;
  /** 표본이 대표하는 원본 댓글 수 (duplicateCount 합) */
  representedMessages: number;
}

export interface SampleOptions {
  /** 목표 표본 크기 (기본 80). 전수 포함이 이를 넘으면 전수가 우선한다. */
  size?: number;
  /**
   * 전수 포함의 상한 (기본 200). 리스크·요구가 폭증해도 프롬프트가 무한히 커지지 않도록 한다.
   * 상한에 걸리면 duplicateCount가 큰 순으로 자른다 — 확산이 큰 것이 더 중요하다.
   */
  mandatoryCap?: number;
}

function toItem(hit: PrefilterHit, inclusion: SampledItem['inclusion']): SampledItem {
  return {
    id: hit.message.id,
    text: hit.message.message ?? '',
    author: hit.message.author ?? null,
    timestamp: hit.message.timestamp ?? null,
    l1Tag: hit.tag,
    axis: hit.axis,
    duplicateCount: hit.duplicateCount,
    inclusion,
  };
}

/** 동일 문구가 표본에 중복으로 들어가지 않도록 정규화 텍스트 기준으로 1건만 남긴다. */
function dedupeItems(items: SampledItem[]): SampledItem[] {
  const seenIds = new Set<string>();
  const seenText = new Set<string>();
  const out: SampledItem[] = [];
  for (const it of items) {
    if (seenIds.has(it.id)) continue;
    const key = it.text.trim();
    if (key.length > 0 && seenText.has(key)) continue;
    seenIds.add(it.id);
    if (key.length > 0) seenText.add(key);
    out.push(it);
  }
  return out;
}

/**
 * 층화 표본 추출.
 *
 * 순서:
 *  1. 리스크 후보 전수 (상한 적용 시 확산 큰 순)
 *  2. 요구 후보 전수 (상한 적용 시 확산 큰 순)
 *  3. 남은 자리를 축 라운드로빈으로 채운다 — 각 축이 최소 1건은 갖도록
 */
export function stratifiedSample(
  stats: PrefilterStats,
  opts: SampleOptions = {},
): SampleResult {
  const size = opts.size ?? 80;
  const mandatoryCap = opts.mandatoryCap ?? 200;

  const byDuplicateDesc = (a: PrefilterHit, b: PrefilterHit) =>
    b.duplicateCount - a.duplicateCount;

  // ── 1~2. 전수 포함 ─────────────────────────────────────────────────────────
  const risk = [...stats.riskCandidates].sort(byDuplicateDesc);
  const request = [...stats.requestCandidates].sort(byDuplicateDesc);

  let mandatory = [
    ...risk.map((h) => toItem(h, 'mandatory')),
    ...request.map((h) => toItem(h, 'mandatory')),
  ];
  mandatory = dedupeItems(mandatory);

  if (mandatory.length > mandatoryCap) {
    // 상한 초과 시 확산이 큰 것을 남긴다. 리스크를 요구보다 우선한다.
    const riskItems = mandatory.filter((i) => i.axis === 'risk');
    const rest = mandatory.filter((i) => i.axis !== 'risk');
    const keepRisk = riskItems.slice(0, mandatoryCap);
    const remaining = Math.max(0, mandatoryCap - keepRisk.length);
    mandatory = [...keepRisk, ...rest.slice(0, remaining)];
  }

  // ── 3. 층화 표본으로 잔여 채우기 ───────────────────────────────────────────
  const usedIds = new Set(mandatory.map((i) => i.id));
  const remainingSlots = Math.max(0, size - mandatory.length);

  // 축별 버킷 — 각 축 안에서는 확산이 큰 순 (많이 반복된 문구가 더 대표적이다)
  const buckets = new Map<TalkAxis, PrefilterHit[]>();
  for (const axis of TALK_AXES) buckets.set(axis, []);
  for (const hit of stats.others) {
    if (usedIds.has(hit.message.id)) continue;
    buckets.get(hit.axis)!.push(hit);
  }
  for (const axis of TALK_AXES) buckets.get(axis)!.sort(byDuplicateDesc);

  // 라운드로빈: 축을 한 바퀴씩 돌며 1건씩 뽑는다.
  // 이렇게 하면 건수가 적은 축도 최소 1건을 확보한다 — 비율대로 나누면 소수 축이 0이 된다.
  const sampled: SampledItem[] = [];
  const cursors = new Map<TalkAxis, number>(TALK_AXES.map((a) => [a, 0]));
  let progressed = true;

  while (sampled.length < remainingSlots && progressed) {
    progressed = false;
    for (const axis of TALK_AXES) {
      if (sampled.length >= remainingSlots) break;
      const bucket = buckets.get(axis)!;
      const idx = cursors.get(axis)!;
      if (idx >= bucket.length) continue;
      cursors.set(axis, idx + 1);
      sampled.push(toItem(bucket[idx], 'sampled'));
      progressed = true;
    }
  }

  const items = dedupeItems([...mandatory, ...sampled]);

  const axisCoverage = {} as Record<TalkAxis, number>;
  for (const axis of TALK_AXES) axisCoverage[axis] = 0;
  let represented = 0;
  for (const it of items) {
    axisCoverage[it.axis]++;
    represented += it.duplicateCount;
  }

  return {
    items,
    mandatoryCount: items.filter((i) => i.inclusion === 'mandatory').length,
    sampledCount: items.filter((i) => i.inclusion === 'sampled').length,
    axisCoverage,
    representedMessages: represented,
  };
}

/**
 * AI user 프롬프트에 넣을 표본 직렬화.
 * duplicateCount가 1보다 크면 명시해 "이 문구가 n번 반복됐다"를 토큰 1건에 담는다.
 */
export function formatSampleForPrompt(sample: SampleResult): string {
  return sample.items
    .map((it) => {
      const dup = it.duplicateCount > 1 ? ` (동일 문구 ${it.duplicateCount}건)` : '';
      const flag = it.inclusion === 'mandatory' ? '!' : ' ';
      return `[${flag}ID:${it.id}|${it.l1Tag}]${dup} ${it.author ?? '익명'}: "${it.text}"`;
    })
    .join('\n');
}
