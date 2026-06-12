/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Sparkles, 
  TrendingUp, 
  Bot, 
  Video, 
  AlertTriangle, 
  CreditCard, 
  MessageSquare, 
  Clock, 
  Activity, 
  RotateCw, 
  Users, 
  Volume2, 
  CheckCircle, 
  BarChart2, 
  FileText, 
  X, 
  ExternalLink, 
  Copy,
  AlertCircle,
  Play,
  Pause,
  Award
} from 'lucide-react';
import {
  ChatMessage,
  StreamInfo,
  AnalysisResult,
  ReportResult,
  CpmPoint,
  SentimentSnapshot,
  CategorySnapshot,
} from './types';
import { TimelineDashboard } from './components/TimelineDashboard';
import { liveModes } from './config/liveModes';
import { ModeDashboard } from './components/ModeDashboard';
import { ModeSelector } from './components/ModeSelector';
import { LiveModeId } from './types/liveRadar';

// B-4 Timeline 캐핑 — 메모리/렌더 비용 vs 추이 가시성 균형
const CPM_HISTORY_CAP = 120;        // 3초 × 120 = ~6분
const ANALYSIS_HISTORY_CAP = 40;    // 분석 cadence ~40초 × 40 = ~27분

export default function App() {
  // Input URL / Current stream status
  const [urlInput, setUrlInput] = useState<string>('https://www.youtube.com/live/demo');
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState<boolean>(false);
  
  // Real-time comments
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [pollingRate, setPollingRate] = useState<number>(3500); // Poll rate in milliseconds

  // CPM tracking variables
  const [cpm, setCpm] = useState<number>(0);
  const [peakCpm, setPeakCpm] = useState<number>(0);
  
  // AI analysis outcomes
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [autoAnalysisEnabled, setAutoAnalysisEnabled] = useState<boolean>(true);
  const [selectedLiveMode, setSelectedLiveMode] = useState<LiveModeId>('commerce');
  
  // Post-stream report
  const [report, setReport] = useState<ReportResult | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // Status & notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Refs for timers & message feed autoscroll
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAnalyzeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const lastAnalyzedCountRef = useRef<number>(0);
  // Mirror of isPolling state. setState updates are async, so the closure
  // captured by pullBatch sees the stale initial false. Use ref for the
  // re-enqueue guard so polling actually continues after the first batch.
  const isPollingRef = useRef<boolean>(false);
  // Same reason: pollingRate updates need to be visible to the running loop.
  const pollingRateRef = useRef<number>(3000);
  // Mirrors for the 40s auto-analyze interval callback: must see the latest
  // message count, analyzing state, and runAIAnalysis closure without
  // re-creating the interval on every render.
  const messagesCountRef = useRef<number>(0);
  const isAnalyzingRef = useRef<boolean>(false);
  const runAIAnalysisRef = useRef<() => void>(() => {});

  // Track chat feed height scroll behavior
  const [chatAutoScroll, setChatAutoScroll] = useState<boolean>(true);

  // B-4: 시간축 분석 차트용 누적 시계열
  const [cpmHistory, setCpmHistory] = useState<CpmPoint[]>([]);
  const [sentimentHistory, setSentimentHistory] = useState<SentimentSnapshot[]>([]);
  const [categoryHistory, setCategoryHistory] = useState<CategorySnapshot[]>([]);

  // Clean local error notification after 5 seconds
  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  // Clean success message
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setCopiedId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // Handle Autoscroll on messages change
  useEffect(() => {
    if (chatAutoScroll && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatAutoScroll]);

  // 1. Calculate CPM (Comments Per Minute) based on timestamps of the last minute
  useEffect(() => {
    const calcCpm = () => {
      if (messages.length === 0) return;
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      
      const recentCount = messages.filter(m => {
        const t = new Date(m.timestamp).getTime();
        return t >= oneMinuteAgo;
      }).length;

      setCpm(recentCount);
      if (recentCount > peakCpm) {
        setPeakCpm(recentCount);
      }
      // B-4: CPM 시계열 누적 (캐핑된 슬라이딩 윈도우)
      setCpmHistory(prev => {
        const next = [...prev, { t: now, cpm: recentCount }];
        return next.length > CPM_HISTORY_CAP ? next.slice(-CPM_HISTORY_CAP) : next;
      });
    };

    const interval = setInterval(calcCpm, 3000);
    return () => clearInterval(interval);
  }, [messages, peakCpm]);

  // B-4: analysis 갱신 시 sentiment + category 시계열에 push
  useEffect(() => {
    if (!analysis) return;
    const now = Date.now();
    setSentimentHistory(prev => {
      const next = [...prev, {
        t: now,
        positive: analysis.sentiment?.positive ?? 0,
        neutral: analysis.sentiment?.neutral ?? 0,
        negative: analysis.sentiment?.negative ?? 0,
      }];
      return next.length > ANALYSIS_HISTORY_CAP ? next.slice(-ANALYSIS_HISTORY_CAP) : next;
    });
    const cats = (analysis.specialComments ?? []).reduce(
      (acc, c) => {
        if (c.category === 'purchase_signal') acc.purchase_signal++;
        else if (c.category === 'stream_issue') acc.stream_issue++;
        else if (c.category === 'complaint') acc.complaint++;
        return acc;
      },
      { purchase_signal: 0, stream_issue: 0, complaint: 0 },
    );
    setCategoryHistory(prev => {
      const next = [...prev, { t: now, ...cats }];
      return next.length > ANALYSIS_HISTORY_CAP ? next.slice(-ANALYSIS_HISTORY_CAP) : next;
    });
  }, [analysis]);

  // Keep refs in sync with state so the 40s interval can read latest values.
  useEffect(() => { messagesCountRef.current = messages.length; }, [messages.length]);
  useEffect(() => { isAnalyzingRef.current = isAnalyzing; }, [isAnalyzing]);
  useEffect(() => { runAIAnalysisRef.current = runAIAnalysis; });

  // 2. Automated AI Analysis trigger periodically (Every 40 seconds if new comments exist)
  // deps intentionally only on (isPolling, autoAnalysisEnabled) so the 40s
  // interval is registered once per session and is NOT reset every time a new
  // comment arrives. The interval callback reads messagesCountRef /
  // isAnalyzingRef / runAIAnalysisRef to always see the latest values.
  useEffect(() => {
    if (!isPolling || !autoAnalysisEnabled) return;

    // Fire an initial analysis as soon as enough messages have buffered.
    const tryInitial = () => {
      if (messagesCountRef.current > 0 && !isAnalyzingRef.current) {
        runAIAnalysisRef.current();
      }
    };
    // Wait one tick to let the first message batch land before initial fire.
    const initialTimer = setTimeout(tryInitial, 1500);

    const id = setInterval(() => {
      const newCount = messagesCountRef.current - lastAnalyzedCountRef.current;
      if (newCount >= 5 && !isAnalyzingRef.current) {
        runAIAnalysisRef.current();
      }
    }, 40000);
    autoAnalyzeTimerRef.current = id;

    return () => {
      clearTimeout(initialTimer);
      clearInterval(id);
      autoAnalyzeTimerRef.current = null;
    };
  }, [isPolling, autoAnalysisEnabled]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopCommentStream();
    };
  }, []);

  // Connect & Fetch YouTube Live Chat Stream details
  const handleConnectStream = async (demoParam = false) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoadingInfo(true);
    stopCommentStream();
    setMessages([]);
    setNextPageToken(null);
    setPeakCpm(0);
    setCpm(0);
    setAnalysis(null);
    setReport(null);
    // B-4: 새 stream 연결 시 timeline 초기화
    setCpmHistory([]);
    setSentimentHistory([]);
    setCategoryHistory([]);

    // Prepare actual URL or Demo target
    const targetUrl = demoParam ? 'demo' : urlInput.trim();
    if (!targetUrl) {
      setErrorMsg('유튜브 채널 또는 라이브 영상 URL을 올바르게 입력해주세요.');
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
        publishedAt: result.publishedAt
      });

      // Show connected notification toast
      setSuccessMsg(`🚀 "${result.title}"에 연결되었습니다!`);

      // Start pulling real-time comments if activeLiveChatId exists
      if (result.activeLiveChatId) {
        startCommentStream(result.activeLiveChatId);
      } else {
        setErrorMsg('현재 라이브 중이 아니거나 채팅이 활성화되어 있지 않습니다.');
      }
    } catch (err: any) {
      setErrorMsg(`스트림 정보를 가져오는 중에 실패했습니다: ${err.message}`);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  // Start the polling cycle for live chats
  const startCommentStream = (chatId: string) => {
    isPollingRef.current = true;
    setIsPolling(true);
    let currentToken: string | null = null;

    const pullBatch = async () => {
      try {
        const pageTokenQuery = currentToken ? `&nextPageToken=${currentToken}` : '';
        const fetchUrl = `/api/youtube/chat?liveChatId=${chatId}${pageTokenQuery}`;
        const response = await fetch(fetchUrl);
        const result = await response.json();

        if (!result.success) {
          console.error('Fetch comments error:', result.error);
          return;
        }

        const newItems: ChatMessage[] = result.items || [];
        if (newItems.length > 0) {
          setMessages(prev => {
            // Guarantee deduplication using unique Message IDs
            const existingIds = new Set(prev.map(m => m.id));
            const filteredNew = newItems.filter(m => !existingIds.has(m.id));
            
            // Map visual filters (Frontend helper tags logic before AI analysis executes)
            const typedNew = filteredNew.map(m => {
              const text = m.message;
              let cat: ChatMessage['category'] = null;
              let reason = '';

              if (text.includes('소리') || text.includes('마이크') || text.includes('끊김') || text.includes('멈춤') || text.includes('랙')) {
                cat = 'stream_issue';
                reason = '송출 품질 불균형 피드백 감지';
              } else if (text.includes('정말 사고') || text.includes('구매') || text.includes('얼마') || text.includes('할인') || text.includes('가격') || text.includes('결제')) {
                cat = 'purchase_signal';
                reason = '실시간 구매 및 혜택 전환 정보 매핑';
              } else if (text.includes('답답') || text.includes('불만') || text.includes('화나') || text.includes('별로')) {
                cat = 'complaint';
                reason = '시청자 불만 호소 피드백 감지';
              }

              return {
                ...m,
                category: cat,
                reason
              };
            });

            return [...prev, ...typedNew];
          });
        }

        // Save current pages
        currentToken = result.nextPageToken || null;
        setNextPageToken(currentToken);

        // Adjust rate according to YouTube API recommendations
        if (result.pollingIntervalMillis) {
          pollingRateRef.current = result.pollingIntervalMillis;
          setPollingRate(result.pollingIntervalMillis);
        }
      } catch (e) {
        console.error('Polling tick failure:', e);
      } finally {
        // Enqueue next loop iteration. Use ref to avoid stale-closure isPolling.
        if (isPollingRef.current) {
          pollingTimerRef.current = setTimeout(pullBatch, pollingRateRef.current);
        }
      }
    };

    // First instant pull
    pullBatch();
  };

  const stopCommentStream = () => {
    isPollingRef.current = false;
    setIsPolling(false);
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (autoAnalyzeTimerRef.current) {
      clearInterval(autoAnalyzeTimerRef.current);
      autoAnalyzeTimerRef.current = null;
    }
  };

  // Trigger OpenAI Analysis payload
  const runAIAnalysis = async () => {
    if (isAnalyzing || messages.length === 0) return;
    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      lastAnalyzedCountRef.current = messages.length;
      
      const payload = {
        messages: messages.slice(-80), // analyze dynamic window of last 80 messages for high accuracy
        streamTitle: streamInfo?.title || '라이브 방송'
      };

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success && result.analysis) {
        setAnalysis(result.analysis);
      } else {
        setErrorMsg('AI 댓글 분석 데이터를 수집하는 도중 아쉬운 문제가 발생했습니다.');
      }
    } catch (err: any) {
      setErrorMsg(`AI 분석 통신 실패: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Create End-of-Stream comprehensive summary report
  const handleGenerateReport = async () => {
    if (messages.length === 0) {
      setErrorMsg('분석할 시청자 댓글 데이터가 부족합니다. 먼저 라이브를 연동하거나 데모를 작동하세요.');
      return;
    }
    setIsGeneratingReport(true);
    setReport(null);
    setShowReportModal(true);

    try {
      const payload = {
        messages: messages,
        streamTitle: streamInfo?.title || 'LiveChat Radar 분석 방송',
        peakCpm: peakCpm
      };

      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success && result.report) {
        setReport(result.report);
      } else {
        setErrorMsg(result.error || '방송 종료 마크다운 리포트를 구성하는 도중 거부되었습니다.');
      }
    } catch (err: any) {
      setErrorMsg(`종료 리포트 생성 중 예외 발생: ${err.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Helper routine to ease copy-to-clipboard on template presenter feedback
  const handleCopyToClipboard = (text: string, elementId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(elementId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Count localized categorized flags manually for statistics indicator
  const totalPurchaseSignals = messages.filter(m => m.category === 'purchase_signal').length;
  const totalStreamIssues = messages.filter(m => m.category === 'stream_issue').length;
  const totalComplaints = messages.filter(m => m.category === 'complaint').length;

  return (
    <div className="flex flex-col min-h-screen bg-[#020617] text-slate-200 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Header Bar */}
      <header className="h-16 shrink-0 border-b border-[rgba(56,189,248,0.15)] bg-slate-950/60 backdrop-blur-md flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-cyan-600/90 rounded-lg flex items-center justify-center border border-cyan-400/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Activity size={20} className="text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tighter text-white">
                LiveChat Radar
              </h1>
              <span className="mono text-[10px] bg-cyan-950 text-cyan-400 px-1.5 py-0.2 border border-cyan-800/60 rounded">
                v1.1-MVP
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-sans">실시간 AI 스트림 조연출 및 댓글 행동 제안 솔루션</p>
          </div>
        </div>

        {/* Dynamic connection indicator */}
        <div className="hidden md:flex items-center gap-4 text-xs font-mono">
          {streamInfo ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-emerald-500/20 px-3 py-1.5 rounded-lg shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute"></span>
              <span className="text-emerald-400 font-bold ml-1.5 uppercase tracking-wide">
                [ {streamInfo.isDemo ? 'DEMO-LIVE' : 'CONNECTED'} ]
              </span>
              <span className="text-slate-400 max-w-[200px] truncate">
                {streamInfo.title}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-900/40 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-600"></span>
              <span>방송 스트림 대기 상태</span>
            </div>
          )}
        </div>
      </header>

      {/* Control panel & URL Connector banner */}
      <div className="px-6 py-3.5 bg-slate-900/60 border-b border-[rgba(56,189,248,0.1)] flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-1 min-w-[280px] max-w-3xl items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
              <Search size={15} />
            </span>
            <input 
              type="text" 
              placeholder="유튜브 라이브 비디오 URL 혹은 'demo' 입력..." 
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-slate-950/90 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-cyan-500 rounded-lg text-xs leading-relaxed py-2.5 pl-10 pr-4 text-slate-300 placeholder-slate-600 font-mono transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              id="connect_stream_btn"
              onClick={() => handleConnectStream(false)}
              disabled={isLoadingInfo}
              className="bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-slate-800 disabled:text-slate-500 text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center gap-2"
            >
              {isLoadingInfo ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
              연동하기
            </button>
            
            <button 
              id="demo_stream_btn"
              onClick={() => handleConnectStream(true)}
              className="bg-purple-950/40 border border-purple-800/80 hover:bg-purple-900/60 text-purple-300 text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center gap-1.5"
              title="YouTube API 키 없이 간편하게 작동 테스트하는 시뮬레이션 모드"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              데모 모드
            </button>
          </div>
        </div>

        {/* Polling / Manual trigger Controls */}
        <div className="flex items-center gap-3">
          {isPolling && (
            <div className="flex items-center gap-2">
              <button
                id="toggle_poll_btn"
                onClick={stopCommentStream}
                className="bg-rose-950/20 text-rose-400 hover:bg-rose-900/20 border border-rose-900/50 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="댓글 수집 일시정지"
              >
                <Pause size={12} />일시 중단
              </button>
              
              <button
                id="instant_analyze_btn"
                onClick={runAIAnalysis}
                disabled={isAnalyzing || messages.length === 0}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                title="수집된 댓글 기반으로 OpenAI 리스닝 분석 즉시 실행"
              >
                {isAnalyzing ? <RotateCw size={12} className="animate-spin" /> : <Bot size={12} />}
                실시간 AI 재분석
              </button>
            </div>
          )}

          {/* Toggle Auto checkbox */}
          <label className="flex items-center gap-2 text-xs font-sans text-slate-400 cursor-pointer select-none">
            <input 
              type="checkbox"
              checked={autoAnalysisEnabled}
              onChange={() => setAutoAnalysisEnabled(!autoAnalysisEnabled)}
              className="rounded border-slate-800 bg-slate-950 text-cyan-600 focus:ring-0"
            />
            <span>40초 마다 AI 자동 분석 요약</span>
          </label>
        </div>
      </div>

      <ModeSelector
        modes={liveModes}
        selectedMode={selectedLiveMode}
        onSelect={setSelectedLiveMode}
      />

      <ModeDashboard
        mode={selectedLiveMode}
        liveComments={messages.map((message) => message.message)}
        onCopy={handleCopyToClipboard}
        copiedId={copiedId}
      />

      {/* Warning/Success Toast feedback */}
      {errorMsg && (
        <div className="bg-red-950/90 border-b border-red-500/40 text-red-100 text-xs px-6 py-2.5 flex items-center gap-2.5 font-sans animate-fadeIn">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-100 text-xs px-6 py-2.5 flex items-center gap-2.5 font-sans animate-fadeIn">
          <CheckCircle size={15} className="text-emerald-400 shrink-0" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* MAIN LAYOUT GRID */}
      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden max-h-[calc(100vh-125px)]">
        
        {/* LEFT PANEL: Live Comments Stream feed (col-span-3) */}
        <section className="lg:basis-1/4 lg:flex-1 min-w-0 bg-slate-950/80 border border-[rgba(56,189,248,0.15)] rounded-xl flex flex-col overflow-hidden max-h-full">
          <div className="px-4 py-3 bg-slate-900/40 border-b border-[rgba(56,189,248,0.15)] flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">Live Chat Feed</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono uppercase">
                {messages.length} 수집됨
              </span>
              <button 
                onClick={() => setChatAutoScroll(!chatAutoScroll)}
                className={`text-[9px] px-1.5 py-0.5 rounded transition-all font-mono uppercase ${chatAutoScroll ? 'bg-cyan-950/60 border border-cyan-800 text-cyan-400' : 'bg-slate-800 text-slate-500 border border-transparent'}`}
                title="가장 최신 댓글이 아래에 보일 수 있도록 자동 스크롤 동기화"
              >
                {chatAutoScroll ? 'SCROLL: ON' : 'SCROLL: OFF'}
              </button>
            </div>
          </div>

          {/* Custom stream metadata (if connected) */}
          {streamInfo && (
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-3 shrink-0">
              <img 
                src={streamInfo.thumbnailUrl} 
                alt="Thumbnail" 
                className="w-12 h-9 object-cover rounded border border-slate-700 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-200 truncate leading-snug">{streamInfo.title}</p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">CH: {streamInfo.channelName}</p>
              </div>
            </div>
          )}

          {/* Chat Messages Scrolling wrapper */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-[11px]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 py-12 px-4 space-y-3">
                <MessageSquare size={32} className="text-slate-800 pointer-events-none" />
                <p className="max-w-[200px] leading-relaxed">
                  유튜브 방송 링크를 연결하거나 우측의 <strong className="text-purple-400 underline cursor-pointer" onClick={() => handleConnectStream(true)}>데모 모드</strong>를 시작하여 실시간 피드댓글을 감상하세요.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                // Determine styling classes for user ranks and tag patterns
                let rowBg = "hover:bg-slate-900/45 p-1 px-1.5 rounded transition-all";
                let authorBadge = "text-slate-400";
                
                if (m.isOwner) {
                  rowBg = "bg-rose-500/10 border border-rose-500/20 p-1.5 px-2 rounded-lg";
                  authorBadge = "text-rose-400 font-extrabold flex items-center gap-1";
                } else if (m.isSponsor) {
                  rowBg = "bg-emerald-500/5 border border-emerald-500/10 p-1.5 px-2 rounded-lg";
                  authorBadge = "text-emerald-400 font-semibold flex items-center gap-1";
                } else if (m.isModerator) {
                  rowBg = "bg-cyan-500/5 border border-cyan-500/10 p-1.5 px-2 rounded-lg";
                  authorBadge = "text-cyan-400 font-semibold flex items-center gap-1";
                }

                // Append notification class based on automatic local tags
                let tagMarkup = null;
                if (m.category === 'purchase_signal') {
                  tagMarkup = <span className="text-[9px] bg-green-500/10 text-green-400 px-1 border border-green-500/20 font-sans rounded shrink-0 uppercase tracking-tighter">🛒구매신호</span>;
                } else if (m.category === 'stream_issue') {
                  tagMarkup = <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1 border border-amber-500/20 font-sans rounded shrink-0 uppercase tracking-tighter">⚠️방송장애</span>;
                } else if (m.category === 'complaint') {
                  tagMarkup = <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1 border border-rose-500/20 font-sans rounded shrink-0 uppercase tracking-tighter">🚨불만의심</span>;
                }

                return (
                  <div key={m.id} className={`${rowBg} flex flex-col gap-1`}>
                    <div className="flex items-center justify-between gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Tiny pixel-art avatar */}
                        <img 
                          src={m.avatar} 
                          alt="avatar" 
                          onError={(e) => {
                            e.currentTarget.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(m.author)}`;
                          }}
                          className="w-3.5 h-3.5 rounded-full bg-slate-800 border border-slate-700/60"
                        />
                        <span className={`${authorBadge} text-[11px] truncate font-bold`}>
                          {m.author}
                          {m.isSponsor && <span className="text-[8px] bg-emerald-950 text-emerald-400 border border-emerald-800 py-0.2 px-1 rounded ml-1 scale-90">멤버십</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {tagMarkup}
                        <span className="text-slate-600 text-[9px] tabular-nums shrink-0">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-slate-300 font-sans break-words pl-5 leading-normal">
                      {m.message}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
        </section>

        {/* CENTER PANEL: Dashboard Grid / Metrics (col-span-6) */}
        <section className="lg:basis-2/4 lg:flex-[2] min-w-0 flex flex-col gap-4 overflow-y-auto max-h-full pr-1">
          
          {/* TOP Level Performance/Sought KPIs */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            
            {/* Total Messages count */}
            <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] p-4 rounded-xl relative overflow-hidden group">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider font-sans">누적 수집 댓글</div>
              <div className="text-3xl font-extrabold mono text-white leading-tight font-mono tracking-tight">
                {messages.length.toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                누적 수집 중복 제거 필터 가동
              </div>
            </div>

            {/* Current Spoken CPM speed */}
            <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] p-4 rounded-xl relative overflow-hidden">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider font-sans">분당 댓글수 (CPM)</div>
              <div className="text-3xl font-extrabold mono text-cyan-400 leading-tight font-mono tracking-tight flex items-baseline gap-1">
                {cpm} 
                <span className="text-xs text-slate-500 font-normal">/min</span>
              </div>
              <div className="text-[9px] text-slate-400 mt-1 italic font-mono truncate">
                최고 기록: {peakCpm} CPM
              </div>
            </div>

            {/* Active alert indicator summary */}
            <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] p-4 rounded-xl relative overflow-hidden">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider font-sans">실시간 특이 리액션</div>
              <div className="text-2xl font-bold text-slate-200 mt-1 flex items-center gap-2">
                <span className="text-red-400 font-mono font-bold">{totalStreamIssues + totalComplaints}</span>
                <span className="text-xs text-slate-500 font-normal">/</span>
                <span className="text-emerald-400 font-mono font-bold">{totalPurchaseSignals}</span>
              </div>
              <p className="text-[9px] text-slate-500 mt-2 truncate font-sans">위험 감지대비 구매 신호 비율</p>
            </div>
          </div>

          {/* LOWER ROW: Sentiment Progress Gauge + TOP Keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Sentiment Gauge Card */}
            <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">AI 시청자 감정 분석 (Sentiment)</h3>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-950 text-indigo-400 rounded-sm font-mono border border-indigo-900">
                    REALTIME GAUGE
                  </span>
                </div>

                {/* Simulated default sentiment fallback or fetched analysis */}
                {analysis ? (
                  <div className="space-y-4 my-2">
                    {/* Multicolored side-by-side progress bar block */}
                    <div className="h-3.5 bg-slate-800 rounded-lg overflow-hidden flex shadow-inner">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                        style={{ width: `${analysis.sentiment.positive}%` }}
                        title={`긍정 ${analysis.sentiment.positive}%`}
                      ></div>
                      <div 
                        className="h-full bg-slate-500 transition-all duration-500" 
                        style={{ width: `${analysis.sentiment.neutral}%` }}
                        title={`중립 ${analysis.sentiment.neutral}%`}
                      ></div>
                      <div 
                        className="h-full bg-rose-500 transition-all duration-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
                        style={{ width: `${analysis.sentiment.negative}%` }}
                        title={`부정 ${analysis.sentiment.negative}%`}
                      ></div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-emerald-950/25 border border-emerald-500/20 py-1.5 rounded-lg">
                        <div className="text-emerald-400 font-extrabold font-mono text-base">{analysis.sentiment.positive}%</div>
                        <div className="text-[9px] text-emerald-500 tracking-tighter mt-0.5 font-sans">긍정 (지향/지지)</div>
                      </div>
                      <div className="bg-slate-900/40 border border-slate-800 py-1.5 rounded-lg">
                        <div className="text-slate-400 font-bold font-mono text-base">{analysis.sentiment.neutral}%</div>
                        <div className="text-[9px] text-slate-500 tracking-tighter mt-0.5 font-sans">중립 (질문 등)</div>
                      </div>
                      <div className="bg-rose-950/25 border border-rose-500/20 py-1.5 rounded-lg">
                        <div className="text-rose-400 font-extrabold font-mono text-base">{analysis.sentiment.negative}%</div>
                        <div className="text-[9px] text-rose-500 tracking-tighter mt-0.5  font-sans">부정 (항의/품질)</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="my-6 text-center text-slate-600 space-y-2">
                    <BarChart2 className="mx-auto w-8 h-8 text-slate-800 animate-pulse" />
                    <p className="text-[11px]">실시간 감정 분석 대기중입니다.</p>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-slate-500 mt-2 border-t border-slate-800/80 pt-2 font-sans leading-normal">
                💡 긍정 비율이 높을 땐 적극 사은품 추천을, 부정 비율이 늘어날 때는 방송 오디오 또는 인터넷 지연 피드백을 우선 대응하세요.
              </p>
            </div>

            {/* TOP Keywords Cloud card */}
            <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans">실시간 인기 급상승 키워드</h3>
                  <TrendingUp size={14} className="text-cyan-400" />
                </div>

                {analysis && analysis.topKeywords && analysis.topKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5 my-2">
                    {analysis.topKeywords.map((tag, idx) => {
                      const trendColorSpec = tag.trend === 'up' || tag.trend === 'up_trend' 
                        ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' 
                        : 'text-cyan-400 border-cyan-500/20 bg-slate-950';

                      return (
                        <div 
                          key={idx} 
                          className={`px-3 py-1.5 border rounded-lg text-xs flex items-center gap-2 font-mono ${trendColorSpec}`}
                        >
                          <span className="font-sans text-[10px] text-slate-500">#{idx+1}</span>
                          <span className="font-extrabold text-slate-100">{tag.keyword}</span>
                          <span className="text-[10px] bg-slate-900 px-1 py-0.2 rounded text-slate-400 font-normal">
                            {tag.count}회
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 text-slate-500 text-xs my-4 justify-center py-4">
                    <span className="px-2.5 py-1 bg-slate-900/40 rounded-lg max-w-[200px] text-center italic text-[11px]">
                      충분한 실시간 대화 키워드가 쌓이면 OpenAI 리스닝 엔진이 핵심 테마 키워드를 추출합니다.
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-500 mt-2 border-t border-slate-800/80 pt-2">
                시청자들의 핵심 관심사가 드러나는 태그입니다.
              </div>
            </div>
          </div>

          {/* B-4: 시간축 분석 대시보드 (CPM · 정서 · 카테고리 추이) */}
          <div className="shrink-0 w-full min-w-0">
            <TimelineDashboard
              cpmHistory={cpmHistory}
              sentimentHistory={sentimentHistory}
              categoryHistory={categoryHistory}
            />
          </div>

          {/* REALTIME DETECTED SIGNALS BENTO GRID ROW */}
          <div className="bg-slate-900/70 border border-[rgba(56,189,248,0.15)] rounded-xl p-4 h-56 shrink-0 flex flex-col">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 shrink-0 font-sans flex items-center justify-between">
              <span>🎯 위험 및 목적별 실시간 댓글 카테고라이징 알림판</span>
              <span className="text-[9px] text-slate-500 font-normal">Message Filter Pattern</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 overflow-hidden">
              
              {/* Category green: Purchase signal comments */}
              <div className="bg-green-950/20 border border-green-500/20 p-2.5 rounded-lg flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-green-400 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1">
                    <CreditCard size={10} /> PURCHASE SIGNAL
                  </span>
                  <span className="mono text-[10px] text-green-400 font-bold">{totalPurchaseSignals}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-1.5 text-[11px] text-slate-300 pr-1 select-text">
                  {messages.filter(m => m.category === 'purchase_signal').length === 0 ? (
                    <p className="text-slate-600 text-[10px] italic pt-6 text-center font-sans">결제/혜택 관련 신호 대기중</p>
                  ) : (
                    messages.filter(m => m.category === 'purchase_signal').slice(-3).map(m => (
                      <div key={m.id} className="border-l border-green-500/30 pl-1.5 py-0.5">
                        <p className="text-slate-400 text-[9px] truncate font-sans font-bold">{m.author}</p>
                        <p className="text-slate-200 truncate font-sans">{m.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Category amber/red: Technical stream problems */}
              <div className="bg-amber-950/20 border border-amber-500/20 p-2.5 rounded-lg flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-amber-400 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1">
                    <AlertTriangle size={10} /> STREAM ISSUES
                  </span>
                  <span className="mono text-[10px] text-amber-400 font-bold">{totalStreamIssues}</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 text-[11px] text-slate-300 pr-1 select-text">
                  {messages.filter(m => m.category === 'stream_issue').length === 0 ? (
                    <p className="text-slate-600 text-[10px] italic pt-6 text-center font-sans">방송 송출 기술적 의견 대기중</p>
                  ) : (
                    messages.filter(m => m.category === 'stream_issue').slice(-3).map(m => (
                      <div key={m.id} className="border-l border-amber-500/30 pl-1.5 py-0.5">
                        <p className="text-slate-400 text-[9px] truncate font-sans font-bold">{m.author}</p>
                        <p className="text-slate-200 truncate font-sans">{m.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Category rose: Repeated/FAQ questions */}
              <div className="bg-indigo-950/20 border border-indigo-500/20 p-2.5 rounded-lg flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-indigo-400 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1">
                    <MessageSquare size={10} /> SYSTEM REPEATED
                  </span>
                  <span className="mono text-[10px] text-indigo-400 font-bold">
                    {analysis?.faq?.length || 0}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 text-[11px] text-slate-300 pr-1 select-text">
                  {!analysis || !analysis.faq || analysis.faq.length === 0 ? (
                    <p className="text-slate-600 text-[10px] italic pt-6 text-center font-sans">반복 빈출 질문 리스트 대기중</p>
                  ) : (
                    analysis.faq.slice(0, 3).map((f, idx) => (
                      <div key={idx} className="border-l border-indigo-500/30 pl-1.5 py-0.5">
                        <p className="text-slate-200 truncate font-sans font-extrabold">{f.question}</p>
                        <p className="text-slate-400 font-sans text-[10px] truncate">{f.count}회 반복 문의 감지</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* FAQ CARDS: Host Guided Responses (Click-to-Copy) */}
          <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-cyan-400" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans">
                  방송자 전용 실시간 질문 해결 코치 &amp; 복사 가이드
                </h3>
              </div>
              <span className="text-[9px] text-slate-500">조연출 추천 즉시 소통 가이드</span>
            </div>

            {analysis && analysis.faq && analysis.faq.length > 0 ? (
              <div className="space-y-3">
                {analysis.faq.map((faq, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-lg transition-all flex flex-col justify-between md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] bg-indigo-950 text-indigo-400 font-extrabold px-1.5 py-0.2 rounded font-sans">Q</span>
                        <strong className="text-xs text-slate-200 truncate block">{faq.question}</strong>
                        <span className="text-[9px] text-pink-400 shrink-0 font-mono">({faq.count}회 감지)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed font-sans mt-1 italic italic-dark pl-2 border-l-2 border-slate-800">
                        "{faq.templateAnswer}"
                      </p>
                    </div>

                    <button
                      onClick={() => handleCopyToClipboard(faq.templateAnswer, `faq-copy-${idx}`)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all shrink-0 flex items-center gap-1.5 ${copiedId === `faq-copy-${idx}` ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-900 hover:bg-slate-800 text-slate-400'}`}
                    >
                      {copiedId === `faq-copy-${idx}` ? (
                        <>
                          <CheckCircle size={11} />
                          복사 완료!
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          답변 대사 복사
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-600 text-xs italic font-sans dark:text-slate-500">
                수집된 라이브 채팅에서 빈번하게 도출되는 단골 질문 및 맞춤형 즉흥 대사 답변 가이드가 존재하지 않습니다. 라이브를 계속 진행하세요.
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL: AI Actions & Action Suggestion Board (col-span-3) */}
        <section className="lg:basis-1/4 lg:flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto max-h-full">
          
          {/* Action Alerts Prompt Card */}
          <div className="bg-blue-600/10 border-2 border-blue-600/60 rounded-xl p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(37,99,235,0.4)]">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                AI 스트리밍 액션 및 소통 솔루션
              </h3>
            </div>

            <div className="space-y-3">
              {analysis && analysis.presenterActions && analysis.presenterActions.length > 0 ? (
                analysis.presenterActions.map((action, idx) => {
                  let alertBg = "bg-blue-600/15 border border-blue-500/30";
                  let tagColor = "bg-blue-950 text-blue-300 border-blue-500/40";
                  
                  if (action.type === 'urgent') {
                    alertBg = "bg-rose-950/45 border border-rose-500/30 font-semibold";
                    tagColor = "bg-rose-950 text-rose-400 border-rose-500/50";
                  } else if (action.type === 'action') {
                    alertBg = "bg-amber-950/20 border border-amber-500/30";
                    tagColor = "bg-amber-950 text-amber-400 border-amber-500/40";
                  }

                  return (
                    <div key={idx} className={`${alertBg} p-3 rounded-lg flex flex-col gap-1.5`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[9px] font-bold uppercase py-0.2 px-1.5 border rounded-sm font-sans shrink-0 ${tagColor}`}>
                          {action.target} // {action.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-100 font-sans leading-relaxed">
                        {action.message}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="bg-blue-600/5 p-3 rounded-lg border border-blue-500/20 text-blue-200">
                  <p className="text-xs font-semibold mb-1">인사이트 큐 대기 중:</p>
                  <p className="text-[11px] leading-relaxed">
                    유튜브 스트림을 연동하면 OpenAI 기반 AI 조연출 시스템이 실시간 시청자 리액션을 즉각 모니터링하여 방송자 맞춤형 미션 조치를 이곳에 출력합니다.
                  </p>
                </div>
              )}
              
              {/* Secondary target topic suggestion */}
              {analysis && analysis.suggestedTopic && (
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg mt-2">
                  <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wide block mb-1">추천 리액션 / 즉흥 미션</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans italic">
                    "{analysis.suggestedTopic}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Last 5m Summary Section */}
          <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4 flex flex-col flex-1 min-h-[220px] justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans flex items-center gap-1.5">
                  <Clock size={12} className="text-indigo-400" />
                  최근 5분 실시간 요약
                </h3>
                {analysis && (
                  <span className="text-[9px] text-slate-500 font-mono">
                    {analysis.analyzedAt} 기준
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-300 leading-relaxed font-sans space-y-2">
                {analysis && analysis.recentSummary ? (
                  <p className="italic pl-2.5 border-l-2 border-cyan-500/40 font-normal">
                    {analysis.recentSummary}
                  </p>
                ) : (
                  <p className="text-slate-500 italic">
                    수집 전용 데이터가 생성되면 실시간 대화 추이를 품격있게 요약합니다. 대화를 구성해 보세요.
                  </p>
                )}
              </div>
            </div>

            {/* Comprehensive Report Button */}
            <div className="mt-4 pt-4 border-t border-slate-800/80 shrink-0">
              <button 
                id="generate_end_report_btn"
                onClick={handleGenerateReport}
                className="w-full py-2.5 bg-slate-800 border border-slate-700/60 hover:bg-slate-700/80 transition-colors text-white font-extrabold rounded-lg text-xs tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-black"
                title="라이브 진행을 최종 회고할 수 있는 완성도 높은 분석 대시보드 마크다운 보고서 생성"
              >
                <FileText size={13} className="text-rose-400" />
                방송 종료 리포트 생성
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* REPORT CONFIGURE OVERLAY MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-slate-800 w-full max-w-4xl h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl relative animate-fadeIn">
            
            {/* Modal Heading */}
            <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Award className="text-rose-400 shrink-0" size={20} />
                <div>
                  <h2 className="text-base font-bold text-white">LiveChat Radar - 방송 종료 종합 분석 리포트</h2>
                  <p className="text-[10px] text-slate-500">실시간 데이터와 OpenAI를 기반으로 도출된 콘텐츠 개선 보고서</p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowReportModal(false)}
                className="p-1.5 bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body scrolling content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 select-text text-sm">
              {isGeneratingReport ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
                  <RotateCw size={40} className="text-cyan-400 animate-spin" />
                  <div className="text-center space-y-1.5">
                    <p className="text-sm font-bold text-slate-200">OpenAI가 방송 성과를 심층 학습하는 중입니다...</p>
                    <p className="text-xs text-slate-500">채팅 반응 강도, 반복 질문, 시청자 불만을 종합한 AI 피드백 문서를 제작하는 중입니다.</p>
                  </div>
                </div>
              ) : report ? (
                <div className="space-y-6">
                  {/* Stats grids */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl text-center">
                      <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">총 수집 댓글</p>
                      <p className="text-2xl font-bold font-mono text-cyan-400">{report.summaryStats.totalMessages}</p>
                    </div>
                    <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl text-center">
                      <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">최대 화력 (Peak CPM)</p>
                      <p className="text-2xl font-bold font-mono text-pink-400">{report.summaryStats.peakCpm} CPM</p>
                    </div>
                    <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl text-center">
                      <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">핵심 해결 질문</p>
                      <p className="text-2xl font-bold font-mono text-emerald-400">{report.summaryStats.resolvedFaqsCount}개</p>
                    </div>
                    <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl text-center">
                      <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">지배 성향 분위기</p>
                      <p className="text-xs font-bold text-indigo-300 mt-1.5 truncate">{report.summaryStats.dominantSentiment}</p>
                    </div>
                  </div>

                  {/* Markdown Display render area */}
                  <div className="bg-slate-950/80 rounded-xl p-5 border border-slate-800 text-slate-200 font-sans leading-relaxed whitespace-pre-wrap select-text selection:bg-purple-500/40">
                    {report.reportMarkdown}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  리포트를 가져오는 중 약간의 이상 흐름이 있었습니다. 다시 시도하십시오.
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-500 font-sans">
                {report ? `출력시각: ${report.generatedAt}` : ''}
              </span>
              
              <div className="flex items-center gap-2">
                {report && (
                  <button 
                    onClick={() => handleCopyToClipboard(report.reportMarkdown, 'report-copy-doc')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${copiedId === 'report-copy-doc' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}
                  >
                    {copiedId === 'report-copy-doc' ? (
                      <>
                        <CheckCircle size={13} />
                        복사 완료!
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        전체 마크다운 복사하기
                      </>
                    )}
                  </button>
                )}
                
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  창 닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
