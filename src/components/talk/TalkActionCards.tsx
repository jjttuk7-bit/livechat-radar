/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 실시간 액션 카드 — 진행자가 바로 말할 처방 멘트.
 *
 * ⚠️ D-6: 처방은 진행 품질(사실관계 정리·근거 제시·질문 응답·후원 안내)에 한정된다.
 *   특정 인물·집단을 공격하는 멘트는 생성 대상이 아니며, 프롬프트에서 차단한다.
 */

import React from 'react';
import { Zap, Copy, Check } from 'lucide-react';
import { TalkActionCard } from '../../types/liveTalk';
import { URGENCY_CHIP } from './talkLabels';

interface TalkActionCardsProps {
  cards: TalkActionCard[];
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

export const TalkActionCards: React.FC<TalkActionCardsProps> = ({ cards, onCopy, copiedId }) => {
  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden min-w-0">
      <header className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-1.5">
        <Zap size={15} className="text-indigo-400 shrink-0" />
        <h2 className="text-[11px] font-bold text-slate-200 font-sans">지금 할 것</h2>
        <span className="ml-auto text-[10px] font-mono text-slate-500">{cards.length}</span>
      </header>

      <div className="divide-y divide-slate-800/70">
        {cards.length === 0 ? (
          <div className="p-5 text-center text-slate-600 text-[11px] italic font-sans">
            채팅이 쌓이면 진행 처방을 제안합니다.
          </div>
        ) : (
          cards.map((c) => (
            <article key={c.id} className="p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold font-sans ${URGENCY_CHIP[c.priority]}`}>
                  {c.priority === 'high' ? '긴급' : c.priority === 'medium' ? '권장' : '참고'}
                </span>
                <h3 className="text-[11px] font-bold text-slate-200 font-sans truncate">{c.title}</h3>
              </div>

              <p className="text-[10px] text-slate-500 font-sans leading-snug">{c.reason}</p>

              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 flex items-start gap-2">
                <p className="text-[11px] text-cyan-200 font-sans leading-snug flex-1 min-w-0">
                  “{c.suggestedLine}”
                </p>
                <button
                  onClick={() => onCopy(c.suggestedLine, c.id)}
                  className="text-slate-600 hover:text-cyan-400 transition-colors shrink-0"
                  title="멘트 복사"
                >
                  {copiedId === c.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              </div>

              {c.evidence.length > 0 && (
                <ul className="space-y-0.5">
                  {c.evidence.slice(0, 3).map((e, i) => (
                    <li key={i} className="text-[10px] text-slate-600 font-mono truncate">▸ {e}</li>
                  ))}
                </ul>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
};
