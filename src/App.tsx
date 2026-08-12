/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LiveChat Radar — 유튜브 정치·시사 라이브 AI 진행 조연출 (P-5 / P-6).
 *
 * 설계 근거: docs/plans/politics-pivot.md
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Sparkles, Bot, Video, MessageSquare, Activity, RotateCw,
  FileText, X, AlertCircle, CheckCircle, Pause, Play, Users, Gauge,
} from 'lucide-react';
import { ChatMessage, StreamInfo } from './types';
import {
  TalkAnalysisResult, TalkReportResult, TalkTimelinePoint, LiveIssue,
} from './types/liveTalk';
import { IssueBar } from './components/talk/IssueBar';
import { IssueRegisterModal } from './components/talk/IssueRegisterModal';
import { TalkKpiStrip } from './components/talk/TalkKpiStrip';
import { TalkActionCards } from './components/talk/TalkActionCards';
import { RiskWatchPanel, RiskBanner } from './components/talk/RiskWatchPanel';
import { UnansweredQueue } from './components/talk/UnansweredQueue';
import { AgendaRadar } from './components/talk/AgendaRadar';
import { AxisDistribution } from './components/talk/AxisDistribution';
import { SupporterBoard } from './components/talk/SupporterBoard';
import { ParticipationPanel } from './components/talk/ParticipationPanel';
import { TalkTimelineDashboard } from './components/talk/TalkTimelineDashboard';
import { SessionHistoryPanel, type ReturningStatsView } from './components/talk/SessionHistoryPanel';
import type { AgendaTrend, SessionComparison } from './types/liveTalk';
import { buildSupporterProfiles, summarizeSupporters } from './lib/supporters';
import { buildParticipationFunnel, detectAppealWindow, deriveStats } from './lib/engagement';

/** 분석 cadence ~40초 × 40 = ~27분 추이 보존 */
const TIMELINE_CAP = 40;

/**
 * 피드에 실제로 렌더할 최대 건수.
 *
 * CPM 300 × 3시간 = 5만 건이다. 전량을 DOM에 올리면 브라우저가 정지한다.
 * 저장은 전량 유지하고(리포트가 방송 전체를 대표해야 하므로) **렌더만** 최근 N건으로 제한한다.
 */
const FEED_RENDER_CAP = 200;

/**
 * 실시간 분석에 넘길 시간 윈도우.
 *
 * 고정 건수(slice(-80))는 CPM에 따라 커버 시간이 달라져 고CPM에서 유실이 생긴다.
 * 시간 기준으로 자르면 분석 주기(40초)보다 충분히 길어 유실이 구조적으로 없다.
 */
const ANALYZE_WINDOW_MS = 180_000; // 3분

/** 리포트 페이로드 상한 — 초과 시 앞을 자르지 않고 전 구간에서 균등 추출한다 */
const REPORT_PAYLOAD_CAP = 20_000;

interface L1Summary {
  total: number;
  unique: number;
  dedupeRate: number;
  authorCount: number;
  cpm: number;
  spike: boolean;
  riskCandidates: number;
  requestCandidates: number;
  brigading: number;
}

export default function App() {
  // 입력 / 스트림 상태
  const [urlInput, setUrlInput] = useState<string>('https://www.youtube.com/live/demo');
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState<boolean>(false);

  // 실시간 댓글
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // CPM
  const [cpm, setCpm] = useState<number>(0);
  const [peakCpm, setPeakCpm] = useState<number>(0);

  // AI 분석 결과
  const [analysis, setAnalysis] = useState<TalkAnalysisResult | null>(null);
  const [l1, setL1] = useState<L1Summary | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [autoAnalysisEnabled, setAutoAnalysisEnabled] = useState<boolean>(true);

  // 큐시트
  const [issues, setIssues] = useState<LiveIssue[]>([]);
  const [showIssueModal, setShowIssueModal] = useState<boolean>(false);

  // 로컬 해소 (진행자가 처리 완료 표시)
  const [resolvedRequestIds, setResolvedRequestIds] = useState<Set<string>>(new Set());
  const [resolvedRiskIds, setResolvedRiskIds] = useState<Set<string>>(new Set());

  // 종료 리포트
  const [report, setReport] = useState<TalkReportResult | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // 알림
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 타임라인
  const [timeline, setTimeline] = useState<TalkTimelinePoint[]>([]);
  const [chatAutoScroll, setChatAutoScroll] = useState<boolean>(true);

  // 크로스세션 (P-11)
  const [comparison, setComparison] = useState<SessionComparison | null>(null);
  const [agendaTrends, setAgendaTrends] = useState<AgendaTrend[]>([]);
  const [returningStats, setReturningStats] = useState<ReturningStatsView | null>(null);
  const [carryOver, setCarryOver] = useState<string[]>([]);
  const [sessionStoreKind, setSessionStoreKind] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  /** 이 회차의 고유 id — 방송 연결 시 확정 */
  const sessionIdRef = useRef<string>('');
  const sessionStartRef = useRef<string>('');

  // ── Refs ───────────────────────────────────────────────────────────────────
  // setState는 비동기라 타이머 콜백의 클로저가 낡은 값을 본다. 폴링·자동분석이
  // 최신 상태를 읽어야 하므로 ref로 미러링한다. (2026-06-06 stale closure 버그)
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAnalyzeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const lastAnalyzedCountRef = useRef<number>(0);
  const isPollingRef = useRef<boolean>(false);
  const pollingRateRef = useRef<number>(3000);
  const messagesCountRef = useRef<number>(0);
  const isAnalyzingRef = useRef<boolean>(false);
  const runAIAnalysisRef = useRef<() => void>(() => {});
  const issuesRef = useRef<LiveIssue[]>([]);
  const cpmRef = useRef<number>(0);
  const prevCpmRef = useRef<number>(0);

  // ── 알림 자동 해제 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // ── 자동 스크롤 — 컨테이너만 움직인다 (scrollIntoView는 페이지 전체를 움직임) ─
  useEffect(() => {
    if (chatAutoScroll && chatListRef.current) {
      chatListRef.current.scrollTo({ top: chatListRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, chatAutoScroll]);

  // ── CPM 계산 ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const calcCpm = () => {
      if (messages.length === 0) return;
      const oneMinuteAgo = Date.now() - 60000;
      const recentCount = messages.filter((m) => new Date(m.timestamp).getTime() >= oneMinuteAgo).length;
      setCpm(recentCount);
      cpmRef.current = recentCount;
      if (recentCount > peakCpm) setPeakCpm(recentCount);
    };
    const interval = setInterval(calcCpm, 3000);
    return () => clearInterval(interval);
  }, [messages, peakCpm]);

  // ── 분석마다 타임라인 1포인트 ──────────────────────────────────────────────
  useEffect(() => {
    if (!analysis) return;
    // metric id가 아니라 태그에서 파생한다 — 모델이 id를 매번 다르게 지어내므로
    // metrics에 의존하면 타임라인이 조용히 0으로 눕는다 (deriveStats 주석 참조)
    const d = deriveStats(analysis);
    const point: TalkTimelinePoint = {
      t: Date.now(),
      cpm: cpmRef.current,
      rallyHeat: d.rallyHeat,
      disputeLevel: d.disputeLevel,
      unansweredCount: analysis.unanswered?.length ?? 0,
      riskCount: d.riskCount,
      supportCount: d.supportSignal,
    };
    setTimeline((prev) => {
      const next = [...prev, point];
      return next.length > TIMELINE_CAP ? next.slice(-TIMELINE_CAP) : next;
    });
  }, [analysis]);

  // ── ref 동기화 ─────────────────────────────────────────────────────────────
  useEffect(() => { messagesCountRef.current = messages.length; }, [messages.length]);
  useEffect(() => { isAnalyzingRef.current = isAnalyzing; }, [isAnalyzing]);
  useEffect(() => { issuesRef.current = issues; }, [issues]);
  useEffect(() => { runAIAnalysisRef.current = runAIAnalysis; });

  // ── 40초 자동 분석 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPolling || !autoAnalysisEnabled) return;

    const tryInitial = () => {
      if (messagesCountRef.current > 0 && !isAnalyzingRef.current) runAIAnalysisRef.current();
    };
    const initialTimer = setTimeout(tryInitial, 1500);

    const id = setInterval(() => {
      const newCount = messagesCountRef.current - lastAnalyzedCountRef.current;
      if (newCount >= 5 && !isAnalyzingRef.current) runAIAnalysisRef.current();
    }, 40000);
    autoAnalyzeTimerRef.current = id;

    return () => {
      clearTimeout(initialTimer);
      clearInterval(id);
      autoAnalyzeTimerRef.current = null;
    };
  }, [isPolling, autoAnalysisEnabled]);

  useEffect(() => () => { stopCommentStream(); }, []);

  // ── 크로스세션 히스토리 로드 ───────────────────────────────────────────────
  // 회차 기록은 부가 기능이다 — 실패해도 방송 진행을 막지 않고 조용히 넘어간다.
  const loadSessionHistory = async (currentId?: string) => {
    try {
      const q = currentId ? `?currentId=${encodeURIComponent(currentId)}` : '';
      const res = await fetch(`/api/sessions/history${q}`);
      const data = await res.json();
      if (!data.success) return;
      setComparison(data.comparison ?? null);
      setAgendaTrends(data.agendaTrends ?? []);
      setReturningStats(data.returning ?? null);
      setCarryOver(data.carryOver ?? []);
      setSessionStoreKind(data.store ?? null);
      setRetentionDays(data.retentionDays ?? null);
    } catch {
      // 저장소가 없거나 접근 불가 — 패널은 빈 상태로 남는다
    }
  };

  useEffect(() => { loadSessionHistory(); }, []);

  // ── 스트림 연결 ────────────────────────────────────────────────────────────
  const handleConnectStream = async (demoParam = false) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoadingInfo(true);
    stopCommentStream();
    setMessages([]);
    setPeakCpm(0);
    setCpm(0);
    setAnalysis(null);
    setL1(null);
    setReport(null);
    setResolvedRequestIds(new Set());
    setResolvedRiskIds(new Set());
    setTimeline([]);
    prevCpmRef.current = 0;

    const targetUrl = demoParam ? 'demo' : urlInput.trim();
    if (!targetUrl) {
      setErrorMsg('유튜브 라이브 영상 URL을 입력해주세요.');
      setIsLoadingInfo(false);
      return;
    }

    try {
      const response = await fetch(`/api/youtube/info?url=${encodeURIComponent(targetUrl)}`);
      const result = await response.json();

      if (!result.success) {
        setErrorMsg(result.error || '유튜브 스트림 연결에 실패했습니다.');
        setIsLoadingInfo(false);
        return;
      }

      setStreamInfo({
        videoId: result.videoId,
        activeLiveChatId: result.activeLiveChatId,
        title: result.title,
        channelName: result.channelName,
        thumbnailUrl: result.thumbnailUrl,
        isDemo: result.isDemo,
        publishedAt: result.publishedAt,
      });
      setSuccessMsg(`🚀 "${result.title}"에 연결되었습니다.`);

      // 회차 id를 확정한다. 같은 방송을 재연결하면 같은 회차로 갱신되도록
      // videoId + 날짜를 쓴다 (데모는 매번 같은 videoId라 날짜로 구분된다).
      sessionIdRef.current = `${result.videoId}-${new Date().toISOString().slice(0, 10)}`;
      sessionStartRef.current = new Date().toISOString();

      if (result.activeLiveChatId) startCommentStream(result.activeLiveChatId);
      else setErrorMsg('현재 라이브 중이 아니거나 채팅이 활성화되어 있지 않습니다.');
    } catch (err: any) {
      setErrorMsg(`스트림 정보를 가져오는 중 실패했습니다: ${err.message}`);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const startCommentStream = (chatId: string) => {
    isPollingRef.current = true;
    setIsPolling(true);
    let currentToken: string | null = null;

    const pullBatch = async () => {
      try {
        const pageTokenQuery = currentToken ? `&nextPageToken=${currentToken}` : '';
        const response = await fetch(`/api/youtube/chat?liveChatId=${chatId}${pageTokenQuery}`);
        const result = await response.json();

        if (!result.success) {
          console.error('Fetch comments error:', result.error);
          return;
        }

        const newItems: ChatMessage[] = result.items || [];
        if (newItems.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            return [...prev, ...newItems.filter((m) => !existingIds.has(m.id))];
          });
        }

        currentToken = result.nextPageToken || null;
        if (result.pollingIntervalMillis) pollingRateRef.current = result.pollingIntervalMillis;
      } catch (e) {
        console.error('Polling tick failure:', e);
      } finally {
        if (isPollingRef.current) {
          pollingTimerRef.current = setTimeout(pullBatch, pollingRateRef.current);
        }
      }
    };

    pullBatch();
  };

  const stopCommentStream = () => {
    isPollingRef.current = false;
    setIsPolling(false);
    if (pollingTimerRef.current) { clearTimeout(pollingTimerRef.current); pollingTimerRef.current = null; }
    if (autoAnalyzeTimerRef.current) { clearInterval(autoAnalyzeTimerRef.current); autoAnalyzeTimerRef.current = null; }
  };

  // ── AI 분석 ────────────────────────────────────────────────────────────────
  const runAIAnalysis = async () => {
    if (isAnalyzing || messages.length === 0) return;
    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      lastAnalyzedCountRef.current = messages.length;

      // 고정 건수가 아니라 시간 윈도우로 자른다 — 고CPM에서도 분석 주기를 덮는다
      const cutoff = Date.now() - ANALYZE_WINDOW_MS;
      const windowed = messages.filter((m) => new Date(m.timestamp).getTime() >= cutoff);
      const payloadMessages = windowed.length > 0 ? windowed : messages.slice(-200);

      const res = await fetch('/api/analyze/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          streamTitle: streamInfo?.title || '정치·시사 라이브',
          issues: issuesRef.current,
          previousCpm: prevCpmRef.current,
        }),
      });

      const result = await res.json();
      if (result.success && result.analysis) {
        setAnalysis(result.analysis);
        if (result.l1) setL1(result.l1);
        prevCpmRef.current = cpmRef.current;
        if (result.errorInfo) setErrorMsg(result.errorInfo);
      } else {
        setErrorMsg('AI 채팅 분석 중 문제가 발생했습니다.');
      }
    } catch (err: any) {
      setErrorMsg(`AI 분석 통신 실패: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── 종료 리포트 ────────────────────────────────────────────────────────────
  const handleGenerateReport = async () => {
    if (messages.length === 0) {
      setErrorMsg('분석할 채팅 데이터가 없습니다. 먼저 라이브에 연결하거나 데모를 실행하세요.');
      return;
    }
    setIsGeneratingReport(true);
    setReport(null);
    setShowReportModal(true);

    try {
      // 상한 초과 시 앞을 자르지 않고 전 구간에서 균등 추출한다.
      // 앞에서 자르면 긴 방송의 도입부만 남아 리포트가 방송을 대표하지 못한다.
      let payloadMessages = messages;
      if (messages.length > REPORT_PAYLOAD_CAP) {
        const stride = Math.ceil(messages.length / REPORT_PAYLOAD_CAP);
        payloadMessages = messages.filter((_, i) => i % stride === 0);
      }

      const res = await fetch('/api/report/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          streamTitle: streamInfo?.title || 'LiveChat Radar 정치·시사 라이브',
          peakCpm,
          issues: issuesRef.current,
        }),
      });

      const result = await res.json();
      if (result.success && result.report) {
        setReport(result.report);
        // 리포트가 나오면 이 회차를 기록한다 — 다음 방송의 비교 기준이 된다 (P-11)
        void saveSession(result.report);
      } else {
        setErrorMsg(result.error || '종료 리포트 생성에 실패했습니다.');
      }
    } catch (err: any) {
      setErrorMsg(`종료 리포트 생성 중 예외 발생: ${err.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  /**
   * 회차 저장 (P-11).
   *
   * 서버에 넘기는 것은 집계치 + **닉네임 목록**이며, 서버가 해시로 변환해 저장한다 (D-8).
   * 원문 닉네임이 영속 저장되지 않도록 해싱은 서버에서만 한다 — 클라이언트가 해시를
   * 만들면 salt가 브라우저에 노출된다.
   */
  const saveSession = async (finalReport: TalkReportResult) => {
    const id = sessionIdRef.current;
    if (!id) return;

    const avgHeat =
      timeline.length > 0
        ? timeline.reduce((s, p) => s + p.rallyHeat, 0) / timeline.length
        : 0;

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: streamInfo?.title || '정치·시사 라이브',
          startedAt: sessionStartRef.current || new Date().toISOString(),
          endedAt: new Date().toISOString(),
          analysis,
          report: finalReport,
          timelineAvgHeat: avgHeat,
          peakCpm,
          authors: [...new Set(messages.map((m) => m.author).filter(Boolean))],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`이 회차를 기록했습니다 (참여자 ${data.saved.participantCount}명).`);
        await loadSessionHistory(id);
      }
    } catch {
      // 저장 실패는 방송 진행과 무관하다 — 조용히 넘어간다
    }
  };

  const handleCopy = (text: string, elementId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(elementId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSetActiveIssue = (id: string) => {
    setIssues((prev) => prev.map((i) => ({ ...i, isActive: i.id === id ? !i.isActive : false })));
  };

  // ── 파생 ───────────────────────────────────────────────────────────────────
  const visibleRisks = useMemo(
    () => (analysis?.riskAlerts ?? []).filter((r) => !resolvedRiskIds.has(r.id)),
    [analysis, resolvedRiskIds],
  );

  // 렌더는 최근 N건만 — 전량 렌더는 고CPM에서 브라우저를 멈춘다
  const renderedMessages = useMemo(() => messages.slice(-FEED_RENDER_CAP), [messages]);

  // P-8: 시청자·참여 파생 (신규 AI 호출 없음, analyses에서 계산)
  const supporters = useMemo(
    () => buildSupporterProfiles(analysis?.analyses ?? [], analysis?.unanswered ?? [], messages),
    [analysis, messages],
  );
  const supporterSummary = useMemo(() => summarizeSupporters(supporters), [supporters]);
  const funnel = useMemo(() => buildParticipationFunnel(supporters), [supporters]);
  const appeal = useMemo(() => detectAppealWindow(analysis, timeline), [analysis, timeline]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
      {/* ── 헤더 ── */}
      <header className="border-b border-slate-800 bg-slate-950/60 sticky top-0 z-30 backdrop-blur">
        <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center">
              <Activity size={16} className="text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-[13px] font-extrabold text-slate-100">LiveChat Radar</h1>
              <p className="text-[9px] text-slate-500">정치·시사 라이브 AI 진행 조연출</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnectStream()}
                placeholder="유튜브 라이브 URL 또는 'demo'"
                className="w-full bg-slate-900/70 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-[11px] focus:outline-none focus:border-cyan-500/50 font-sans"
              />
            </div>
            <button
              onClick={() => handleConnectStream()}
              disabled={isLoadingInfo}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-[11px] text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50 flex items-center gap-1 shrink-0"
            >
              {isLoadingInfo ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
              연결
            </button>
            <button
              onClick={() => handleConnectStream(true)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> 데모
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isPolling ? (
              <button onClick={stopCommentStream} className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 text-[11px] text-amber-300 flex items-center gap-1">
                <Pause size={12} /> 중단
              </button>
            ) : (
              streamInfo?.activeLiveChatId && (
                <button onClick={() => startCommentStream(streamInfo.activeLiveChatId!)} className="px-2.5 py-1.5 rounded-lg border border-emerald-500/40 text-[11px] text-emerald-300 flex items-center gap-1">
                  <Play size={12} /> 재개
                </button>
              )
            )}
            <button
              onClick={runAIAnalysis}
              disabled={isAnalyzing || messages.length === 0}
              className="px-2.5 py-1.5 rounded-lg border border-indigo-500/40 text-[11px] text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40 flex items-center gap-1"
            >
              {isAnalyzing ? <RotateCw size={12} className="animate-spin" /> : <Bot size={12} />} 분석
            </button>
            <button
              onClick={handleGenerateReport}
              disabled={messages.length === 0}
              className="px-2.5 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40 flex items-center gap-1"
            >
              <FileText size={12} /> 리포트
            </button>
          </div>
        </div>
      </header>

      <main className="p-3 space-y-3">
        {/* 알림 */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-400 shrink-0" />
            <span className="text-[11px] text-rose-200">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle size={15} className="text-emerald-400 shrink-0" />
            <span className="text-[11px] text-emerald-200">{successMsg}</span>
          </div>
        )}

        {/* 리스크 배너 — 임계 초과 시에만 (P-6) */}
        <RiskBanner alerts={visibleRisks} />

        {/* 큐시트 바 */}
        <IssueBar issues={issues} onOpenModal={() => setShowIssueModal(true)} onSetActive={handleSetActiveIssue} />

        {/* KPI */}
        <TalkKpiStrip metrics={analysis?.metrics ?? []} />

        {/* L1 상태 줄 — AI 응답 없이도 채팅 규모를 보여준다 */}
        {l1 && (
          <div className="flex items-center gap-3 flex-wrap px-3 py-1.5 bg-slate-900/40 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1"><Gauge size={11} className="text-cyan-400" />CPM {l1.cpm}{l1.spike && <span className="text-amber-400">急</span>}</span>
            <span className="flex items-center gap-1"><Users size={11} className="text-violet-400" />{l1.authorCount}명</span>
            <span>수집 {l1.total} / 고유 {l1.unique} (중복 {l1.dedupeRate}%)</span>
            <span className="text-rose-400">리스크 후보 {l1.riskCandidates}</span>
            <span className="text-emerald-400">요구 후보 {l1.requestCandidates}</span>
            {l1.brigading > 0 && <span className="text-amber-400">도배 신호 {l1.brigading}</span>}
          </div>
        )}

        {/* 본문 — flex (grid는 Recharts 폭 붕괴를 유발했던 이력이 있다) */}
        <div className="flex flex-col lg:flex-row gap-3">
          {/* 좌 */}
          <div className="flex-1 min-w-0 space-y-3">
            <TalkActionCards cards={analysis?.actionCards ?? []} onCopy={handleCopy} copiedId={copiedId} />
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 min-w-0"><AgendaRadar items={analysis?.agendaInterest ?? []} /></div>
              <div className="flex-1 min-w-0"><AxisDistribution analyses={analysis?.analyses ?? []} /></div>
            </div>

            {/* 참여 퍼널 + 어필 윈도우 (P-8) */}
            <ParticipationPanel funnel={funnel} appeal={appeal} onCopy={handleCopy} copiedId={copiedId} />

            {/* 시간축 추이 (P-9) */}
            <TalkTimelineDashboard points={timeline} />

            {/* 진행 조언 */}
            {analysis?.hostAdvice && (
              <section className="bg-slate-900/60 border border-cyan-500/20 rounded-xl p-3">
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">진행 조언</h2>
                <p className="text-[12px] text-cyan-200 leading-snug">{analysis.hostAdvice}</p>
                {analysis.recentSummary && (
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-snug">{analysis.recentSummary}</p>
                )}
              </section>
            )}
          </div>

          {/* 우 */}
          <div className="w-full lg:w-[340px] shrink-0 space-y-3">
            {/* 리스크 워치가 최상단 — 채널 방어가 이 제품의 킬러 기능 (P-6) */}
            <RiskWatchPanel
              alerts={analysis?.riskAlerts ?? []}
              resolvedIds={resolvedRiskIds}
              onResolve={(id) => setResolvedRiskIds((prev) => new Set(prev).add(id))}
            />
            <UnansweredQueue
              items={analysis?.unanswered ?? []}
              resolvedIds={resolvedRequestIds}
              onResolve={(id) => setResolvedRequestIds((prev) => new Set(prev).add(id))}
            />

            {/* 후원·충성 보드 (P-8) — 비민감 축만 표시 (D-1/D-2) */}
            <SupporterBoard profiles={supporters} summary={supporterSummary} />

            {/* 회차 비교 · 아젠다 수명 · 단골 누적 (P-11) */}
            <SessionHistoryPanel
              comparison={comparison}
              agendaTrends={agendaTrends}
              returning={returningStats}
              carryOver={carryOver}
              store={sessionStoreKind}
              retentionDays={retentionDays}
            />

            {/* 라이브 피드 */}
            <section className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <header className="px-3 py-2.5 border-b border-slate-800 flex items-center gap-1.5">
                <MessageSquare size={15} className="text-slate-400 shrink-0" />
                <h2 className="text-[11px] font-bold text-slate-200">라이브 피드</h2>
                <span className="ml-auto text-[10px] font-mono text-slate-500">
                  {messages.length > FEED_RENDER_CAP ? `최근 ${FEED_RENDER_CAP} / ${messages.length}` : messages.length}
                </span>
                <button
                  onClick={() => setChatAutoScroll((v) => !v)}
                  className={`text-[9px] px-1.5 py-0.5 rounded border ${chatAutoScroll ? 'border-cyan-500/40 text-cyan-300' : 'border-slate-700 text-slate-500'}`}
                >
                  자동
                </button>
              </header>
              <div ref={chatListRef} className="h-64 overflow-y-auto p-2.5 space-y-1.5 font-mono text-[11px]">
                {renderedMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 gap-2">
                    <MessageSquare size={28} className="text-slate-800" />
                    <p className="text-[11px] italic">라이브에 연결하면 채팅이 표시됩니다.</p>
                  </div>
                ) : (
                  renderedMessages.map((m) => (
                    <div key={m.id} className="leading-snug break-words">
                      <span className={m.isSponsor ? 'text-violet-400' : m.isModerator ? 'text-emerald-400' : 'text-slate-500'}>
                        {m.author}
                      </span>
                      <span className="text-slate-600">: </span>
                      <span className="text-slate-300">{m.message}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* 큐시트 모달 */}
      {showIssueModal && (
        <IssueRegisterModal
          issues={issues}
          onClose={() => setShowIssueModal(false)}
          onSave={(next) => { setIssues(next); setSuccessMsg('큐시트를 저장했습니다.'); }}
        />
      )}

      {/* 리포트 모달 */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#020617] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100">방송 종료 리포트</h2>
              <button onClick={() => setShowReportModal(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4">
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
                  <RotateCw size={22} className="animate-spin text-cyan-400" />
                  <p className="text-[11px]">리포트를 생성하고 있습니다…</p>
                </div>
              ) : report ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    {[
                      ['총 댓글', report.summaryStats.totalMessages],
                      ['피크 CPM', report.summaryStats.peakCpm],
                      ['후원 신호', report.summaryStats.supportCount],
                      ['리스크', report.summaryStats.riskCount],
                      ['미응답', report.summaryStats.unansweredCount],
                      ['응답률', `${report.summaryStats.answerRate}%`],
                      ['최다 아젠다', report.summaryStats.topAgenda],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
                        <div className="text-sm font-bold font-mono text-slate-200 truncate">{value}</div>
                      </div>
                    ))}
                  </div>
                  <pre className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                    {report.reportMarkdown}
                  </pre>
                </>
              ) : (
                <p className="text-center text-slate-600 text-[11px] py-12">리포트를 불러오지 못했습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
