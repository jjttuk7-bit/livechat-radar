/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 시간축 추이 (P-9) — 결집 온도 / 논쟁·리스크 / CPM.
 *
 * ⚠️ Recharts 주의: ResponsiveContainer는 flex 부모 안에서 width(-1)로 붕괴한다.
 *   조상 flex 아이템에 min-w-0을 내리고 컨테이너에 minWidth={0}을 준다.
 *   (2026-06-06에 실제로 겪은 회귀이므로 차트를 추가할 때마다 확인한다.)
 */

import React from 'react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { TalkTimelinePoint } from '../../types/liveTalk';

interface TalkTimelineDashboardProps {
  points: TalkTimelinePoint[];
}

const AXIS_STYLE = { fontSize: 9, fill: '#62666d' };

const TOOLTIP_STYLE = {
  backgroundColor: '#08090a',
  border: '1px solid #23252a',
  borderRadius: 8,
  fontSize: 11,
  color: '#e5e5e6',
} as const;

function fmtTime(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const TalkTimelineDashboard: React.FC<TalkTimelineDashboardProps> = ({ points }) => {
  if (points.length < 2) {
    return (
      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center min-w-0">
        <p className="text-slate-600 text-[11px] italic font-sans">
          분석이 2회 이상 누적되면 시간축 추이가 표시됩니다. (분석 주기 약 40초)
        </p>
      </section>
    );
  }

  const data = points.map((p) => ({ ...p, label: fmtTime(p.t) }));

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden min-w-0">
      <header className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-1.5">
        <TrendingUp size={15} className="text-cyan-400 shrink-0" />
        <h2 className="text-[11px] font-semibold text-slate-200 font-sans">시간축 추이</h2>
        <span className="ml-auto text-[10px] font-mono text-slate-500">{points.length} 포인트</span>
      </header>

      <div className="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* 결집 온도 */}
        <div className="min-w-0">
          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1 font-sans">결집 온도</p>
          <div className="h-24 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <defs>
                  <linearGradient id="heatGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#02b8cc" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#02b8cc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#23252a" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="rallyHeat" stroke="#02b8cc" strokeWidth={1.5} fill="url(#heatGrad)" name="결집 온도" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 논쟁 + 리스크 */}
        <div className="min-w-0">
          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1 font-sans">논쟁 · 리스크</p>
          <div className="h-24 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <CartesianGrid stroke="#23252a" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="disputeLevel" stroke="#6366f1" strokeWidth={1.5} dot={false} name="논쟁" />
                <Line type="monotone" dataKey="riskCount" stroke="#eb5757" strokeWidth={1.5} dot={false} name="리스크" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CPM + 미응답 */}
        <div className="min-w-0">
          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1 font-sans">활성도 · 미응답</p>
          <div className="h-24 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <CartesianGrid stroke="#23252a" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="cpm" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="CPM" />
                <Line type="monotone" dataKey="unansweredCount" stroke="#27a644" strokeWidth={1.5} dot={false} name="미응답" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
};
