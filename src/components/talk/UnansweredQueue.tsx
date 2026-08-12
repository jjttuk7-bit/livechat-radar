/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 미응답 요구 큐 — 진행자가 놓친 질문·자료 요청을 긴급도순으로 모은다.
 * 동일 문구는 서버(L1)에서 이미 접혀 오므로, 여기서는 한 줄이 곧 하나의 서로 다른 요구다.
 */

import React from 'react';
import { HelpCircle, Check } from 'lucide-react';
import { UnansweredRequest } from '../../types/liveTalk';
import { TAG_LABEL, URGENCY_CHIP } from './talkLabels';

interface UnansweredQueueProps {
  items: UnansweredRequest[];
  resolvedIds: Set<string>;
  onResolve: (id: string) => void;
}

export const UnansweredQueue: React.FC<UnansweredQueueProps> = ({ items, resolvedIds, onResolve }) => {
  const visible = items.filter((i) => !resolvedIds.has(i.id));

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden min-w-0">
      <header className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-1.5">
        <HelpCircle size={15} className="text-emerald-400 shrink-0" />
        <h2 className="text-[11px] font-semibold text-slate-200 font-sans">미응답 요구</h2>
        <span
          className={`ml-auto text-[10px] font-mono ${visible.length === 0 ? 'text-emerald-400' : 'text-amber-300'}`}
        >
          {visible.length}건
        </span>
      </header>

      <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/70">
        {visible.length === 0 ? (
          <div className="p-5 text-center text-emerald-500/70 text-[11px] italic font-sans">
            답변 대기 중인 요구가 없습니다. 목표 달성 상태입니다.
          </div>
        ) : (
          visible.map((q) => (
            <article key={q.id} className="p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold font-sans ${URGENCY_CHIP[q.urgency]}`}>
                  {TAG_LABEL[q.tag]}
                </span>
                <button
                  onClick={() => onResolve(q.id)}
                  className="ml-auto text-slate-600 hover:text-emerald-400 transition-colors shrink-0"
                  title="답변 완료로 표시"
                >
                  <Check size={13} />
                </button>
              </div>

              <p className="text-[11px] text-slate-300 font-mono leading-snug break-words">
                {q.author && <span className="text-slate-500">{q.author}: </span>}
                “{q.text}”
              </p>

              {q.suggestedAnswer && (
                <p className="text-[10px] text-emerald-300/80 font-sans leading-snug bg-slate-950/50 border border-slate-800 rounded p-1.5">
                  ▸ {q.suggestedAnswer}
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
};
