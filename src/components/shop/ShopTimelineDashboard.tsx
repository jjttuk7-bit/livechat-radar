/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ShopTimelineDashboard — 라이브 쇼핑 축 시간축 분석 (S-7).
 *
 * 단일 카드 wrapper 내 3개 미니 차트:
 *  1. 구매 온도 추이 (AreaChart, %)
 *  2. CPM 추이 (LineChart)
 *  3. 가격 저항 / 미응답 추이 (LineChart, 건)
 *
 * 데이터는 App.tsx에서 분석마다 ShopTimelinePoint로 누적해 전달.
 */

import React from 'react';
import { Activity, Flame, TrendingUp } from 'lucide-react';
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
import { ShopTimelinePoint } from '../../types/liveShopping';

interface ShopTimelineDashboardProps {
  points: ShopTimelinePoint[];
}

const formatTime = (t: number): string => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

const COLOR = {
  temp: '#22d3ee',        // cyan-400
  cpm: '#38bdf8',         // sky-400
  price: '#fbbf24',       // amber-400
  unanswered: '#fb7185',  // rose-400
  grid: '#334155',
  axis: '#64748b',
};

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};

const EmptyHint: React.FC<{ message: string }> = ({ message }) => (
  <div className="h-full flex items-center justify-center text-[11px] text-slate-500 italic px-3 text-center">{message}</div>
);

const ChartFrame: React.FC<{
  title: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  children: React.ReactNode;
}> = ({ title, Icon, iconColor, children }) => (
  <div className="min-w-0 flex flex-col bg-slate-950/40 border border-slate-800 rounded-lg p-3">
    <div className="flex items-center gap-2 mb-2">
      <Icon size={14} className={iconColor} />
      <span className="text-[11px] font-semibold text-slate-300 font-sans uppercase tracking-wide">{title}</span>
    </div>
    <div className="h-[160px] w-full">{children}</div>
  </div>
);

export const ShopTimelineDashboard: React.FC<ShopTimelineDashboardProps> = ({ points }) => {
  const data = points.map((p) => ({
    time: formatTime(p.t),
    '구매 온도': p.purchaseTemp,
    CPM: p.cpm,
    '가격 저항': p.priceResistance,
    미응답: p.unansweredCount,
  }));

  return (
    <div
      id="shop-timeline-dashboard"
      className="w-full min-w-0 bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all duration-500"></div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700/50 text-cyan-400">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200 font-sans">📈 판매 흐름 시간축</h3>
            <p className="text-[10px] text-slate-500 font-sans">구매 온도 · CPM · 가격 저항 · 미응답 추이 — 분석 누적</p>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">분석 {points.length}p</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ChartFrame title="구매 온도 추이" Icon={Flame} iconColor="text-cyan-400">
          {data.length === 0 ? (
            <EmptyHint message="AI 분석이 누적되면 구매 온도 추이가 그려집니다." />
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
              <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COLOR.grid} strokeOpacity={0.3} strokeDasharray="2 3" />
                <XAxis dataKey="time" stroke={COLOR.axis} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis stroke={COLOR.axis} tick={{ fontSize: 9 }} width={28} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94a3b8' }} formatter={(v: number) => [`${v}%`, '구매 온도']} />
                <Area type="monotone" dataKey="구매 온도" stroke={COLOR.temp} fill={COLOR.temp} fillOpacity={0.35} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        <ChartFrame title="CPM 추이" Icon={TrendingUp} iconColor="text-sky-400">
          {data.length === 0 ? (
            <EmptyHint message="실시간 댓글이 쌓이면 CPM 추이가 그려집니다." />
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COLOR.grid} strokeOpacity={0.3} strokeDasharray="2 3" />
                <XAxis dataKey="time" stroke={COLOR.axis} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis stroke={COLOR.axis} tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94a3b8' }} formatter={(v: number) => [`${v} CPM`, '댓글/분']} />
                <Line type="monotone" dataKey="CPM" stroke={COLOR.cpm} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        <ChartFrame title="가격 저항 / 미응답" Icon={Activity} iconColor="text-amber-400">
          {data.length === 0 ? (
            <EmptyHint message="AI 분석이 누적되면 저항·미응답 추이가 그려집니다." />
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COLOR.grid} strokeOpacity={0.3} strokeDasharray="2 3" />
                <XAxis dataKey="time" stroke={COLOR.axis} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis stroke={COLOR.axis} tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#94a3b8' }} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} iconSize={8} />
                <Line type="monotone" dataKey="가격 저항" stroke={COLOR.price} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="미응답" stroke={COLOR.unanswered} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </div>
    </div>
  );
};
