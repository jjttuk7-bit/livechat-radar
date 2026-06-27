/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-2-4 멘트 효과 마킹 — 혜택 멘트 친 시점을 기록하고 직후 구매/온도 상승을 측정.
 */

import React from 'react';
import { Megaphone, Trash2 } from 'lucide-react';
import { MentionMark } from '../../types/liveShopping';
import { computeMentionLift } from '../../lib/conversion';
import { relativeTime } from './shopLabels';

interface MentionLiftCardProps {
  marks: MentionMark[];
  currentPurchased: number;
  currentTemp: number;
  onAdd: (label: string) => void;
  onClear: () => void;
}

const PRESETS = ['쿠폰 멘트', '한정 수량', '사은품', '가격 강조'];

export const MentionLiftCard: React.FC<MentionLiftCardProps> = ({ marks, currentPurchased, currentTemp, onAdd, onClear }) => {
  const recent = [...marks].reverse();

  return (
    <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
          <Megaphone size={13} className="text-amber-400" />
          멘트 효과 추적
        </h3>
        {marks.length > 0 && (
          <button onClick={onClear} className="text-[9px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors">
            <Trash2 size={10} /> 초기화
          </button>
        )}
      </div>

      {/* 멘트 마킹 버튼 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => onAdd(p)}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-950/30 border border-amber-800/50 hover:bg-amber-900/40 text-amber-300 font-sans transition-colors"
          >
            + {p}
          </button>
        ))}
      </div>

      {recent.length === 0 ? (
        <p className="text-[10px] text-slate-600 italic font-sans">
          혜택 멘트를 칠 때 버튼을 누르면, 직후 구매 인증·구매 온도 상승을 측정합니다.
        </p>
      ) : (
        <div className="space-y-1.5">
          {recent.map((m) => {
            const { purchasedLift, tempLift } = computeMentionLift(m, currentPurchased, currentTemp);
            const positive = purchasedLift > 0 || tempLift > 0;
            return (
              <div key={m.id} className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-bold text-slate-200 font-sans truncate">{m.label}</span>
                  <span className="text-[9px] text-slate-600 font-mono shrink-0">{relativeTime(m.at)}</span>
                </div>
                <div className={`text-[10px] font-mono font-bold shrink-0 ${positive ? 'text-emerald-400' : 'text-slate-500'}`}>
                  구매 {purchasedLift >= 0 ? '+' : ''}{purchasedLift} · 온도 {tempLift >= 0 ? '+' : ''}{tempLift}%p
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
