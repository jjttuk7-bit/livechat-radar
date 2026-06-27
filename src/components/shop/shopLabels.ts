/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 라이브 쇼핑 UI 공용 라벨/색상 매핑 (단일 출처).
 * 축/태그 한국어 라벨과 High Density 다크 테마 액센트 클래스를 한 곳에서 관리한다.
 */

import { ShopAxis, ShopMetricStatus, ShopTag, UrgencyLevel } from '../../types/liveShopping';

export const AXIS_LABEL: Record<ShopAxis, string> = {
  funnel: '구매 퍼널',
  product: '상품·옵션',
  price: '가격·프로모션',
  logistics: '배송·CS',
  trust: '신뢰·반론',
  stream: '방송·운영',
};

/** 축별 텍스트 액센트 */
export const AXIS_TEXT: Record<ShopAxis, string> = {
  funnel: 'text-cyan-400',
  product: 'text-sky-400',
  price: 'text-amber-400',
  logistics: 'text-emerald-400',
  trust: 'text-violet-400',
  stream: 'text-slate-400',
};

/** 축별 바/칩 배경 */
export const AXIS_BAR: Record<ShopAxis, string> = {
  funnel: 'bg-cyan-500',
  product: 'bg-sky-500',
  price: 'bg-amber-500',
  logistics: 'bg-emerald-500',
  trust: 'bg-violet-500',
  stream: 'bg-slate-500',
};

export const TAG_LABEL: Record<ShopTag, string> = {
  // funnel
  interest: '관심',
  consideration: '고려',
  purchase_intent: '구매 임박',
  purchased: '구매 인증',
  repurchase: '재구매',
  cart_abandon_signal: '이탈 신호',
  // product
  option_question: '옵션 문의',
  stock_question: '재고 문의',
  restock_request: '재입고 요청',
  spec_question: '스펙 문의',
  comparison_question: '비교 문의',
  usage_scenario: '사용 적합성',
  product_switch_request: '상품 전환 요청',
  // price
  price_question: '가격 문의',
  price_resistance: '가격 저항',
  discount_request: '할인 요청',
  promo_question: '혜택 문의',
  lowest_price_check: '최저가 검증',
  deadline_question: '마감 문의',
  // logistics
  delivery_question: '배송 문의',
  bundle_delivery: '합배송 문의',
  exchange_return: '교환·반품',
  payment_issue: '결제 오류',
  link_request: '링크 요청',
  order_help: '주문 도움',
  // trust
  social_proof: '실사용 후기',
  doubt_authenticity: '효과 의심',
  hesitation_price: '가격 망설임',
  hesitation_need: '필요성 망설임',
  hesitation_trust: '신뢰 망설임',
  negative_review: '부정 후기',
  // stream
  stream_issue: '방송 장애',
  engagement: '참여·호응',
  spam_promo: '스팸·홍보',
  abuse_troll: '비방·트롤',
  host_question_direct: '호스트 지목',
  // fallback
  other: '기타',
};

/** 메트릭 status → 텍스트 색상 */
export const STATUS_TEXT: Record<ShopMetricStatus, string> = {
  good: 'text-emerald-400',
  normal: 'text-cyan-400',
  warning: 'text-amber-400',
  danger: 'text-rose-400',
};

/** 메트릭 status → 카드 보더 색상 */
export const STATUS_BORDER: Record<ShopMetricStatus, string> = {
  good: 'border-emerald-500/25',
  normal: 'border-[rgba(56,189,248,0.15)]',
  warning: 'border-amber-500/30',
  danger: 'border-rose-500/30',
};

/** 긴급도 배지 */
export const URGENCY_BADGE: Record<UrgencyLevel, string> = {
  high: 'bg-rose-950 text-rose-400 border-rose-500/40',
  medium: 'bg-amber-950 text-amber-400 border-amber-500/40',
  low: 'bg-slate-900 text-slate-400 border-slate-700',
};

export const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  high: '긴급',
  medium: '주의',
  low: '낮음',
};

/** askedAt(ISO) → "n분 전" 상대 표기 */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 전`;
}
