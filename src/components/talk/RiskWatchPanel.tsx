/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 리스크 워치 패널 (P-6) — 정치·시사 버전의 킬러 기능.
 *
 * 정치 채널 운영자의 실질적 최대 공포는 "질문 놓침"이 아니라 채널 제재·법적 분쟁이다.
 * 이 패널은 위험 신호를 심각도순으로 모아 보여주고 권고 조치를 제시한다.
 *
 * ⚠️ 설계 제약 (D-4 / D-5):
 *   - 표시는 **탐지 신호**이지 판정이 아니다. 면책 문구를 상시 노출한다.
 *   - 자동 삭제·차단 버튼을 제공하지 않는다. 조치는 사람이 결정한다.
 */

import React from 'react';
import { ShieldAlert, AlertTriangle, Check } from 'lucide-react';
import { RiskAlert } from '../../types/liveTalk';
import { TAG_LABEL, SEVERITY_LABEL, SEVERITY_CHIP, RISK_DISCLAIMER } from './talkLabels';

interface RiskWatchPanelProps {
  alerts: RiskAlert[];
  /** 사용자가 처리 완료로 표시한 항목 id */
  resolvedIds: Set<string>;
  onResolve: (id: string) => void;
}

export const RiskWatchPanel: React.FC<RiskWatchPanelProps> = ({ alerts, resolvedIds, onResolve }) => {
  const visible = alerts.filter((a) => !resolvedIds.has(a.id));

  return (
    <section className="bg-slate-900/60 border border-rose-500/20 rounded-xl overflow-hidden min-w-0">
      <header className="px-3 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldAlert size={15} className="text-rose-400 shrink-0" />
          <h2 className="text-[11px] font-semibold text-slate-200 font-sans truncate">리스크 워치</h2>
        </div>
        <span className="text-[10px] font-mono text-rose-300 shrink-0">{visible.length}건</span>
      </header>

      <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/70">
        {visible.length === 0 ? (
          <div className="p-5 text-center text-slate-600 text-[11px] italic font-sans">
            감지된 위험 신호가 없습니다.
          </div>
        ) : (
          visible.map((a) => (
            <article key={a.id} className="p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold font-sans ${SEVERITY_CHIP[a.severity]}`}>
                  {SEVERITY_LABEL[a.severity]}
                </span>
                <span className="text-[10px] font-semibold text-rose-300 font-sans">{TAG_LABEL[a.tag]}</span>
                {a.spreadCount > 1 && (
                  <span className="text-[9px] font-mono text-slate-500">확산 {a.spreadCount}건</span>
                )}
                <button
                  onClick={() => onResolve(a.id)}
                  className="ml-auto text-slate-600 hover:text-emerald-400 transition-colors shrink-0"
                  title="처리 완료로 표시"
                >
                  <Check size={13} />
                </button>
              </div>

              <p className="text-[11px] text-slate-300 font-mono leading-snug break-words">
                {a.author && <span className="text-slate-500">{a.author}: </span>}
                “{a.text}”
              </p>

              <p className="text-[10px] text-slate-500 font-sans leading-snug">{a.reason}</p>
              <p className="text-[10px] text-amber-300/80 font-sans leading-snug">▸ {a.recommendation}</p>
            </article>
          ))
        )}
      </div>

      <footer className="px-3 py-1.5 border-t border-slate-800 bg-slate-950/40">
        <p className="text-[9px] text-slate-600 font-sans">{RISK_DISCLAIMER}</p>
      </footer>
    </section>
  );
};

interface RiskBannerProps {
  alerts: RiskAlert[];
  /** 이 수를 넘으면 상단 전체 폭 경고로 승격 */
  threshold?: number;
}

/**
 * 임계 초과 시에만 등장하는 상단 전체 폭 배너.
 * 진행자가 채팅창을 안 보고 있어도 인지할 수 있어야 하므로 레이아웃 최상단에 둔다.
 */
export const RiskBanner: React.FC<RiskBannerProps> = ({ alerts, threshold = 3 }) => {
  const high = alerts.filter((a) => a.severity === 'high').length;
  if (alerts.length < threshold && high === 0) return null;

  return (
    <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl px-3 py-2 flex items-center gap-2">
      <AlertTriangle size={15} className="text-rose-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-rose-300 font-sans">
          댓글창 확인이 필요합니다 — 위험 신호 {alerts.length}건
          {high > 0 && ` (심각도 높음 ${high}건)`}
        </p>
        <p className="text-[10px] text-slate-400 font-sans">
          슬로우 모드 적용과 모더레이터 확인을 권장합니다. 진행자도 단정적 표현을 피해 주십시오.
        </p>
      </div>
      <span className="text-[9px] text-slate-600 font-sans hidden sm:block shrink-0">{RISK_DISCLAIMER}</span>
    </div>
  );
};
