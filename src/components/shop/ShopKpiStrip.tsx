/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShopMetric } from '../../types/liveShopping';
import { STATUS_BORDER, STATUS_TEXT } from './shopLabels';

interface ShopKpiStripProps {
  metrics: ShopMetric[];
}

/** 라이브 쇼핑 KPI 스트립 — metrics 배열을 status 색상으로 카드화. */
export const ShopKpiStrip: React.FC<ShopKpiStripProps> = ({ metrics }) => {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-6 text-center text-slate-600 text-xs italic font-sans">
        댓글이 분석되면 구매 온도·판매 추정·미응답 질문 등 핵심 지표가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
      {metrics.map((m) => (
        <div
          key={m.id}
          className={`bg-slate-900/60 border ${STATUS_BORDER[m.status]} p-3 rounded-xl flex flex-col gap-1 relative overflow-hidden`}
          title={m.description}
        >
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-sans leading-tight truncate">
            {m.label}
          </div>
          <div className={`text-xl font-extrabold font-mono leading-none ${STATUS_TEXT[m.status]} flex items-baseline gap-0.5`}>
            {m.value}
            {m.unit && <span className="text-[10px] text-slate-500 font-normal">{m.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};
