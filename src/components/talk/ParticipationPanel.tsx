/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 참여 퍼널 + 어필 윈도우 (P-8).
 * 채팅 → 반복 참여 → 능동 행동 → 후원 단계별 인원과, 지금이 구독·후원 안내 적기인지.
 */

import React from 'react';
import { Filter, Megaphone } from 'lucide-react';
import { ParticipationFunnel, AppealWindow } from '../../types/liveTalk';

interface ParticipationPanelProps {
  funnel: ParticipationFunnel;
  appeal: AppealWindow;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

export const ParticipationPanel: React.FC<ParticipationPanelProps> = ({
  funnel, appeal, onCopy, copiedId,
}) => {
  const steps = [
    { label: '채팅 참여', value: funnel.commented, cls: 'bg-slate-500' },
    { label: '반복 참여', value: funnel.engaged, cls: 'bg-cyan-500' },
    { label: '능동 행동', value: funnel.advocated, cls: 'bg-blue-500' },
    { label: '후원·멤버십', value: funnel.supported, cls: 'bg-violet-500' },
  ];
  const max = Math.max(1, funnel.commented);

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden min-w-0">
      <header className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-1.5">
        <Filter size={15} className="text-violet-400 shrink-0" />
        <h2 className="text-[11px] font-bold text-slate-200 font-sans">참여 퍼널</h2>
        <span className="ml-auto text-[10px] font-mono text-violet-300">참여율 {funnel.supportRate}%</span>
      </header>

      <div className="p-3 space-y-3">
        {funnel.commented === 0 ? (
          <p className="text-center text-slate-600 text-[11px] italic font-sans py-3">
            분석이 진행되면 참여 단계가 집계됩니다.
          </p>
        ) : (
          <div className="space-y-1.5">
            {steps.map((s) => (
              <div key={s.label} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-sans w-16 shrink-0">{s.label}</span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden min-w-0">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${s.cls}`}
                      style={{ width: `${(s.value / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-300 w-8 text-right shrink-0">{s.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 어필 윈도우 */}
        <div
          className={`rounded-lg border p-2.5 space-y-1.5 ${
            appeal.open ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/50 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Megaphone size={13} className={appeal.open ? 'text-emerald-400' : 'text-slate-600'} />
            <span className={`text-[10px] font-bold font-sans ${appeal.open ? 'text-emerald-300' : 'text-slate-500'}`}>
              {appeal.open ? '지금이 안내 적기입니다' : '안내 대기'}
            </span>
            <span className="ml-auto text-[10px] font-mono text-slate-500">{appeal.score}</span>
          </div>

          {appeal.reasons.length > 0 && (
            <ul className="space-y-0.5">
              {appeal.reasons.slice(0, 3).map((r, i) => (
                <li key={i} className="text-[10px] text-slate-500 font-sans leading-snug">▸ {r}</li>
              ))}
            </ul>
          )}

          {appeal.open && appeal.suggestedLine && (
            <button
              onClick={() => onCopy(appeal.suggestedLine, 'appeal')}
              className="w-full text-left bg-slate-950/60 border border-slate-800 rounded p-1.5 hover:border-emerald-500/40 transition-colors"
            >
              <p className="text-[10px] text-emerald-200 font-sans leading-snug">
                “{appeal.suggestedLine}”
              </p>
              <span className="text-[9px] text-slate-600 font-sans">
                {copiedId === 'appeal' ? '복사됨' : '클릭해서 복사'}
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
