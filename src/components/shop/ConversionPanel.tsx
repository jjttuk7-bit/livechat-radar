/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-2-1 전환 퍼널 + G-2-2 판매 모멘텀 — "지금 얼마나 팔리나".
 */

import React from 'react';
import { AlertTriangle, Filter, Flame, TrendingDown, TrendingUp } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { ConversionFunnel, ShopTimelinePoint } from '../../types/liveShopping';

interface ConversionPanelProps {
  funnel: ConversionFunnel;
  timeline: ShopTimelinePoint[];
  priceWarning?: string | null;
}

const STAGES: Array<{ key: keyof Omit<ConversionFunnel, 'conversionRate'>; label: string; color: string }> = [
  { key: 'interest', label: '관심', color: 'bg-cyan-500' },
  { key: 'consideration', label: '고려', color: 'bg-sky-500' },
  { key: 'intent', label: '구매 임박', color: 'bg-amber-500' },
  { key: 'purchased', label: '구매 완료', color: 'bg-emerald-500' },
];

export const ConversionPanel: React.FC<ConversionPanelProps> = ({ funnel, timeline, priceWarning }) => {
  const max = Math.max(1, funnel.interest);

  // 모멘텀: 최근 윈도우 내 구매 인증 증가량
  const window = timeline.slice(-5);
  const total = timeline.length > 0 ? timeline[timeline.length - 1].purchased : 0;
  const delta = window.length >= 2 ? window[window.length - 1].purchased - window[0].purchased : 0;

  let momentumLabel = '판매 대기';
  let momentumColor = 'text-slate-400';
  let MomentumIcon = TrendingDown;
  if (delta > 0) {
    momentumLabel = '구매 가속 중';
    momentumColor = 'text-rose-400';
    MomentumIcon = Flame;
  } else if (total > 0 && delta === 0) {
    momentumLabel = '판매 유지';
    momentumColor = 'text-cyan-400';
    MomentumIcon = TrendingUp;
  } else if (total > 0 && delta < 0) {
    momentumLabel = '판매 둔화';
    momentumColor = 'text-amber-400';
    MomentumIcon = TrendingDown;
  }

  const spark = timeline.map((p) => ({ v: p.purchased }));

  return (
    <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
          <Filter size={13} className="text-emerald-400" />
          전환 퍼널 &amp; 판매 모멘텀
        </h3>
        <span className="text-[9px] text-slate-500 font-mono">시청자 단위</span>
      </div>

      {priceWarning && (
        <div className="mb-3 flex items-center gap-2 bg-amber-950/30 border border-amber-700/50 rounded-lg px-2.5 py-1.5">
          <AlertTriangle size={12} className="text-amber-400 shrink-0" />
          <span className="text-[10px] text-amber-200 font-sans leading-snug">{priceWarning}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 퍼널 (2/3) */}
        <div className="md:col-span-2 space-y-1.5">
          {STAGES.map((s) => {
            const val = funnel[s.key];
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span className="text-[10px] font-sans text-slate-400 w-14 shrink-0">{s.label}</span>
                <div className="flex-1 h-5 bg-slate-800/50 rounded overflow-hidden">
                  <div
                    className={`h-full ${s.color} rounded transition-all duration-500 flex items-center justify-end pr-1.5`}
                    style={{ width: `${Math.max(6, (val / max) * 100)}%` }}
                  >
                    <span className="text-[10px] font-mono font-bold text-slate-950">{val}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 전환율 + 모멘텀 (1/3) */}
        <div className="flex flex-col justify-between gap-3 border-l border-slate-800 md:pl-4">
          <div>
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-sans">추정 전환율</div>
            <div className="text-3xl font-extrabold font-mono text-emerald-400 leading-none mt-1">
              {funnel.conversionRate}<span className="text-sm text-slate-500">%</span>
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5 font-sans">관심 {funnel.interest} → 구매 {funnel.purchased}</div>
          </div>

          <div>
            <div className={`flex items-center gap-1.5 ${momentumColor}`}>
              <MomentumIcon size={14} />
              <span className="text-[11px] font-bold font-sans">{momentumLabel}</span>
              {delta > 0 && <span className="text-[10px] font-mono">+{delta}</span>}
            </div>
            <div className="h-8 w-full mt-1">
              {spark.length >= 2 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <Area type="monotone" dataKey="v" stroke="#fb7185" fill="#fb7185" fillOpacity={0.25} strokeWidth={1.5} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-[9px] text-slate-600 italic">분석 누적 시 추이 표시</div>
              )}
            </div>
            <div className="text-[9px] text-slate-500 font-mono">누적 구매 인증 {total}건</div>
          </div>
        </div>
      </div>
    </div>
  );
};
