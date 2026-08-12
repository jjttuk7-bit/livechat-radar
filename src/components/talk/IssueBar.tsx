/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 큐시트 바 — 오늘 다룰 이슈 칩. 현재 진행 중 이슈를 하이라이트한다.
 * 여기서 등록한 키워드·인물이 L1 사전으로 주입되므로, 실제 인물·정당명을 코드에
 * 하드코딩하지 않고도 아젠다 매칭이 동작한다 (D-7 대칭성 확보 경로).
 */

import React from 'react';
import { ListChecks, Plus, Radio } from 'lucide-react';
import { LiveIssue } from '../../types/liveTalk';

interface IssueBarProps {
  issues: LiveIssue[];
  onOpenModal: () => void;
  onSetActive: (id: string) => void;
}

export const IssueBar: React.FC<IssueBarProps> = ({ issues, onOpenModal, onSetActive }) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2 overflow-x-auto min-w-0">
      <div className="flex items-center gap-1.5 shrink-0">
        <ListChecks size={14} className="text-cyan-400" />
        <span className="text-[10px] font-semibold text-slate-400 font-sans">큐시트</span>
      </div>

      {issues.length === 0 ? (
        <span className="text-[10px] text-slate-600 italic font-sans">
          오늘 다룰 이슈를 등록하면 아젠다 매칭이 시작됩니다.
        </span>
      ) : (
        <div className="flex items-center gap-1.5 min-w-0">
          {issues.map((i) => (
            <button
              key={i.id}
              onClick={() => onSetActive(i.id)}
              className={`px-2 py-1 rounded-lg border text-[10px] font-sans whitespace-nowrap transition-colors flex items-center gap-1 ${
                i.isActive
                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
              title={i.keywords?.length ? `키워드: ${i.keywords.join(', ')}` : undefined}
            >
              {i.isActive && <Radio size={9} className="animate-pulse" />}
              {i.title}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onOpenModal}
        className="ml-auto shrink-0 px-2 py-1 rounded-lg border border-slate-700 text-[10px] text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors flex items-center gap-1 font-sans"
      >
        <Plus size={11} /> 이슈 등록
      </button>
    </div>
  );
};
