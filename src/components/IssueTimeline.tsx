import React from 'react';
import { Clock3, ShieldCheck } from 'lucide-react';
import { CommentAnalysis, LiveModeId } from '../types/liveRadar';

interface IssueTimelineProps {
  mode: LiveModeId;
  distribution: Record<string, number>;
  analyses: CommentAnalysis[];
}

export const IssueTimeline: React.FC<IssueTimelineProps> = ({ mode, distribution, analyses }) => {
  const topCategories = (Object.entries(distribution) as Array<[string, number]>)
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count > 0)
    .slice(0, 6);

  return (
    <aside className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 h-full">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-extrabold text-white">댓글 카테고리 분포</p>
          <p className="text-[10px] text-slate-500 mt-0.5">선택 모드 기준 mock 분석</p>
        </div>
        <Clock3 size={16} className="text-cyan-300" />
      </div>

      <div className="space-y-2">
        {topCategories.map(([category, count]) => {
          const ratio = Math.max(8, (count / Math.max(1, analyses.length)) * 100);

          return (
            <div key={category}>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-slate-300 font-bold">{category}</span>
                <span className="font-mono text-slate-500">{count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-cyan-400/70" style={{ width: `${ratio}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-800">
        <p className="text-[10px] text-slate-500 font-bold mb-2">최근 신호</p>
        <div className="space-y-2">
          {analyses.slice(-4).map((analysis) => (
            <div key={analysis.id} className="rounded-lg bg-slate-950/70 border border-slate-800 p-2">
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-cyan-300 font-bold">{analysis.category}</span>
                <span className="text-slate-600 font-mono">{new Date(analysis.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 truncate">{analysis.text}</p>
            </div>
          ))}
        </div>
      </div>

      {mode === 'issue' && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-[10px] text-amber-100 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <ShieldCheck size={12} />
            중립 안전 기준
          </div>
          특정 입장을 강화하지 않고 논점 구조, 과열 신호, 확인 필요 주장만 정리합니다.
        </div>
      )}
    </aside>
  );
};
