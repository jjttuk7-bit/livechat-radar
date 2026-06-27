/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { ProductInterest } from '../../types/liveShopping';

interface ProductInterestRankingProps {
  items: ProductInterest[];
}

/** 상품별 관심 랭킹 — "다음에 띄울 상품" 우선순위 (관심도/질문/구매인증). */
export const ProductInterestRanking: React.FC<ProductInterestRankingProps> = ({ items }) => {
  const ranked = [...(items ?? [])].sort((a, b) => b.interestScore - a.interestScore);

  return (
    <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
          <ShoppingBag size={13} className="text-sky-400" />
          상품별 관심 랭킹
        </h3>
      </div>

      {ranked.length === 0 ? (
        <div className="py-8 text-center text-slate-600 text-[11px] italic font-sans">
          상품을 등록하면 상품별 관심도·질문·구매 인증을 집계합니다.
        </div>
      ) : (
        <div className="space-y-2.5">
          {ranked.map((p, idx) => (
            <div key={p.productId} className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono text-slate-500 w-4 shrink-0">#{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold text-slate-200 font-sans truncate">{p.name}</span>
                  <span className="text-[9px] text-slate-500 font-mono shrink-0">
                    질문 {p.questionCount} · 구매 {p.purchasedCount}
                  </span>
                </div>
                <div className="h-2 bg-slate-800/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, p.interestScore)}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-sky-400 w-7 text-right shrink-0">{p.interestScore}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
