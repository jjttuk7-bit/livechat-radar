/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bot, CheckCircle, Copy } from 'lucide-react';
import { ShopActionCard } from '../../types/liveShopping';
import { URGENCY_BADGE, URGENCY_LABEL } from './shopLabels';

interface ShopActionCardsProps {
  cards: ShopActionCard[];
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

/** 실시간 액션 카드 — 호스트가 바로 말할 처방 멘트(클릭 복사). */
export const ShopActionCards: React.FC<ShopActionCardsProps> = ({ cards, onCopy, copiedId }) => {
  const border: Record<string, string> = {
    high: 'bg-rose-950/30 border-rose-500/40',
    medium: 'bg-amber-950/20 border-amber-500/30',
    low: 'bg-blue-600/10 border-blue-500/30',
  };

  return (
    <div className="bg-blue-600/10 border-2 border-blue-600/50 rounded-xl p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(37,99,235,0.4)]">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans">실시간 판매 액션 처방</h3>
      </div>

      {cards && cards.length > 0 ? (
        <div className="space-y-2.5">
          {cards.map((c) => (
            <div key={c.id} className={`${border[c.priority] ?? border.low} border p-3 rounded-lg flex flex-col gap-1.5`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-slate-100 font-sans">{c.title}</span>
                <span className={`text-[8px] font-bold uppercase py-0.5 px-1.5 border rounded font-sans shrink-0 ${URGENCY_BADGE[c.priority]}`}>
                  {URGENCY_LABEL[c.priority]}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans leading-snug">{c.reason}</p>
              <div className="flex items-start gap-2 mt-1">
                <p className="flex-1 text-[11px] text-cyan-100 font-sans leading-relaxed italic pl-2 border-l-2 border-cyan-500/40">
                  "{c.suggestedLine}"
                </p>
                <button
                  onClick={() => onCopy(c.suggestedLine, `action-${c.id}`)}
                  className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1 ${
                    copiedId === `action-${c.id}`
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
                  }`}
                  title="처방 멘트 복사"
                >
                  {copiedId === `action-${c.id}` ? <CheckCircle size={10} /> : <Copy size={10} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-blue-600/5 p-3 rounded-lg border border-blue-500/20 text-blue-200">
          <p className="text-[11px] leading-relaxed">
            상품을 등록하고 라이브를 연동하면 가격 방어·클로징·신뢰 회복 등 판매 액션을 실시간 처방합니다.
          </p>
        </div>
      )}
    </div>
  );
};
