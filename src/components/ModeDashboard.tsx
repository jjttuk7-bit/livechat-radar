import React, { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { liveModeById } from '../config/liveModes';
import { analyzeComments, buildPostLiveReport, mockCommentsByMode } from '../lib/analyzeComments';
import { generateActionCards } from '../lib/generateActionCards';
import { LiveModeId } from '../types/liveRadar';
import { ActionCards } from './ActionCards';
import { IssueTimeline } from './IssueTimeline';
import { PostLiveReport } from './PostLiveReport';
import { RadarMetrics } from './RadarMetrics';

interface ModeDashboardProps {
  mode: LiveModeId;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

export const ModeDashboard: React.FC<ModeDashboardProps> = ({ mode, onCopy, copiedId }) => {
  const modeConfig = liveModeById[mode];
  const radar = useMemo(() => analyzeComments({ mode, comments: mockCommentsByMode[mode] }), [mode]);
  const actionCards = useMemo(() => generateActionCards(mode, radar.analyses), [mode, radar.analyses]);
  const report = useMemo(() => buildPostLiveReport(mode, radar.analyses), [mode, radar.analyses]);

  return (
    <section className="px-6 py-4 bg-[#020617] border-b border-[rgba(56,189,248,0.08)]">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Selected Director Mode</p>
          <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight mt-1">{modeConfig.label}</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">{modeConfig.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {modeConfig.metrics.slice(0, 4).map((item) => (
            <span key={item} className="text-[10px] border border-slate-800 bg-slate-900/70 text-slate-300 rounded-md px-2 py-1">
              {item}
            </span>
          ))}
        </div>
      </div>

      {modeConfig.safetyGuidelines && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 flex items-start gap-2">
          <ShieldCheck size={16} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-100 leading-relaxed">
            이슈 레이더는 특정 정치 입장을 유도하지 않습니다. 확인되지 않은 주장은 팩트체크 필요로 표시하고, 개인 비난은 사안 중심으로 전환하도록 안내합니다.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_340px] gap-4">
        <div className="space-y-4 min-w-0">
          <RadarMetrics metrics={radar.metrics} />
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-extrabold text-white">지금 할 일</h3>
              <span className="text-[10px] text-slate-500">진행자가 바로 말할 수 있는 액션 3개</span>
            </div>
            <ActionCards cards={actionCards} onCopy={onCopy} copiedId={copiedId} />
          </div>
        </div>

        <IssueTimeline mode={mode} distribution={radar.distribution} analyses={radar.analyses} />
      </div>

      <div className="mt-4">
        <PostLiveReport report={report} />
      </div>
    </section>
  );
};
