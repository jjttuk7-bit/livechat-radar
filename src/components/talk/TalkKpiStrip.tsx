/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TalkMetric } from '../../types/liveTalk';
import { STATUS_BORDER, STATUS_TEXT } from './talkLabels';

interface TalkKpiStripProps {
  metrics: TalkMetric[];
}

/** 정치·시사 KPI 스트립 — metrics 배열을 status 색상으로 카드화. */
export const TalkKpiStrip: React.FC<TalkKpiStripProps> = ({ metrics }) => {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-slate-600 text-xs italic font-sans">
        채팅이 분석되면 결집 온도·미응답 요구·리스크 지수 등 핵심 지표가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9 gap-2.5">
      {metrics.map((m) => (
        <div
          key={m.id}
          className={`bg-slate-900/60 border ${STATUS_BORDER[m.status]} p-3 rounded-xl flex flex-col gap-1 relative overflow-hidden`}
          title={m.description}
        >
          <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider font-sans leading-tight truncate">
            {m.label}
          </div>
          <div className={`text-xl font-semibold font-mono leading-none ${STATUS_TEXT[m.status]} flex items-baseline gap-0.5`}>
            {m.value}
            {m.unit && <span className="text-[10px] text-slate-500 font-normal">{m.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};
