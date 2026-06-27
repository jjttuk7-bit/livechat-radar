/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PieChart } from 'lucide-react';
import { ShopAnalysisResult, ShopAxis } from '../../types/liveShopping';
import { AXIS_BAR, AXIS_LABEL, AXIS_TEXT } from './shopLabels';
import { SHOP_AXES } from '../../types/liveShopping';

interface AxisDistributionProps {
  analyses: ShopAnalysisResult['analyses'];
}

/** 6축 댓글 분포 — 어느 영역(가격/배송/신뢰…)에 댓글이 몰리는지. */
export const AxisDistribution: React.FC<AxisDistributionProps> = ({ analyses }) => {
  const total = analyses.length;
  const counts = SHOP_AXES.reduce((acc, axis) => {
    acc[axis] = analyses.filter((a) => a.axis === axis).length;
    return acc;
  }, {} as Record<ShopAxis, number>);

  const max = Math.max(1, ...SHOP_AXES.map((a) => counts[a]));

  return (
    <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
          <PieChart size={13} className="text-cyan-400" />
          6축 댓글 분포
        </h3>
        <span className="text-[9px] text-slate-500 font-mono">{total}건 분석</span>
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-slate-600 text-[11px] italic font-sans">분석된 댓글이 쌓이면 축별 분포를 표시합니다.</div>
      ) : (
        <div className="space-y-2">
          {SHOP_AXES.map((axis) => (
            <div key={axis} className="flex items-center gap-2">
              <span className={`text-[10px] font-bold font-sans w-16 shrink-0 ${AXIS_TEXT[axis]}`}>{AXIS_LABEL[axis]}</span>
              <div className="flex-1 h-3 bg-slate-800/60 rounded-full overflow-hidden">
                <div
                  className={`h-full ${AXIS_BAR[axis]} rounded-full transition-all duration-500`}
                  style={{ width: `${(counts[axis] / max) * 100}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-mono text-slate-400 w-6 text-right shrink-0">{counts[axis]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
