/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LiveChat Radar — 라이브 쇼핑 Eval suite assertions (S-8).
 *
 * universal: 모든 쇼핑 분석 응답이 만족해야 하는 구조/enum/관계 검증
 * fixture-specific: 각 fixture가 자기 시나리오에 맞게 추가 검증
 */

import { SHOP_AXES, SHOP_TAGS, TAG_AXIS } from '../src/types/liveShopping';
import type { ShopAnalysisResult } from '../src/types/liveShopping';

export type ShopAnalyzeResponse = Omit<ShopAnalysisResult, 'analyzedAt'>;

export interface FixtureAssertions {
  purchased_min?: number;          // 구매 인증(purchased+repurchase) ≥ n
  stream_issue_min?: number;       // 방송 장애 태그 ≥ n
  price_resistance_min?: number;   // 가격 저항 태그 ≥ n
  unanswered_min?: number;         // 미응답 큐 ≥ n
  faq_min?: number;                // faq ≥ n
  product_match_min?: number;      // productId 매칭된 댓글 ≥ n
  action_card_id_any?: string[];   // actionCards.id 중 하나 이상 존재
  schema_complete?: boolean;
  conversion_advice_nonempty?: boolean;
  recent_summary_nonempty?: boolean;
}

export type AssertResult = { ok: boolean; label: string; detail?: string };

const SENTIMENTS = new Set(['positive', 'neutral', 'negative']);
const URGENCIES = new Set(['low', 'medium', 'high']);
const STATUSES = new Set(['good', 'normal', 'warning', 'danger']);
const TAGSET = new Set<string>(SHOP_TAGS);
const AXISSET = new Set<string>(SHOP_AXES);

// ── Universal assertions ─────────────────────────────────────────────────────

export function runUniversal(resp: ShopAnalyzeResponse): AssertResult[] {
  const r: AssertResult[] = [];

  // analyses 구조 + enum 정합성
  const analyses = resp.analyses ?? [];
  const badTag = analyses.find((a) => !TAGSET.has(a.tag));
  r.push({ ok: !badTag, label: 'analyses.tag enum 유효', detail: badTag ? `invalid="${badTag.tag}"` : undefined });

  const badAxis = analyses.find((a) => !AXISSET.has(a.axis));
  r.push({ ok: !badAxis, label: 'analyses.axis enum 유효', detail: badAxis ? `invalid="${badAxis.axis}"` : undefined });

  const axisMismatch = analyses.find((a) => TAG_AXIS[a.tag] !== a.axis);
  r.push({
    ok: !axisMismatch,
    label: 'axis-tag 매핑 일치',
    detail: axisMismatch ? `${axisMismatch.tag}→${axisMismatch.axis} (expect ${TAG_AXIS[axisMismatch.tag]})` : undefined,
  });

  const badSent = analyses.find((a) => !SENTIMENTS.has(a.sentiment));
  r.push({ ok: !badSent, label: 'analyses.sentiment 유효', detail: badSent ? `invalid="${badSent.sentiment}"` : undefined });

  const badUrg = analyses.find((a) => !URGENCIES.has(a.urgency));
  r.push({ ok: !badUrg, label: 'analyses.urgency 유효', detail: badUrg ? `invalid="${badUrg.urgency}"` : undefined });

  // metrics 비어있지 않음 + status 유효
  const metrics = resp.metrics ?? [];
  r.push({ ok: metrics.length > 0, label: 'metrics 비어있지 않음', detail: `count=${metrics.length}` });
  const badStatus = metrics.find((m) => !STATUSES.has(m.status));
  r.push({ ok: !badStatus, label: 'metrics.status 유효', detail: badStatus ? `invalid="${badStatus.status}"` : undefined });

  // actionCards ≤ 3 + priority 유효
  const cards = resp.actionCards ?? [];
  r.push({ ok: cards.length <= 3, label: 'actionCards ≤ 3', detail: `count=${cards.length}` });
  const badPrio = cards.find((c) => !URGENCIES.has(c.priority));
  r.push({ ok: !badPrio, label: 'actionCards.priority 유효', detail: badPrio ? `invalid="${badPrio.priority}"` : undefined });

  // unanswered tag/urgency 유효
  const unanswered = resp.unanswered ?? [];
  const badQ = unanswered.find((q) => !TAGSET.has(q.tag) || !URGENCIES.has(q.urgency));
  r.push({ ok: !badQ, label: 'unanswered tag/urgency 유효', detail: badQ ? `q=${badQ.id}` : undefined });

  // productInterest / faq 배열
  r.push({ ok: Array.isArray(resp.productInterest), label: 'productInterest 배열' });
  r.push({ ok: Array.isArray(resp.faq), label: 'faq 배열' });

  // recentSummary / conversionAdvice 비어있지 않음
  r.push({ ok: !!resp.recentSummary && resp.recentSummary.length > 3, label: 'recentSummary 비어있지 않음', detail: `len=${resp.recentSummary?.length ?? 0}` });
  r.push({ ok: !!resp.conversionAdvice && resp.conversionAdvice.length > 3, label: 'conversionAdvice 비어있지 않음', detail: `len=${resp.conversionAdvice?.length ?? 0}` });

  return r;
}

// ── Fixture-specific assertions ──────────────────────────────────────────────

export function runFixtureSpecific(resp: ShopAnalyzeResponse, a: FixtureAssertions): AssertResult[] {
  const r: AssertResult[] = [];
  const analyses = resp.analyses ?? [];
  const countTag = (...tags: string[]) => analyses.filter((x) => tags.includes(x.tag)).length;

  if (a.purchased_min !== undefined) {
    const n = countTag('purchased', 'repurchase');
    r.push({ ok: n >= a.purchased_min, label: `구매 인증 ≥ ${a.purchased_min}`, detail: `found=${n}` });
  }
  if (a.stream_issue_min !== undefined) {
    const n = countTag('stream_issue');
    r.push({ ok: n >= a.stream_issue_min, label: `방송 장애 ≥ ${a.stream_issue_min}`, detail: `found=${n}` });
  }
  if (a.price_resistance_min !== undefined) {
    const n = countTag('price_resistance');
    r.push({ ok: n >= a.price_resistance_min, label: `가격 저항 ≥ ${a.price_resistance_min}`, detail: `found=${n}` });
  }
  if (a.unanswered_min !== undefined) {
    const n = resp.unanswered?.length ?? 0;
    r.push({ ok: n >= a.unanswered_min, label: `미응답 큐 ≥ ${a.unanswered_min}`, detail: `found=${n}` });
  }
  if (a.faq_min !== undefined) {
    const n = resp.faq?.length ?? 0;
    r.push({ ok: n >= a.faq_min, label: `faq ≥ ${a.faq_min}`, detail: `found=${n}` });
  }
  if (a.product_match_min !== undefined) {
    const n = analyses.filter((x) => x.productId != null).length;
    r.push({ ok: n >= a.product_match_min, label: `상품 매칭 ≥ ${a.product_match_min}`, detail: `found=${n}` });
  }
  if (a.action_card_id_any) {
    const ids = new Set((resp.actionCards ?? []).map((c) => c.id));
    const hit = a.action_card_id_any.some((id) => ids.has(id));
    r.push({ ok: hit, label: `actionCards.id ∈ {${a.action_card_id_any.join(',')}}`, detail: `ids=${[...ids].join(',')}` });
  }
  if (a.schema_complete) {
    r.push({
      ok:
        Array.isArray(resp.analyses) &&
        Array.isArray(resp.metrics) &&
        Array.isArray(resp.actionCards) &&
        Array.isArray(resp.unanswered) &&
        Array.isArray(resp.productInterest) &&
        Array.isArray(resp.faq) &&
        typeof resp.recentSummary === 'string' &&
        typeof resp.conversionAdvice === 'string',
      label: 'schema 8개 필드 모두 존재',
    });
  }
  if (a.conversion_advice_nonempty) {
    r.push({ ok: !!resp.conversionAdvice && resp.conversionAdvice.trim().length > 5, label: 'conversionAdvice 의미 있는 길이', detail: `len=${resp.conversionAdvice?.length ?? 0}` });
  }
  if (a.recent_summary_nonempty) {
    r.push({ ok: !!resp.recentSummary && resp.recentSummary.trim().length > 5, label: 'recentSummary 의미 있는 길이', detail: `len=${resp.recentSummary?.length ?? 0}` });
  }

  return r;
}
