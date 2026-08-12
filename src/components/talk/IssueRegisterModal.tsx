/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 큐시트 등록 모달 — 오늘 다룰 이슈/인물/예상 질문을 입력한다.
 * 여기 입력된 키워드·인물이 L1 사전으로 주입된다 (코드에 정치 어휘를 하드코딩하지 않는 경로).
 */

import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { LiveIssue } from '../../types/liveTalk';

interface IssueRegisterModalProps {
  issues: LiveIssue[];
  onClose: () => void;
  onSave: (issues: LiveIssue[]) => void;
}

const INPUT_CLS =
  'w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 font-sans placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50';

export const IssueRegisterModal: React.FC<IssueRegisterModalProps> = ({ issues, onClose, onSave }) => {
  const [draft, setDraft] = useState<LiveIssue[]>(
    issues.length > 0 ? issues : [{ id: `iss-${Date.now()}`, title: '', keywords: [], figures: [] }],
  );

  const update = (idx: number, patch: Partial<LiveIssue>) => {
    setDraft((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addRow = () => {
    setDraft((prev) => [...prev, { id: `iss-${Date.now()}-${prev.length}`, title: '', keywords: [], figures: [] }]);
  };

  const removeRow = (idx: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    // 제목이 빈 행은 버린다 — 빈 이슈는 아젠다 랭킹을 오염시킨다
    const cleaned = draft
      .filter((d) => d.title.trim().length > 0)
      .map((d, i) => ({ ...d, title: d.title.trim(), isActive: d.isActive ?? i === 0 }));
    onSave(cleaned);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#020617] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-100 font-sans">오늘의 큐시트</h2>
            <p className="text-[10px] text-slate-500 font-sans mt-0.5">
              등록한 키워드·인물로 채팅의 아젠다를 매칭합니다.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {draft.map((it, idx) => (
            <div key={it.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  className={INPUT_CLS}
                  placeholder="이슈 제목 (예: 예산안 처리)"
                  value={it.title}
                  onChange={(e) => update(idx, { title: e.target.value })}
                />
                <button
                  onClick={() => removeRow(idx)}
                  className="text-slate-600 hover:text-rose-400 transition-colors shrink-0"
                  title="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-500 font-sans block mb-1">매칭 키워드 (쉼표 구분)</label>
                  <input
                    className={INPUT_CLS}
                    placeholder="예산안, 예산, 본회의"
                    value={(it.keywords ?? []).join(', ')}
                    onChange={(e) =>
                      update(idx, { keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
                    }
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 font-sans block mb-1">관련 인물·기관 (쉼표 구분)</label>
                  <input
                    className={INPUT_CLS}
                    placeholder="위원장, 국회"
                    value={(it.figures ?? []).join(', ')}
                    onChange={(e) =>
                      update(idx, { figures: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] text-slate-500 font-sans block mb-1">
                  진행 포인트 (한 줄에 하나 — 방송 중 참고용)
                </label>
                <textarea
                  className={`${INPUT_CLS} h-14 resize-none`}
                  placeholder={'핵심 쟁점 정리\n관련 일정'}
                  value={(it.talkingPoints ?? []).join('\n')}
                  onChange={(e) =>
                    update(idx, { talkingPoints: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
                  }
                />
              </div>
            </div>
          ))}

          <button
            onClick={addRow}
            className="w-full py-2 rounded-xl border border-dashed border-slate-800 text-[11px] text-slate-500 hover:border-cyan-500/40 hover:text-cyan-400 transition-colors flex items-center justify-center gap-1 font-sans"
          >
            <Plus size={13} /> 이슈 추가
          </button>
        </div>

        <footer className="px-4 py-3 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 hover:text-slate-200 transition-colors font-sans"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/50 text-[11px] text-cyan-300 hover:bg-cyan-500/25 transition-colors font-sans font-bold"
          >
            저장
          </button>
        </footer>
      </div>
    </div>
  );
};
