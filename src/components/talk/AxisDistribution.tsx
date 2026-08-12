/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 여론 분포 — 6축 집계.
 *
 * ⚠️ D-3: 여기는 **집계 단위 표시 전용**이다. 막대를 클릭해 개별 시청자 목록으로
 *   내려가는 인터랙션을 추가하지 않는다. 집계에서 개인으로 역추적하는 경로를 만들면
 *   개인 정치성향 프로파일링과 실질적으로 같아진다.
 */

import React, { useMemo } from 'react';
import { PieChart } from 'lucide-react';
import { TalkCommentAnalysis, TALK_AXES, TalkAxis } from '../../types/liveTalk';
import { AXIS_LABEL, AXIS_BAR, AXIS_TEXT } from './talkLabels';

interface AxisDistributionProps {
  analyses: TalkCommentAnalysis[];
}

export const AxisDistribution: React.FC<AxisDistributionProps> = ({ analyses }) => {
  const { counts, total } = useMemo(() => {
    const c = {} as Record<TalkAxis, number>;
    for (const a of TALK_AXES) c[a] = 0;
    let t = 0;
    for (const a of analyses) {
      // duplicateCount를 가중치로 반영 — 표본 1건이 n건을 대표한다
      const w = Math.max(1, a.duplicateCount);
      c[a.axis] += w;
      t += w;
    }
    return { counts: c, total: t };
  }, [analyses]);

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden min-w-0">
      <header className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-1.5">
        <PieChart size={15} className="text-blue-400 shrink-0" />
        <h2 className="text-[11px] font-semibold text-slate-200 font-sans">여론 분포</h2>
        <span className="ml-auto text-[10px] font-mono text-slate-500">{total}건</span>
      </header>

      <div className="p-3 space-y-2">
        {total === 0 ? (
          <p className="text-center text-slate-600 text-[11px] italic font-sans py-4">
            분석된 댓글이 없습니다.
          </p>
        ) : (
          <>
            {/* 스택 바 */}
            <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
              {TALK_AXES.map((axis) =>
                counts[axis] > 0 ? (
                  <div
                    key={axis}
                    className={AXIS_BAR[axis]}
                    style={{ width: `${(counts[axis] / total) * 100}%` }}
                    title={`${AXIS_LABEL[axis]} ${counts[axis]}건`}
                  />
                ) : null,
              )}
            </div>

            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {TALK_AXES.map((axis) => (
                <li key={axis} className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${AXIS_BAR[axis]}`} />
                  <span className="text-[10px] text-slate-400 font-sans truncate flex-1 min-w-0">
                    {AXIS_LABEL[axis]}
                  </span>
                  <span className={`text-[10px] font-mono shrink-0 ${AXIS_TEXT[axis]}`}>
                    {total > 0 ? Math.round((counts[axis] / total) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
};
