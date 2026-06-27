/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-1-2 시청자 세그먼트 + G-1-3 망설임 추적 + G-1-4 트롤 워치.
 */

import React from 'react';
import { ShieldAlert, Users } from 'lucide-react';
import { ViewerSummary } from '../../lib/buildViewerProfiles';
import { TAG_LABEL } from './shopLabels';

interface ViewerInsightsProps {
  summary: ViewerSummary;
}

const SEG: Array<{ key: keyof ViewerSummary['segments']; label: string; bar: string; text: string }> = [
  { key: 'purchaser', label: '구매자', bar: 'bg-emerald-500', text: 'text-emerald-400' },
  { key: 'hotLead', label: '핫리드', bar: 'bg-rose-500', text: 'text-rose-400' },
  { key: 'regular', label: '단골', bar: 'bg-cyan-500', text: 'text-cyan-400' },
  { key: 'watching', label: '관망', bar: 'bg-slate-600', text: 'text-slate-400' },
  { key: 'troll', label: '트롤', bar: 'bg-slate-700', text: 'text-slate-500' },
];

export const ViewerInsights: React.FC<ViewerInsightsProps> = ({ summary }) => {
  const { total, segments, hesitationByReason, trolls } = summary;

  return (
    <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
          <Users size={13} className="text-cyan-400" />
          시청자 인사이트
        </h3>
        <span className="text-[9px] text-slate-500 font-mono">{total}명</span>
      </div>

      {total === 0 ? (
        <div className="py-6 text-center text-slate-600 text-[11px] italic font-sans">
          댓글이 분석되면 시청자 세그먼트를 집계합니다.
        </div>
      ) : (
        <>
          {/* 세그먼트 스택 바 */}
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-800 mb-2">
            {SEG.map((s) => {
              const v = segments[s.key];
              if (v === 0) return null;
              return <div key={s.key} className={`${s.bar} h-full`} style={{ width: `${(v / total) * 100}%` }} title={`${s.label} ${v}`} />;
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
            {SEG.map((s) => (
              <span key={s.key} className="text-[10px] font-sans flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm ${s.bar}`} />
                <span className="text-slate-400">{s.label}</span>
                <span className={`font-mono font-bold ${s.text}`}>{segments[s.key]}</span>
              </span>
            ))}
          </div>

          {/* 망설임 추적 */}
          {hesitationByReason.length > 0 && (
            <div className="border-t border-slate-800 pt-2 mb-2">
              <div className="text-[9px] font-bold text-violet-400 uppercase tracking-wider font-sans mb-1.5">망설임 추적</div>
              <div className="flex flex-wrap gap-1.5">
                {hesitationByReason.map((h) => (
                  <span key={h.reason} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-950/50 text-violet-300 border border-violet-800/50 font-sans">
                    {TAG_LABEL[h.reason]} <span className="font-mono font-bold">{h.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 트롤 워치 */}
          {trolls.length > 0 && (
            <div className="border-t border-slate-800 pt-2 flex items-start gap-1.5">
              <ShieldAlert size={12} className="text-slate-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-sans">트롤 워치 ({trolls.length})</span>
                <p className="text-[10px] text-slate-500 font-sans truncate">{trolls.join(', ')} — 무시 권장</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
