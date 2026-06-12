import React from 'react';
import { ClipboardCopy, Radio, Zap } from 'lucide-react';
import { ActionCard } from '../types/liveRadar';

interface ActionCardsProps {
  cards: ActionCard[];
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

const priorityClass = {
  low: 'border-slate-700 bg-slate-800/60 text-slate-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

const priorityLabel = {
  low: '낮음',
  medium: '중간',
  high: '높음',
};

export const ActionCards: React.FC<ActionCardsProps> = ({ cards, onCopy, copiedId }) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
      {cards.map((card) => (
        <article key={card.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col min-h-[248px]">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <Zap size={16} />
            </div>
            <span className={`text-[10px] font-bold border rounded-md px-2 py-1 ${priorityClass[card.priority]}`}>
              우선순위 {priorityLabel[card.priority]}
            </span>
          </div>

          <h3 className="text-sm font-extrabold text-white">{card.title}</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed mt-2">{card.reason}</p>

          <div className="mt-4 bg-slate-950/80 border border-cyan-500/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-cyan-300 font-bold mb-2">
              <Radio size={12} />
              진행자 멘트
            </div>
            <p className="text-xs text-slate-100 leading-relaxed">"{card.suggestedLine}"</p>
          </div>

          <div className="mt-3 flex-1">
            <p className="text-[10px] text-slate-500 font-bold mb-1.5">근거 댓글</p>
            <div className="space-y-1">
              {card.evidence.slice(0, 2).map((item, index) => (
                <p key={`${card.id}-evidence-${index}`} className="text-[10px] text-slate-400 truncate border-l border-slate-700 pl-2">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onCopy(card.suggestedLine, `radar-action-${card.id}`)}
            className="mt-4 w-full rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-200 flex items-center justify-center gap-2 transition-colors"
          >
            <ClipboardCopy size={13} />
            {copiedId === `radar-action-${card.id}` ? '복사 완료' : '멘트 복사'}
          </button>
        </article>
      ))}
    </div>
  );
};
