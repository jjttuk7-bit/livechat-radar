/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-2-1 전환 퍼널 집계 — 시청자 프로필(ViewerProfile)을 구매 퍼널 단계별 인원으로 환산.
 * "관심 → 고려 → 구매 임박 → 구매" 단계별 도달 인원(누적, 단조 감소)과 추정 전환율.
 */

import { ClosingWindow, ConversionFunnel, FunnelTag, MentionMark, ShopAnalysisResult, ViewerProfile } from '../types/liveShopping';

const STAGE_RANK: Record<FunnelTag | 'none', number> = {
  none: 0,
  cart_abandon_signal: 0,
  interest: 1,
  consideration: 2,
  repurchase: 3,
  purchase_intent: 4,
  purchased: 5,
};

export function buildConversionFunnel(viewers: ViewerProfile[]): ConversionFunnel {
  let interest = 0;
  let consideration = 0;
  let intent = 0;
  let purchased = 0;

  for (const v of viewers) {
    const rank = STAGE_RANK[v.funnelStage];
    const bought = v.isPurchaser;
    // "최소 단계 도달" 누적 — 상위 단계는 하위를 포함하므로 단조 감소
    if (rank >= STAGE_RANK.interest || bought) interest++;
    if (rank >= STAGE_RANK.consideration || bought) consideration++;
    if (rank >= STAGE_RANK.purchase_intent || bought) intent++;
    if (bought) purchased++;
  }

  const conversionRate = interest > 0 ? Math.round((purchased / interest) * 100) : 0;
  return { interest, consideration, intent, purchased, conversionRate };
}

const DEFAULT_CLOSING_LINE =
  '지금 결제하신 분들 많아요! 수량 한정이라 지금이 가장 좋은 타이밍이에요. 고민되셨던 분들 지금 함께 가시죠!';

/**
 * G-2-3: 지금이 클로징 적기인지 감지.
 * 구매 온도가 높거나 전환 타이밍이 "지금"이면 윈도우 오픈. 마감/재고 문의는 강도를 높인다.
 */
export function detectClosingWindow(analysis: ShopAnalysisResult | null): ClosingWindow {
  if (!analysis) return { open: false, score: 0, reasons: [], suggestedLine: DEFAULT_CLOSING_LINE };

  const metricNum = (id: string): number => {
    const v = analysis.metrics?.find((m) => m.id === id)?.value;
    return typeof v === 'number' ? v : 0;
  };
  const timingNow = analysis.metrics?.find((m) => m.id === 'conversion_timing')?.value === '지금';
  const temp = metricNum('purchase_temperature');
  const analyses = analysis.analyses ?? [];
  const hasDeadline = analyses.some((a) => a.tag === 'deadline_question');
  const hasStock = analyses.some((a) => a.tag === 'stock_question' || a.tag === 'restock_request');
  const purchased = metricNum('sales_estimate');

  const reasons: string[] = [];
  if (temp >= 50) reasons.push(`구매 온도 ${temp}%`);
  if (timingNow) reasons.push('전환 타이밍 도달');
  if (hasDeadline) reasons.push('마감 문의 감지');
  if (hasStock) reasons.push('재고 문의 감지');
  if (purchased > 0) reasons.push(`구매 인증 ${purchased}건`);

  const open = temp >= 50 || timingNow;
  const score = Math.max(
    0,
    Math.min(100, temp + (timingNow ? 20 : 0) + (hasDeadline ? 15 : 0) + (hasStock ? 10 : 0)),
  );

  // 클로징 전용 액션 카드가 있으면 그 멘트를 우선 사용
  const closingCard = analysis.actionCards?.find((c) => c.id === 'closing-now');
  const suggestedLine = closingCard?.suggestedLine || DEFAULT_CLOSING_LINE;

  return { open, score, reasons, suggestedLine };
}

/**
 * G-2-5: 가격 탄력 경고. 가격 저항이 전환 대비 과도하면 혜택 재강조 신호.
 * @returns 경고 메시지 또는 null
 */
export function detectPriceElasticityWarning(analysis: ShopAnalysisResult | null): string | null {
  if (!analysis) return null;
  const metricNum = (id: string): number => {
    const v = analysis.metrics?.find((m) => m.id === id)?.value;
    return typeof v === 'number' ? v : 0;
  };
  const priceResist = metricNum('price_resistance');
  const purchased = metricNum('sales_estimate');
  const temp = metricNum('purchase_temperature');

  // 가격 저항 3건 이상 + (구매 전환보다 저항이 많거나 구매 온도가 낮음)
  if (priceResist >= 3 && (priceResist > purchased || temp < 50)) {
    return `가격 저항 ${priceResist}건 — 단순 가격보다 혜택 포함 구성가·한정 혜택을 다시 강조하세요.`;
  }
  return null;
}

/** G-2-4: 마킹 시점 대비 현재 구매/온도 상승량 */
export function computeMentionLift(
  mark: MentionMark,
  currentPurchased: number,
  currentTemp: number,
): { purchasedLift: number; tempLift: number } {
  return {
    purchasedLift: currentPurchased - mark.baselinePurchased,
    tempLift: currentTemp - mark.baselineTemp,
  };
}
