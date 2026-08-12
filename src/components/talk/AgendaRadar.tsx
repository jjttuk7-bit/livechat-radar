/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 아젠다 레이더 — "다음에 다룰 주제" 우선순위.
 * 큐시트 이슈별 관심도를 랭킹으로 보여주고 급상승 이슈를 표시한다.
 */

import React from 'react';
import { Radar, TrendingUp } from 'lucide-react';
import { AgendaInterest } from '../../types/liveTalk';

interface AgendaRadarProps {
  items: AgendaInterest[];
}

export const AgendaRadar: React.FC<AgendaRadarProps> = ({ items }) => {
  const max = Math.max(1, ...items.map((i) => i.interestScore));

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden min-w-0">
      <header className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-1.5">
        <Radar size={15} className="text-cyan-400 shrink-0" />
        <h2 className="text-[11px] font-semibold text-slate-200 font-sans">아젠다 레이더</h2>
      </header>

      <div className="p-3 space-y-2.5">
        {items.length === 0 ? (
          <p className="text-center text-slate-600 text-[11px] italic font-sans py-4">
            큐시트에 오늘 다룰 이슈를 등록하면 관심도 랭킹이 표시됩니다.
          </p>
        ) : (
          items.map((a) => (
            <div key={a.issueId} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-200 font-sans truncate flex-1 min-w-0">{a.title}</span>
                {a.isRising && (
                  <span className="flex items-center gap-0.5 text-[9px] text-rose-300 font-semibold shrink-0">
                    <TrendingUp size={10} /> 급상승
                  </span>
                )}
                <span className="text-[10px] font-mono text-cyan-400 shrink-0">{a.interestScore}</span>
              </div>

              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${(a.interestScore / max) * 100}%` }}
                />
              </div>

              <div className="flex gap-2 text-[9px] text-slate-500 font-mono">
                <span>언급 {a.mentionCount}</span>
                <span>요구 {a.requestCount}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
