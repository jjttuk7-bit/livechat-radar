/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * L1 프리필터 (P-2) — 모든 댓글을 비용 0으로 전량 처리한다.
 *
 * 이 계층은 **절대 AI를 호출하지 않는다.** 계층의 가치가 비용 0과 전량 처리이므로
 * 외부 호출이 들어가는 순간 설계가 무너진다.
 *
 * 산출물은 두 가지다:
 *  1) 집계 통계 — AI에 원문 대신 넘길 요약. 호출당 입력을 CPM과 무관하게 상수로 고정한다.
 *  2) 후보 목록 — 리스크/요구 후보는 표본이 아니라 **전수**로 AI에 넘긴다.
 *
 * L1의 태그는 **추정**이다. 정밀 태깅은 L2(AI)가 한다. 여기서의 오분류는 표본 선정에만
 * 영향을 주므로, 리스크·요구에 대해서는 정밀도보다 재현율(누락 안 함)을 우선한다.
 *
 * 설계 근거: docs/plans/politics-pivot.md 4절.
 */

import { createHash } from 'node:crypto';
import {
  TALK_AXES,
  TALK_TAGS,
  TAG_AXIS,
  type TalkAxis,
  type TalkTag,
} from '../types/liveTalk.js';
import { RULE_ORDER } from './dictionaries.js';
import {
  clusterDuplicates,
  dedupeRate,
  detectBrigading,
  normalizeText,
  type BrigadingSignal,
  type ChatLike,
  type TextCluster,
} from './dedupe.js';

/** L1이 추정한 댓글 1건 */
export interface PrefilterHit {
  message: ChatLike;
  /** L1 추정 태그 (AI가 최종 확정) */
  tag: TalkTag;
  axis: TalkAxis;
  /** 매치된 패턴 원문 — 왜 이 태그가 붙었는지 추적용 */
  matched: string | null;
  /** dedupe 클러스터 크기 — 이 문구가 총 몇 건인지 */
  duplicateCount: number;
}

export interface PrefilterStats {
  /** 입력 총 건수 */
  total: number;
  /** dedupe 후 고유 문구 수 */
  unique: number;
  /** 압축률 % */
  dedupeRate: number;
  /** 고유 작성자 수 */
  authorCount: number;
  /** 분당 댓글 수 (타임스탬프 기반, 없으면 0) */
  cpm: number;
  /** 직전 대비 급증 여부 */
  spike: boolean;

  /** 태그별 건수 (전 태그 키 존재 — 0 포함) */
  tagCounts: Record<TalkTag, number>;
  /** 축별 건수 */
  axisCounts: Record<TalkAxis, number>;

  /** 리스크 후보 — 전수로 AI에 전달 */
  riskCandidates: PrefilterHit[];
  /** 진행자 응답이 필요한 요구 후보 — 전수로 AI에 전달 */
  requestCandidates: PrefilterHit[];
  /** 그 외 — 층화 표본의 모집단 */
  others: PrefilterHit[];

  /** dedupe 클러스터 (count 내림차순) */
  clusters: TextCluster[];
  /** 조직적 도배 신호 */
  brigading: BrigadingSignal[];

  /** 캐시 키용 시그니처 — 내용이 같으면 같은 값 */
  signature: string;
  windowStart: string | null;
  windowEnd: string | null;
}

export interface PrefilterOptions {
  /** 이전 윈도우 CPM — 스파이크 판정용 */
  previousCpm?: number;
  /** 스파이크 배수 임계 (기본 1.5배) */
  spikeRatio?: number;
  /** 큐시트에서 주입되는 이슈 키워드 — 실제 인물·정당명을 코드에 하드코딩하지 않기 위한 경로 */
  issueKeywords?: string[];
  /** 큐시트에서 주입되는 인물·기관명 */
  figures?: string[];
}

/** 규칙 목록을 순서대로 평가하여 첫 매치를 채택한다. */
function classify(text: string): { tag: TalkTag; matched: string } | null {
  for (const rule of RULE_ORDER) {
    for (const p of rule.patterns) {
      if (p.test(text)) return { tag: rule.tag, matched: p.source };
    }
  }
  return null;
}

function emptyTagCounts(): Record<TalkTag, number> {
  const out = {} as Record<TalkTag, number>;
  for (const t of TALK_TAGS) out[t] = 0;
  return out;
}

function emptyAxisCounts(): Record<TalkAxis, number> {
  const out = {} as Record<TalkAxis, number>;
  for (const a of TALK_AXES) out[a] = 0;
  return out;
}

/** 리스크 후보 태그 집합 — 전수 전달 대상 */
const RISK_CANDIDATE_TAGS = new Set<TalkTag>([
  'hate_slur',
  'defamation_risk',
  'misinfo_suspect',
  'election_law_watch',
  'brigading_spam',
]);

/** 요구 후보 축 — 전수 전달 대상 (inquiry 축 전체 + 아젠다의 요청류) */
const REQUEST_CANDIDATE_TAGS = new Set<TalkTag>([
  'factual_question',
  'explain_request',
  'opinion_request',
  'host_question_direct',
  'rerun_request',
  'how_to_act',
  'topic_request',
  'followup_request',
  'guest_request',
  'source_request',
]);

/**
 * 전량 처리 진입점.
 *
 * 반환된 `riskCandidates`/`requestCandidates`는 표본이 아니라 전수다. 놓치면 안 되는 것을
 * 확률에 맡기지 않는다는 것이 이 파이프라인의 핵심 규칙이다.
 */
export function runPrefilter(
  messages: ChatLike[],
  opts: PrefilterOptions = {},
): PrefilterStats {
  const clusters = clusterDuplicates(messages);
  const countByKey = new Map<string, number>();
  for (const c of clusters) countByKey.set(c.key, c.count);

  const tagCounts = emptyTagCounts();
  const axisCounts = emptyAxisCounts();
  const riskCandidates: PrefilterHit[] = [];
  const requestCandidates: PrefilterHit[] = [];
  const others: PrefilterHit[] = [];

  const authors = new Set<string>();
  let windowStart: string | null = null;
  let windowEnd: string | null = null;

  // 큐시트 주입 키워드 — 코드에 인물·정당명을 하드코딩하지 않기 위한 경로 (D-7)
  const issueKeywords = (opts.issueKeywords ?? []).filter(Boolean);
  const figures = (opts.figures ?? []).filter(Boolean);

  // 클러스터 대표만 분류하고 결과를 전 구성원에 공유하면 O(고유수)로 줄지만,
  // 후보 전수 전달을 위해 원본 단위 목록이 필요하므로 원본을 순회한다.
  // (분류 자체는 대표 기준 캐시로 재사용해 정규식 평가를 고유 문구 수만큼만 수행한다.)
  const classifyCache = new Map<string, { tag: TalkTag; matched: string } | null>();

  for (const m of messages) {
    const text = m.message ?? '';
    if (m.author) authors.add(m.author);
    if (m.timestamp) {
      if (!windowStart || m.timestamp < windowStart) windowStart = m.timestamp;
      if (!windowEnd || m.timestamp > windowEnd) windowEnd = m.timestamp;
    }

    let result = classifyCache.get(text);
    if (result === undefined) {
      result = classify(text);
      classifyCache.set(text, result);
    }

    let tag: TalkTag;
    let matched: string | null;

    if (result) {
      tag = result.tag;
      matched = result.matched;
    } else if (issueKeywords.some((k) => text.includes(k))) {
      tag = 'issue_mention';
      matched = 'issueKeywords';
    } else if (figures.some((f) => text.includes(f))) {
      tag = 'figure_mention';
      matched = 'figures';
    } else {
      tag = 'other';
      matched = null;
    }

    const axis = TAG_AXIS[tag];
    tagCounts[tag]++;
    axisCounts[axis]++;

    const dupCount = lookupDuplicateCount(countByKey, text, m.id);

    const hit: PrefilterHit = { message: m, tag, axis, matched, duplicateCount: dupCount };

    if (RISK_CANDIDATE_TAGS.has(tag)) riskCandidates.push(hit);
    else if (REQUEST_CANDIDATE_TAGS.has(tag)) requestCandidates.push(hit);
    else others.push(hit);
  }

  const brigading = detectBrigading(clusters);

  // 도배 클러스터의 대표를 리스크 후보로 승격 (사전에 안 걸려도 구조적으로 잡힌다)
  for (const sig of brigading) {
    const rep = sig.cluster.representative;
    const already = riskCandidates.some((h) => h.message.id === rep.id);
    if (already) continue;
    riskCandidates.push({
      message: rep,
      tag: 'brigading_spam',
      axis: TAG_AXIS.brigading_spam,
      matched: sig.kind,
      duplicateCount: sig.cluster.count,
    });
    tagCounts.brigading_spam++;
    axisCounts[TAG_AXIS.brigading_spam]++;
  }

  const cpm = computeCpm(messages.length, windowStart, windowEnd);
  const spike =
    opts.previousCpm != null && opts.previousCpm > 0
      ? cpm >= opts.previousCpm * (opts.spikeRatio ?? 1.5)
      : false;

  const stats: PrefilterStats = {
    total: messages.length,
    unique: clusters.length,
    dedupeRate: dedupeRate(clusters, messages.length),
    authorCount: authors.size,
    cpm,
    spike,
    tagCounts,
    axisCounts,
    riskCandidates,
    requestCandidates,
    others,
    clusters,
    brigading,
    signature: '',
    windowStart,
    windowEnd,
  };

  stats.signature = buildSignature(stats);
  return stats;
}

/**
 * 클러스터 count 조회.
 *
 * 정규화 규칙은 dedupe.normalizeText 하나만 존재해야 한다 — 여기에 복제하면 두 곳이 갈라지고,
 * 갈라지는 순간 dupCount가 조용히 1로 떨어진다(조회 실패). 그래서 import해서 재사용한다.
 */
function lookupDuplicateCount(
  countByKey: Map<string, number>,
  text: string,
  id: string,
): number {
  const direct = countByKey.get(normalizeText(text));
  if (direct != null) return direct;
  // 정규화 결과가 빈 문자열인 메시지는 dedupe가 고유 키를 부여한다
  return countByKey.get(` empty:${id}`) ?? 1;
}

function computeCpm(total: number, start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const spanSec = (Date.parse(end) - Date.parse(start)) / 1000;
  if (!Number.isFinite(spanSec) || spanSec <= 0) return 0;
  return (total / spanSec) * 60;
}

/**
 * 캐시 키용 시그니처.
 *
 * 메시지 ID 전량을 해시하면 고CPM에서 매 호출 집합이 달라져 히트율이 0이 된다.
 * 대신 **내용 요약**(총량·고유수·태그 분포·후보 수)으로 결정한다. 같은 상황이면 같은 키가 되어
 * 짧은 간격의 중복 분석을 실제로 차단한다.
 */
function buildSignature(stats: PrefilterStats): string {
  const tagSig = TALK_TAGS.map((t) => stats.tagCounts[t]).join(',');
  const payload = [
    stats.total,
    stats.unique,
    stats.authorCount,
    Math.round(stats.cpm),
    stats.riskCandidates.length,
    stats.requestCandidates.length,
    tagSig,
  ].join('|');
  return createHash('sha1').update(payload).digest('hex').slice(0, 16);
}

/**
 * AI user 프롬프트에 넣을 집계 요약 텍스트.
 * 원문 전량 대신 이 요약 + 층화 표본이 들어가므로 입력이 CPM과 무관하게 상수로 고정된다.
 */
export function formatStatsForPrompt(stats: PrefilterStats): string {
  const topTags = TALK_TAGS.filter((t) => stats.tagCounts[t] > 0)
    .sort((a, b) => stats.tagCounts[b] - stats.tagCounts[a])
    .slice(0, 12)
    .map((t) => `${t}:${stats.tagCounts[t]}`)
    .join(', ');

  const axisLine = TALK_AXES.map((a) => `${a}:${stats.axisCounts[a]}`).join(', ');

  return [
    `- 총 댓글 ${stats.total}건 (고유 문구 ${stats.unique}건, 중복률 ${stats.dedupeRate.toFixed(1)}%)`,
    `- 고유 작성자 ${stats.authorCount}명, CPM ${stats.cpm.toFixed(0)}${stats.spike ? ' (급증)' : ''}`,
    `- 축 분포: ${axisLine}`,
    `- 상위 태그(L1 추정): ${topTags || '없음'}`,
    `- 리스크 후보 ${stats.riskCandidates.length}건, 응답 필요 요구 ${stats.requestCandidates.length}건 (아래에 전수 포함)`,
    stats.brigading.length > 0
      ? `- 도배 신호 ${stats.brigading.length}건 (동일 문구 반복·확산)`
      : '- 도배 신호 없음',
  ].join('\n');
}
