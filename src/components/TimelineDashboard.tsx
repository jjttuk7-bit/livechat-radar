/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TimelineDashboard — B-4 시간축 분석 차트 패널.
 *
 * 단일 카드 wrapper 내에 3개 미니 차트:
 *  1. CPM Timeline (LineChart) — 분당 댓글 수 추이
 *  2. Sentiment Timeline (AreaChart, stacked) — 긍/중/부 정서 비율 추이
 *  3. Category Timeline (LineChart) — 구매/장애/불만 특수 댓글 카운트 추이
 *
 * 데이터는 App.tsx에서 누적해 props로 전달. 빈 상태(history.length === 0)도 안내 메시지로 처리.
 */

import React from 'react';
import { Activity, TrendingUp, Tag } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { CpmPoint, SentimentSnapshot, CategorySnapshot } from '../types';

interface TimelineDashboardProps {
  cpmHistory: CpmPoint[];
  sentimentHistory: SentimentSnapshot[];
  categoryHistory: CategorySnapshot[];
}

const formatTime = (t: number): string => {
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const COLOR = {
  cpm: '#22d3ee',           // cyan-400
  positive: '#34d399',      // emerald-400
  neutral: '#94a3b8',       // slate-400
  negative: '#fb7185',      // rose-400
  purchase: '#34d399',      // emerald-400
  stream: '#fbbf24',        // amber-400
  complaint: '#fb7185',     // rose-400
  grid: '#334155',          // slate-700
  axis: '#64748b',          // slate-500
};

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#0f172a',          // slate-900
  border: '1px solid #334155',    // slate-700
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',               // slate-200
};

const EmptyHint: React.FC<{ message: string }> = ({ message }) => (
  <div className="h-full flex items-center justify-center text-[11px] text-slate-500 italic px-3 text-center">
    {message}
  </div>
);

const ChartFrame: React.FC<{
  title: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  children: React.ReactNode;
}> = ({ title, Icon, iconColor, children }) => (
  // Fixed-pixel height on the chart wrapper. Recharts ResponsiveContainer
  // needs a parent with an explicitly resolved height; flex-1 + min-h inside
  // a flex/grid ancestor causes it to measure as -1, which can collapse the
  // whole analysis panel.
  <div className="flex flex-col bg-slate-950/40 border border-slate-800 rounded-lg p-3">
    <div className="flex items-center gap-2 mb-2">
      <Icon size={14} className={iconColor} />
      <span className="text-[11px] font-semibold text-slate-300 font-sans uppercase tracking-wide">{title}</span>
    </div>
    <div className="h-[160px] w-full">{children}</div>
  </div>
);

export const TimelineDashboard: React.FC<TimelineDashboardProps> = ({
  cpmHistory,
  sentimentHistory,
  categoryHistory,
}) => {
  const cpmData = cpmHistory.map(p => ({ time: formatTime(p.t), cpm: p.cpm }));
  const sentimentData = sentimentHistory.map(s => ({
    time: formatTime(s.t),
    긍정: s.positive,
    중립: s.neutral,
    부정: s.negative,
  }));
  const categoryData = categoryHistory.map(c => ({
    time: formatTime(c.t),
    '🛒 구매': c.purchase_signal,
    '⚡ 장애': c.stream_issue,
    '🚨 불만': c.complaint,
  }));

  return (
    <div
      id="timeline-dashboard"
      className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group"
    >
      {/* Glow decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all duration-500"></div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700/50 text-cyan-400">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200 font-sans">📈 방송 흐름 시간축</h3>
            <p className="text-[10px] text-slate-500 font-sans">CPM · 정서 · 특수 카테고리 추이 — 누적 데이터</p>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          CPM {cpmHistory.length}p · 분석 {sentimentHistory.length}p
        </div>
      </div>

      {/* 3-col grid (sm 이상에서) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* CPM Line */}
        <ChartFrame title="CPM 추이" Icon={TrendingUp} iconColor="text-cyan-400">
          {cpmData.length === 0 ? (
            <EmptyHint message="실시간 댓글이 쌓이면 CPM 추이가 그려집니다." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpmData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COLOR.grid} strokeOpacity={0.3} strokeDasharray="2 3" />
                <XAxis dataKey="time" stroke={COLOR.axis} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis stroke={COLOR.axis} tick={{ fontSize: 9 }} width={28} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94a3b8' }} formatter={(v: number) => [`${v} CPM`, '댓글/분']} />
                <Line type="monotone" dataKey="cpm" stroke={COLOR.cpm} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        {/* Sentiment Stacked Area */}
        <ChartFrame title="정서 분포 추이" Icon={Activity} iconColor="text-emerald-400">
          {sentimentData.length === 0 ? (
            <EmptyHint message="AI 분석 결과가 누적되면 정서 추이가 그려집니다." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sentimentData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} stackOffset="expand">
                <CartesianGrid stroke={COLOR.grid} strokeOpacity={0.3} strokeDasharray="2 3" />
                <XAxis dataKey="time" stroke={COLOR.axis} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis stroke={COLOR.axis} tick={{ fontSize: 9 }} width={28} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94a3b8' }} formatter={(v: number, n: string) => [`${v}%`, n]} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} iconSize={8} />
                <Area type="monotone" dataKey="긍정" stackId="1" stroke={COLOR.positive} fill={COLOR.positive} fillOpacity={0.5} isAnimationActive={false} />
                <Area type="monotone" dataKey="중립" stackId="1" stroke={COLOR.neutral} fill={COLOR.neutral} fillOpacity={0.4} isAnimationActive={false} />
                <Area type="monotone" dataKey="부정" stackId="1" stroke={COLOR.negative} fill={COLOR.negative} fillOpacity={0.5} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        {/* Category Lines */}
        <ChartFrame title="특수 카테고리 추이" Icon={Tag} iconColor="text-amber-400">
          {categoryData.length === 0 ? (
            <EmptyHint message="AI 분석 결과가 누적되면 카테고리 추이가 그려집니다." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={categoryData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COLOR.grid} strokeOpacity={0.3} strokeDasharray="2 3" />
                <XAxis dataKey="time" stroke={COLOR.axis} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis stroke={COLOR.axis} tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94a3b8' }} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} iconSize={8} />
                <Line type="monotone" dataKey="🛒 구매" stroke={COLOR.purchase} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="⚡ 장애" stroke={COLOR.stream} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="🚨 불만" stroke={COLOR.complaint} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </div>
    </div>
  );
};
