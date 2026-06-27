/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle, Copy, HelpCircle } from 'lucide-react';
import { UnansweredQuestion } from '../../types/liveShopping';
import { TAG_LABEL, URGENCY_BADGE, relativeTime } from './shopLabels';

interface UnansweredQueueProps {
  items: UnansweredQuestion[];
  onResolve: (id: string) => void;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

/** 미응답 질문 큐 — 호스트가 놓친 질문 + 추천 답변. 체크 시 큐에서 제거. */
export const UnansweredQueue: React.FC<UnansweredQueueProps> = ({ items, onResolve, onCopy, copiedId }) => {
  return (
    <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4 flex flex-col min-h-[200px]">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
          <HelpCircle size={13} className="text-amber-400" />
          미응답 질문 큐
        </h3>
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${items.length > 0 ? 'bg-amber-950 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
          {items.length}건
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-slate-600 text-[11px] italic font-sans px-4">
          답변이 필요한 질문이 모두 처리되었습니다. 👍
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {items.map((q) => (
            <div key={q.id} className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 border rounded font-sans shrink-0 ${URGENCY_BADGE[q.urgency]}`}>
                  {TAG_LABEL[q.tag]}
                </span>
                <span className="text-[9px] text-slate-600 font-mono shrink-0">{relativeTime(q.askedAt)}</span>
              </div>
              <p className="text-[11px] text-slate-200 font-sans leading-snug">
                {q.author && <span className="text-slate-500 font-bold">{q.author}: </span>}
                {q.text}
              </p>
              {q.suggestedAnswer && (
                <p className="text-[10px] text-slate-400 font-sans italic leading-snug pl-2 border-l-2 border-amber-500/30">
                  {q.suggestedAnswer}
                </p>
              )}
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                {q.suggestedAnswer && (
                  <button
                    onClick={() => onCopy(q.suggestedAnswer!, `q-${q.id}`)}
                    className={`text-[9px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1 ${
                      copiedId === `q-${q.id}`
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
                    }`}
                    title="추천 답변 복사"
                  >
                    {copiedId === `q-${q.id}` ? <CheckCircle size={10} /> : <Copy size={10} />}
                    답변
                  </button>
                )}
                <button
                  onClick={() => onResolve(q.id)}
                  className="text-[9px] font-bold px-2 py-1 rounded bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-800/60 transition-all flex items-center gap-1"
                  title="답변 완료로 처리"
                >
                  <CheckCircle size={10} /> 완료
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
