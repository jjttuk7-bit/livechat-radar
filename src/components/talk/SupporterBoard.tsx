/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 후원·충성 보드 (P-8).
 *
 * ⚠️ D-1 / D-2: 여기에 **정치성향을 표시하지 않는다.** 표시하는 것은 참여 빈도·후원·
 *   멤버십·재방문·미응답 보유 같은 비민감 축뿐이다. flag도 행위 기준이다.
 *   "이 사람은 어느 편인가"를 보여주는 UI는 이 제품의 범위가 아니다.
 */

import React from 'react';
import { Heart, Users, ShieldOff } from 'lucide-react';
import { SupporterProfile, SupporterSummary, SupporterFlag } from '../../types/liveTalk';
import { TAG_LABEL } from './talkLabels';

const FLAG_LABEL: Record<SupporterFlag, string> = {
  core_supporter: '핵심 후원',
  regular: '단골',
  troll: '주의',
  normal: '일반',
};

const FLAG_CHIP: Record<SupporterFlag, string> = {
  core_supporter: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  regular: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  troll: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  normal: 'bg-slate-700/40 text-slate-400 border-slate-700',
};

interface SupporterBoardProps {
  profiles: SupporterProfile[];
  summary: SupporterSummary;
}

export const SupporterBoard: React.FC<SupporterBoardProps> = ({ profiles, summary }) => {
  const top = profiles.filter((p) => p.flag !== 'troll').slice(0, 8);
  const watch = profiles.filter((p) => p.flag === 'troll');

  const segments: { label: string; value: number; cls: string }[] = [
    { label: '후원', value: summary.supporters, cls: 'bg-violet-500' },
    { label: '멤버', value: summary.members, cls: 'bg-indigo-500' },
    { label: '단골', value: summary.regulars, cls: 'bg-cyan-500' },
    { label: '관망', value: summary.onlookers, cls: 'bg-slate-600' },
    { label: '주의', value: summary.trolls, cls: 'bg-rose-500' },
  ];

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden min-w-0">
      <header className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-1.5">
        <Heart size={15} className="text-violet-400 shrink-0" />
        <h2 className="text-[11px] font-semibold text-slate-200 font-sans">후원·충성 보드</h2>
        <span className="ml-auto text-[10px] font-mono text-slate-500 flex items-center gap-1">
          <Users size={11} />
          {summary.total}
        </span>
      </header>

      <div className="p-3 space-y-3">
        {summary.total === 0 ? (
          <p className="text-center text-slate-600 text-[11px] italic font-sans py-3">
            분석이 진행되면 참여 시청자가 집계됩니다.
          </p>
        ) : (
          <>
            {/* 세그먼트 스택바 */}
            <div>
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
                {segments.map((s) =>
                  s.value > 0 ? (
                    <div
                      key={s.label}
                      className={s.cls}
                      style={{ width: `${(s.value / summary.total) * 100}%` }}
                      title={`${s.label} ${s.value}명`}
                    />
                  ) : null,
                )}
              </div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5">
                {segments.map((s) => (
                  <span key={s.label} className="flex items-center gap-1 text-[9px] text-slate-500 font-sans">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.cls}`} />
                    {s.label} {s.value}
                  </span>
                ))}
              </div>
            </div>

            {/* 상위 참여자 */}
            <ul className="space-y-1.5">
              {top.map((p) => (
                <li key={p.author} className="flex items-center gap-1.5 min-w-0">
                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold font-sans shrink-0 ${FLAG_CHIP[p.flag]}`}>
                    {FLAG_LABEL[p.flag]}
                  </span>
                  <span className="text-[11px] text-slate-300 font-sans truncate flex-1 min-w-0">{p.author}</span>
                  {p.hasUnanswered && (
                    <span className="text-[9px] text-amber-400 font-sans shrink-0" title="미응답 질문 보유">
                      질문 대기
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">{p.commentCount}건</span>
                  <span className="text-[10px] font-mono text-violet-300 shrink-0 w-7 text-right">{p.loyaltyScore}</span>
                </li>
              ))}
            </ul>

            {/* 주의 목록 — 행위 기준 */}
            {watch.length > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <p className="flex items-center gap-1 text-[9px] font-semibold text-rose-300 font-sans mb-1">
                  <ShieldOff size={10} /> 반복 위반 행위 {watch.length}명
                </p>
                <ul className="space-y-0.5">
                  {watch.slice(0, 4).map((p) => (
                    <li key={p.author} className="text-[10px] text-slate-500 font-sans truncate">
                      {p.author} — {p.riskFlagCount}건 ({p.topTags.slice(0, 2).map((t) => TAG_LABEL[t]).join(', ')})
                    </li>
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
