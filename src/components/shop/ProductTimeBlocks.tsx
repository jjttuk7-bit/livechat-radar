/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-4-4 멀티상품 타임블록 — 상품별 소개 구간 타임라인.
 */

import React from 'react';
import { Clock4 } from 'lucide-react';
import { ChatMessage } from '../../types';
import { ProductBlock, ShopTimelinePoint } from '../../types/liveShopping';
import { formatDuration, summarizeBlock } from '../../lib/productBlocks';

interface ProductTimeBlocksProps {
  blocks: ProductBlock[];
  messages: ChatMessage[];
  timeline: ShopTimelinePoint[];
}

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const ProductTimeBlocks: React.FC<ProductTimeBlocksProps> = ({ blocks, messages, timeline }) => {
  const ordered = [...blocks].reverse(); // 최신 구간 먼저

  return (
    <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
          <Clock4 size={13} className="text-sky-400" />
          상품 소개 타임블록
        </h3>
        <span className="text-[9px] text-slate-500 font-mono">{blocks.length}개 구간</span>
      </div>

      {ordered.length === 0 ? (
        <p className="text-[10px] text-slate-600 italic font-sans">
          상품 바에서 "현재 소개중" 상품을 지정하면 구간별 소개 시간·댓글·구매를 기록합니다.
        </p>
      ) : (
        <div className="space-y-1.5">
          {ordered.map((b) => {
            const s = summarizeBlock(b, messages, timeline);
            return (
              <div key={b.id} className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <span className="text-[11px] font-bold text-slate-200 font-sans truncate flex-1 flex items-center gap-1.5">
                  {b.name}
                  {s.isLive && <span className="text-[8px] px-1 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-700/50">방송중</span>}
                </span>
                <span className="text-[9px] text-slate-500 font-mono shrink-0">{fmtTime(b.startedAt)}{b.endedAt ? `~${fmtTime(b.endedAt)}` : '~'}</span>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">{formatDuration(s.durationSec)}</span>
                <span className="text-[10px] font-mono shrink-0 text-slate-500">댓글 {s.comments}</span>
                <span className="text-[10px] font-mono shrink-0 text-emerald-400 font-bold">구매 {s.purchased}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
