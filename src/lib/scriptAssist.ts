/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-4-3 스크립트 어시스트 — 들어온 미응답 질문을 상품 사전 등록 예상 FAQ(presetFaqs)와
 * 키워드 매칭해 "준비된 답변"을 제시. 외부 호출 없음.
 */

import { LiveProduct, UnansweredQuestion } from '../types/liveShopping';

export interface PresetAnswerMatch {
  questionId: string;
  questionText: string;
  answer: string;
  productName: string;
  score: number;
}

const STOP = new Set(['이거', '저거', '그거', '어떻게', '얼마', '언제', '어디', '있나요', '되나요', '인가요', '하나요', '뭐', '무슨']);

function tokens(text: string): string[] {
  return text
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

/** 미응답 질문 ↔ 상품 presetFaqs 매칭. 질문당 최고 점수 1건. */
export function matchPresetAnswers(
  unanswered: UnansweredQuestion[],
  products: LiveProduct[],
): PresetAnswerMatch[] {
  const faqs: Array<{ q: string; a: string; qTokens: string[]; productName: string }> = [];
  for (const p of products) {
    for (const f of p.presetFaqs ?? []) {
      if (f.q.trim() && f.a.trim()) {
        faqs.push({ q: f.q, a: f.a, qTokens: tokens(f.q), productName: p.name });
      }
    }
  }
  if (faqs.length === 0) return [];

  const matches: PresetAnswerMatch[] = [];
  for (const u of unanswered) {
    const uText = u.text;
    const uTokens = new Set(tokens(uText));
    let best: { faq: (typeof faqs)[number]; score: number } | null = null;
    for (const faq of faqs) {
      // 점수: 공통 토큰 수 + (질문 토큰이 미응답 텍스트에 통째 포함되면 가산)
      let score = faq.qTokens.filter((t) => uTokens.has(t)).length;
      for (const t of faq.qTokens) if (uText.includes(t)) score += 0.5;
      if (score > 0 && (!best || score > best.score)) best = { faq, score };
    }
    if (best && best.score >= 1) {
      matches.push({
        questionId: u.id,
        questionText: uText,
        answer: best.faq.a,
        productName: best.faq.productName,
        score: best.score,
      });
    }
  }
  return matches.sort((a, b) => b.score - a.score);
}
