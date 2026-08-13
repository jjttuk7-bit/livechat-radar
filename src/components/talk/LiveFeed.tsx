/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 라이브 피드 — 화면 왼쪽의 세로 긴 컬럼.
 *
 * 왜 왼쪽 전체 높이인가: 진행자는 채팅 흐름을 **곁눈질로 계속** 보면서 분석 패널을 읽는다.
 * 작은 상자에 8줄만 보이면 흐름이 안 보여 원본을 확인하러 유튜브로 넘어가게 된다.
 * 세로로 길게 두면 한 화면에 30~40줄이 들어와 "지금 무슨 말이 오가는지"가 유지된다.
 *
 * 성능: 저장은 전량 유지하되 렌더는 최근 N건만 받는다 (App의 FEED_RENDER_CAP).
 * CPM 300 × 3시간 = 5만 건을 전부 DOM에 올리면 브라우저가 멈춘다.
 */

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { MessageSquare, ArrowDownToLine } from 'lucide-react';
import { ChatMessage } from '../../types';

interface LiveFeedProps {
  /** 렌더 대상 (이미 상한이 적용된 배열) */
  messages: ChatMessage[];
  /** 전체 수집 건수 — 상한과 비교해 "최근 N / 전체" 표시 */
  totalCount: number;
  renderCap: number;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  /** 실시간 지표 — 헤더에 얇게 얹는다 */
  cpm: number;
  isPolling: boolean;
}

/** 이 픽셀 안쪽이면 "바닥을 보고 있다"고 판단한다 */
const STICK_THRESHOLD_PX = 80;

export const LiveFeed: React.FC<LiveFeedProps> = ({
  messages, totalCount, renderCap, autoScroll, onToggleAutoScroll, cpm, isPolling,
}) => {
  // 스크롤 제어는 이 컴포넌트가 소유한다. 부모가 ref로 남의 DOM을 만지면
  // 레이아웃이 바뀔 때마다 조용히 끊긴다 (실제로 그렇게 깨졌다).
  const listRef = useRef<HTMLDivElement | null>(null);
  /**
   * 바닥까지 남은 거리. 스크롤할 때마다 갱신한다.
   *
   * "프로그램적 스크롤 vs 사용자 스크롤"을 플래그로 구분하려 했으나 실패했다 —
   * 스크롤 이벤트는 비동기로 병합되어 발생 순서를 보장하지 않는다.
   * 대신 **간격만 기록**하면 구분이 필요 없어진다:
   *   · 우리가 바닥으로 옮기면 간격이 0으로 기록되어 계속 따라간다
   *   · 사용자가 위로 올리면 큰 값이 기록되어 다음 갱신에서 끌어내리지 않는다
   *   · 사용자가 다시 바닥으로 내려오면 0이 되어 자동 추적이 재개된다
   */
  const gapRef = useRef<number>(0);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    gapRef.current = el.scrollHeight - el.scrollTop - el.clientHeight;
  };

  // DOM 커밋 직후 동기적으로 옮긴다.
  //
  // 앞서 실패한 두 방식:
  //   1) behavior:'smooth' — 3초 주기 갱신에서 애니메이션이 서로를 취소해 맨 위에 멈춘다
  //   2) requestAnimationFrame + cleanup의 cancelAnimationFrame — 다음 렌더가 프레임보다
  //      먼저 오면 예약이 매번 취소되어 한 번도 실행되지 않는다
  // useLayoutEffect 시점에는 새 행이 이미 반영되어 scrollHeight가 최신이므로 바로 넣으면 된다.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (!autoScroll) return;
    if (gapRef.current >= STICK_THRESHOLD_PX) return; // 사용자가 위를 보고 있으면 존중한다
    el.scrollTop = el.scrollHeight;
    gapRef.current = 0;
  }, [messages, autoScroll]);

  // 토글을 다시 켜면 즉시 바닥으로 복귀시킨다
  useEffect(() => {
    if (!autoScroll) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    gapRef.current = 0;
  }, [autoScroll]);

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full min-h-0">
      <header className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-1.5 shrink-0">
        <MessageSquare size={15} className="text-slate-400 shrink-0" />
        <h2 className="text-[11px] font-semibold text-slate-200 font-sans">라이브 피드</h2>

        {isPolling && (
          <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {cpm} CPM
          </span>
        )}

        <span className="ml-auto text-[10px] font-mono text-slate-500 shrink-0">
          {totalCount > renderCap ? `${renderCap} / ${totalCount}` : totalCount}
        </span>

        <button
          onClick={onToggleAutoScroll}
          title={autoScroll ? '자동 스크롤 끄기' : '자동 스크롤 켜기'}
          className={`shrink-0 p-1 rounded border transition-colors ${
            autoScroll
              ? 'border-cyan-500/40 text-cyan-300'
              : 'border-slate-800 text-slate-600 hover:text-slate-400'
          }`}
        >
          <ArrowDownToLine size={11} />
        </button>
      </header>

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5 font-mono text-[11px]"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 gap-2 px-3">
            <MessageSquare size={28} className="text-slate-800" />
            <p className="text-[11px] italic font-sans">
              라이브에 연결하면 채팅이 실시간으로 흐릅니다.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="leading-snug break-words">
              <span
                className={
                  m.isOwner
                    ? 'text-lime-400'
                    : m.isModerator
                      ? 'text-emerald-400'
                      : m.isSponsor
                        ? 'text-violet-400'
                        : 'text-slate-500'
                }
              >
                {m.author}
              </span>
              <span className="text-slate-600">: </span>
              <span className="text-slate-300">{m.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
