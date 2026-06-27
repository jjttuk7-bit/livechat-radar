/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-1-1 핫리드 보드 — "지금 살 것 같은 시청자" 우선 표시.
 */

import React from 'react';
import { Crown, Flame, RefreshCw, ShieldAlert, Target } from 'lucide-react';
import { ViewerProfile } from '../../types/liveShopping';
import { TAG_LABEL } from './shopLabels';

interface HotLeadBoardProps {
  viewers: ViewerProfile[];
  limit?: number;
}

const stageColor = (score: number): string => {
  if (score >= 70) return 'from-rose-500 to-amber-400';
  if (score >= 40) return 'from-amber-500 to-cyan-400';
  return 'from-slate-600 to-slate-500';
};

export const HotLeadBoard: React.FC<HotLeadBoardProps> = ({ viewers, limit = 6 }) => {
  const top = viewers.slice(0, limit);

  return (
    <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
          <Target size={13} className="text-rose-400" />
          핫리드 보드
        </h3>
        <span className="text-[9px] text-slate-500 font-mono">살 것 같은 시청자순</span>
      </div>

      {top.length === 0 ? (
        <div className="py-8 text-center text-slate-600 text-[11px] italic font-sans px-3">
          댓글이 분석되면 관심을 보이는 시청자를 점수순으로 띄웁니다.
        </div>
      ) : (
        <div className="space-y-2">
          {top.map((v, idx) => (
            <div key={v.author} className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">#{idx + 1}</span>
                  <span className="text-[11px] font-bold text-slate-200 font-sans truncate">{v.author}</span>
                  {v.flag === 'hot_lead' && <Flame size={11} className="text-rose-400 shrink-0" />}
                  {v.isReturning && <RefreshCw size={10} className="text-emerald-400 shrink-0" />}
                  {v.isMember && <Crown size={10} className="text-amber-400 shrink-0" />}
                  {v.flag === 'troll' && <ShieldAlert size={11} className="text-slate-500 shrink-0" />}
                </div>
                <span className="text-[11px] font-mono font-bold text-rose-300 shrink-0">{v.leadScore}</span>
              </div>

              {/* lead score bar */}
              <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${stageColor(v.leadScore)} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.max(4, v.leadScore)}%` }}
                ></div>
              </div>

              <div className="flex items-center flex-wrap gap-1 text-[9px]">
                {v.funnelStage !== 'none' && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-sans">
                    {TAG_LABEL[v.funnelStage]}
                  </span>
                )}
                {v.isPurchaser && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 font-sans">구매 완료</span>
                )}
                {v.hesitationReasons.map((h) => (
                  <span key={h} className="px-1.5 py-0.5 rounded bg-violet-950/50 text-violet-300 border border-violet-800/50 font-sans">
                    {TAG_LABEL[h]}
                  </span>
                ))}
                {v.hasUnanswered && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-700/60 font-sans font-bold">
                    ❗답변 필요
                  </span>
                )}
                <span className="text-slate-600 font-mono ml-auto">댓글 {v.commentCount}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
