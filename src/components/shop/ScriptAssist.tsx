/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-4-3 스크립트 어시스트 — 활성 상품 셀링포인트 + 미응답 질문에 준비된 답변 자동 매칭.
 */

import React from 'react';
import { BookOpen, CheckCircle, Copy, Sparkles } from 'lucide-react';
import { LiveProduct } from '../../types/liveShopping';
import { PresetAnswerMatch } from '../../lib/scriptAssist';

interface ScriptAssistProps {
  activeProduct: LiveProduct | null;
  matches: PresetAnswerMatch[];
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

export const ScriptAssist: React.FC<ScriptAssistProps> = ({ activeProduct, matches, onCopy, copiedId }) => {
  const points = activeProduct?.sellingPoints ?? [];
  const hasContent = points.length > 0 || matches.length > 0;

  return (
    <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
          <BookOpen size={13} className="text-indigo-400" />
          스크립트 어시스트
        </h3>
        {activeProduct && <span className="text-[9px] text-slate-500 font-mono truncate max-w-[120px]">{activeProduct.name}</span>}
      </div>

      {!hasContent ? (
        <p className="text-[10px] text-slate-600 italic font-sans">
          상품 등록 시 셀링포인트와 예상 Q&A를 넣어두면, 읽을 멘트와 준비된 답변을 여기서 띄웁니다.
        </p>
      ) : (
        <div className="space-y-3">
          {/* 셀링포인트 */}
          {points.length > 0 && (
            <div>
              <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider font-sans mb-1.5">지금 읽을 셀링포인트</div>
              <div className="space-y-1">
                {points.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-800 rounded px-2 py-1">
                    <span className="text-[11px] text-slate-200 font-sans flex items-center gap-1.5 min-w-0">
                      <Sparkles size={10} className="text-indigo-400 shrink-0" />
                      <span className="truncate">{p}</span>
                    </span>
                    <button
                      onClick={() => onCopy(p, `sp-${i}`)}
                      className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded transition-all flex items-center gap-1 ${copiedId === `sp-${i}` ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-900 hover:bg-slate-800 text-slate-400'}`}
                    >
                      {copiedId === `sp-${i}` ? <CheckCircle size={9} /> : <Copy size={9} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 준비된 답변 매칭 */}
          {matches.length > 0 && (
            <div className="border-t border-slate-800 pt-2">
              <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider font-sans mb-1.5">준비된 답변 ({matches.length})</div>
              <div className="space-y-1.5">
                {matches.map((m) => (
                  <div key={m.questionId} className="bg-slate-950/60 border border-emerald-900/40 rounded-lg p-2">
                    <p className="text-[10px] text-slate-400 font-sans truncate">❓ {m.questionText}</p>
                    <div className="flex items-start gap-2 mt-1">
                      <p className="flex-1 text-[11px] text-emerald-100 font-sans leading-snug">{m.answer}</p>
                      <button
                        onClick={() => onCopy(m.answer, `pa-${m.questionId}`)}
                        className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded transition-all flex items-center gap-1 ${copiedId === `pa-${m.questionId}` ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-900 hover:bg-slate-800 text-slate-400'}`}
                      >
                        {copiedId === `pa-${m.questionId}` ? <CheckCircle size={9} /> : <Copy size={9} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
