/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 회차 비교 · 아젠다 추이 · 단골 누적 (P-11).
 *
 * 매일 방송하는 정치·시사 채널에서만 의미가 생기는 패널이다. 쇼핑처럼 비정기 방송이면
 * 비교 대상이 없어 빈 상태로 남는다.
 *
 * ⚠️ D-8: 참여자는 해시로만 저장되므로 여기서 "누구"는 알 수 없다.
 *   보여줄 수 있는 것은 "몇 명이 얼마나 자주 오는가"뿐이며, 그것이 필요한 전부다.
 */

import React from 'react';
import { History, ArrowUpRight, ArrowDownRight, Minus, Users, Inbox } from 'lucide-react';
import { AgendaTrend, SessionComparison } from '../../types/liveTalk';

export interface ReturningStatsView {
  sessions: number;
  uniqueParticipants: number;
  returning: number;
  core: number;
  returningRate: number;
}

interface SessionHistoryPanelProps {
  comparison: SessionComparison | null;
  agendaTrends: AgendaTrend[];
  returning: ReturningStatsView | null;
  carryOver: string[];
  /** 'supabase' | 'file' — 폴백 상태를 숨기지 않고 알려준다 */
  store: string | null;
  retentionDays: number | null;
}

function Delta({ value, unit = '', invert = false }: { value: number; unit?: string; invert?: boolean }) {
  if (value === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-mono text-slate-500">
        <Minus size={9} />0{unit}
      </span>
    );
  }
  // invert=true인 지표(리스크 등)는 증가가 나쁜 것이다
  const isGood = invert ? value < 0 : value > 0;
  const cls = isGood ? 'text-emerald-400' : 'text-rose-400';
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-mono ${cls}`}>
      <Icon size={9} />
      {value > 0 ? '+' : ''}
      {value}
      {unit}
    </span>
  );
}

const TREND_ICON: Record<AgendaTrend['direction'], { cls: string; label: string }> = {
  rising: { cls: 'text-rose-300', label: '↑ 상승' },
  falling: { cls: 'text-slate-500', label: '↓ 하강' },
  flat: { cls: 'text-slate-400', label: '– 유지' },
};

export const SessionHistoryPanel: React.FC<SessionHistoryPanelProps> = ({
  comparison, agendaTrends, returning, carryOver, store, retentionDays,
}) => {
  const hasAnything = comparison?.previous || agendaTrends.length > 0 || (returning?.sessions ?? 0) > 0;

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden min-w-0">
      <header className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-1.5">
        <History size={15} className="text-indigo-400 shrink-0" />
        <h2 className="text-[11px] font-semibold text-slate-200 font-sans">회차 비교</h2>
        {store && (
          <span className="ml-auto text-[9px] font-mono text-slate-600" title={store === 'file' ? 'Supabase 미설정 — 로컬 파일에 저장 중' : 'Supabase에 저장 중'}>
            {store === 'file' ? '로컬 저장' : 'Supabase'}
            {retentionDays ? ` · ${retentionDays}일 보존` : ''}
          </span>
        )}
      </header>

      <div className="p-3 space-y-3">
        {!hasAnything ? (
          <p className="text-center text-slate-600 text-[11px] italic font-sans py-3">
            방송을 마치고 리포트를 생성하면 회차가 기록됩니다. 2회차부터 비교가 표시됩니다.
          </p>
        ) : (
          <>
            {/* 직전 회차 대비 */}
            {comparison?.previous && comparison.deltas && (
              <div className="space-y-1.5">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider font-sans">
                  직전 회차 대비 ({new Date(comparison.previous.startedAt).toLocaleDateString('ko-KR')})
                </p>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {[
                    { label: '총 댓글', value: comparison.deltas.totalMessages },
                    { label: '피크 CPM', value: comparison.deltas.peakCpm },
                    { label: '결집 온도', value: comparison.deltas.avgRallyHeat, unit: '%' },
                    { label: '후원', value: comparison.deltas.supportCount },
                    { label: '응답률', value: comparison.deltas.answerRate, unit: '%' },
                    { label: '리스크', value: comparison.deltas.riskCount, invert: true },
                  ].map((d) => (
                    <li key={d.label} className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] text-slate-400 font-sans truncate flex-1 min-w-0">{d.label}</span>
                      <Delta value={d.value} unit={d.unit} invert={d.invert} />
                    </li>
                  ))}
                </ul>
                <p className="flex items-center gap-1 text-[10px] text-cyan-300 font-sans pt-0.5">
                  <Users size={10} />
                  직전 회차에도 온 분 {comparison.returningCount}명 ({comparison.returningRate}%)
                </p>
              </div>
            )}

            {/* 아젠다 추이 */}
            {agendaTrends.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-slate-800">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider font-sans">
                  아젠다 수명
                </p>
                <ul className="space-y-0.5">
                  {agendaTrends.slice(0, 5).map((t) => (
                    <li key={t.title} className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] text-slate-300 font-sans truncate flex-1 min-w-0">{t.title}</span>
                      {t.streak > 1 && (
                        <span className="text-[9px] font-mono text-slate-500 shrink-0">{t.streak}회 연속</span>
                      )}
                      <span className={`text-[9px] font-sans shrink-0 ${TREND_ICON[t.direction].cls}`}>
                        {TREND_ICON[t.direction].label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 단골 누적 */}
            {returning && returning.sessions > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider font-sans mb-1">
                  단골 누적 (최근 {returning.sessions}회차)
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-sans">
                  <span className="text-slate-400">고유 <span className="font-mono text-slate-200">{returning.uniqueParticipants}</span></span>
                  <span className="text-slate-400">재방문 <span className="font-mono text-cyan-300">{returning.returning}</span></span>
                  <span className="text-slate-400">단골 <span className="font-mono text-violet-300">{returning.core}</span></span>
                  <span className="text-slate-400">재방문율 <span className="font-mono text-slate-200">{returning.returningRate}%</span></span>
                </div>
              </div>
            )}

            {/* 이월 요구 */}
            {carryOver.length > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <p className="flex items-center gap-1 text-[9px] font-semibold text-amber-300 uppercase tracking-wider font-sans mb-1">
                  <Inbox size={10} /> 지난 방송 미해소 요구 {carryOver.length}건
                </p>
                <ul className="space-y-0.5">
                  {carryOver.map((q, i) => (
                    <li key={i} className="text-[10px] text-slate-400 font-mono truncate">▸ {q}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
