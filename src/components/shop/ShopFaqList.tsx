/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bot, CheckCircle, Copy } from 'lucide-react';
import { ShopFaqItem } from '../../types/liveShopping';

interface ShopFaqListProps {
  faq: ShopFaqItem[];
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

/** 상품 FAQ — 반복 질문 + 존댓말 답변 템플릿(클릭 복사). */
export const ShopFaqList: React.FC<ShopFaqListProps> = ({ faq, onCopy, copiedId }) => {
  return (
    <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans">상품 FAQ &amp; 답변 가이드</h3>
        </div>
        <span className="text-[9px] text-slate-500">반복 질문 즉시 응답</span>
      </div>

      {faq && faq.length > 0 ? (
        <div className="space-y-2.5">
          {faq.map((f, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-lg transition-all flex flex-col md:flex-row md:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] bg-indigo-950 text-indigo-400 font-extrabold px-1.5 py-0.5 rounded font-sans">Q</span>
                  <strong className="text-xs text-slate-200 truncate">{f.question}</strong>
                  <span className="text-[9px] text-pink-400 shrink-0 font-mono">({f.count}회)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans mt-1 italic pl-2 border-l-2 border-slate-800">
                  "{f.templateAnswer}"
                </p>
              </div>
              <button
                onClick={() => onCopy(f.templateAnswer, `faq-${idx}`)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all shrink-0 flex items-center gap-1.5 ${
                  copiedId === `faq-${idx}`
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
                }`}
              >
                {copiedId === `faq-${idx}` ? (
                  <><CheckCircle size={11} /> 복사 완료!</>
                ) : (
                  <><Copy size={11} /> 답변 복사</>
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-slate-600 text-xs italic font-sans">
          반복되는 단골 질문이 감지되면 답변 템플릿이 자동 정리됩니다.
        </div>
      )}
    </div>
  );
};
