/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-2-3 클로징 윈도우 카운트다운 — 구매 적기에 호스트를 푸시.
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, Copy, Timer, Zap } from 'lucide-react';
import { ClosingWindow } from '../../types/liveShopping';

interface ClosingWindowCardProps {
  window: ClosingWindow;
  /** 분석 시각 — 새 분석마다 카운트다운을 리셋하기 위한 키 */
  refreshKey?: string;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

const COUNTDOWN_SEC = 30;

export const ClosingWindowCard: React.FC<ClosingWindowCardProps> = ({ window, refreshKey, onCopy, copiedId }) => {
  const [remaining, setRemaining] = useState(COUNTDOWN_SEC);

  // 윈도우가 열려 있는 동안만 카운트다운. open 전환/새 분석(refreshKey)마다 30초로 리셋.
  useEffect(() => {
    if (!window.open) return;
    setRemaining(COUNTDOWN_SEC);
    const id = setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [window.open, refreshKey]);

  if (!window.open) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center gap-2 text-slate-500">
        <Timer size={13} className="text-slate-600" />
        <span className="text-[11px] font-sans">클로징 대기 — 구매 온도가 오르면 타이밍을 알려드려요.</span>
      </div>
    );
  }

  const expired = remaining <= 0;

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-rose-500/60 bg-gradient-to-br from-rose-950/60 to-amber-950/30 p-4 shadow-[0_0_24px_rgba(244,63,94,0.18)]">
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-rose-500/20 rounded-full blur-2xl animate-pulse"></div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap size={15} className="text-rose-400" />
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider font-sans">
            {expired ? '클로징 타이밍 — 지금 마무리!' : '지금 클로징 타이밍'}
          </h3>
        </div>
        {/* 카운트다운 */}
        <div className={`flex items-center gap-1 font-mono font-extrabold ${expired ? 'text-amber-300' : 'text-rose-300'}`}>
          <Timer size={14} />
          <span className="text-lg tabular-nums">{expired ? 'NOW' : `${remaining}s`}</span>
        </div>
      </div>

      {window.reasons.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {window.reasons.map((r) => (
            <span key={r} className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950/70 text-rose-200 border border-rose-700/50 font-sans">
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        <p className="flex-1 text-[12px] text-amber-50 font-sans leading-relaxed italic pl-2 border-l-2 border-rose-400/50">
          "{window.suggestedLine}"
        </p>
        <button
          onClick={() => onCopy(window.suggestedLine, 'closing-line')}
          className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1 ${
            copiedId === 'closing-line'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              : 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-200 border border-rose-700/50'
          }`}
          title="클로징 멘트 복사"
        >
          {copiedId === 'closing-line' ? <CheckCircle size={10} /> : <Copy size={10} />}
        </button>
      </div>
    </div>
  );
};
