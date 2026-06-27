/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Bot,
  Video,
  MessageSquare,
  Clock,
  Activity,
  RotateCw,
  CheckCircle,
  FileText,
  X,
  Copy,
  AlertCircle,
  Pause,
  Award,
  Flame,
} from 'lucide-react';
import { ChatMessage, StreamInfo } from './types';
import { ShopAnalysisResult, ShopReportResult, ShopTimelinePoint, LiveProduct } from './types/liveShopping';
import { ShopTimelineDashboard } from './components/shop/ShopTimelineDashboard';
import { ProductBar } from './components/shop/ProductBar';
import { ProductRegisterModal } from './components/shop/ProductRegisterModal';
import { ShopKpiStrip } from './components/shop/ShopKpiStrip';
import { ShopActionCards } from './components/shop/ShopActionCards';
import { UnansweredQueue } from './components/shop/UnansweredQueue';
import { AxisDistribution } from './components/shop/AxisDistribution';
import { ProductInterestRanking } from './components/shop/ProductInterestRanking';
import { ShopFaqList } from './components/shop/ShopFaqList';
import { HotLeadBoard } from './components/shop/HotLeadBoard';
import { ViewerInsights } from './components/shop/ViewerInsights';
import { ConversionPanel } from './components/shop/ConversionPanel';
import { ClosingWindowCard } from './components/shop/ClosingWindowCard';
import { MentionLiftCard } from './components/shop/MentionLiftCard';
import { PostLiveAnalysis } from './components/shop/PostLiveAnalysis';
import { ScriptAssist } from './components/shop/ScriptAssist';
import { ProductTimeBlocks } from './components/shop/ProductTimeBlocks';
import { buildViewerProfiles, summarizeViewers } from './lib/buildViewerProfiles';
import { buildConversionFunnel, detectClosingWindow, detectPriceElasticityWarning } from './lib/conversion';
import { buildPostLiveInsights } from './lib/postLive';
import { matchPresetAnswers } from './lib/scriptAssist';
import { MentionMark, ProductBlock } from './types/liveShopping';

// Timeline 캐핑 — 분석 cadence ~40초 × 40 = ~27분 추이 보존
const SHOP_TIMELINE_CAP = 40;

export default function App() {
  // Input URL / Current stream status
  const [urlInput, setUrlInput] = useState<string>('https://www.youtube.com/live/demo');
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState<boolean>(false);

  // Real-time comments
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [pollingRate, setPollingRate] = useState<number>(3500);

  // CPM tracking variables
  const [cpm, setCpm] = useState<number>(0);
  const [peakCpm, setPeakCpm] = useState<number>(0);

  // 라이브 쇼핑 AI 분석 결과
  const [analysis, setAnalysis] = useState<ShopAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [autoAnalysisEnabled, setAutoAnalysisEnabled] = useState<boolean>(true);

  // 방송 등록 상품 (AI 분석 컨텍스트)
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  // 미응답 큐 로컬 해소 (호스트가 답변 완료 처리한 질문 id)
  const [resolvedQuestionIds, setResolvedQuestionIds] = useState<Set<string>>(new Set());
  // G-2-4: 멘트 효과 마킹
  const [mentionMarks, setMentionMarks] = useState<MentionMark[]>([]);
  // G-4-4: 상품 소개 타임블록
  const [productBlocks, setProductBlocks] = useState<ProductBlock[]>([]);
  const lastActiveRef = useRef<string | null>(null);

  // Post-stream report
  const [report, setReport] = useState<ShopReportResult | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // Status & notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Refs for timers & message feed autoscroll
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAnalyzeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const lastAnalyzedCountRef = useRef<number>(0);
  // Mirror of isPolling state. setState updates are async, so the closure
  // captured by pullBatch sees the stale initial false. Use ref for the
  // re-enqueue guard so polling actually continues after the first batch.
  const isPollingRef = useRef<boolean>(false);
  const pollingRateRef = useRef<number>(3000);
  // Mirrors for the 40s auto-analyze interval callback.
  const messagesCountRef = useRef<number>(0);
  const isAnalyzingRef = useRef<boolean>(false);
  const runAIAnalysisRef = useRef<() => void>(() => {});
  // products는 runAIAnalysis 클로저가 최신 값을 봐야 하므로 ref 미러.
  const productsRef = useRef<LiveProduct[]>([]);

  // Track chat feed height scroll behavior
  const [chatAutoScroll, setChatAutoScroll] = useState<boolean>(true);

  // 쇼핑 축 시간축 누적 (분석마다 1포인트)
  const [shopTimeline, setShopTimeline] = useState<ShopTimelinePoint[]>([]);
  // 최신 cpm을 분석 시점 timeline 포인트에 담기 위한 ref 미러
  const cpmRef = useRef<number>(0);

  // Clean local error notification after 5 seconds
  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setCopiedId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // Handle Autoscroll on messages change
  useEffect(() => {
    if (chatAutoScroll && chatListRef.current) {
      chatListRef.current.scrollTo({
        top: chatListRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, chatAutoScroll]);

  // 1. Calculate CPM (Comments Per Minute) based on timestamps of the last minute
  useEffect(() => {
    const calcCpm = () => {
      if (messages.length === 0) return;
      const now = Date.now();
      const oneMinuteAgo = now - 60000;

      const recentCount = messages.filter((m) => {
        const t = new Date(m.timestamp).getTime();
        return t >= oneMinuteAgo;
      }).length;

      setCpm(recentCount);
      cpmRef.current = recentCount;
      if (recentCount > peakCpm) setPeakCpm(recentCount);
    };

    const interval = setInterval(calcCpm, 3000);
    return () => clearInterval(interval);
  }, [messages, peakCpm]);

  // analysis 갱신 시 쇼핑 축 timeline에 1포인트 push (구매온도/가격저항/미응답/CPM)
  useEffect(() => {
    if (!analysis) return;
    const metricNum = (id: string): number => {
      const v = analysis.metrics?.find((m) => m.id === id)?.value;
      return typeof v === 'number' ? v : 0;
    };
    const point: ShopTimelinePoint = {
      t: Date.now(),
      cpm: cpmRef.current,
      purchaseTemp: metricNum('purchase_temperature'),
      priceResistance: metricNum('price_resistance'),
      unansweredCount: analysis.unanswered?.length ?? 0,
      purchased: metricNum('sales_estimate'),
    };
    setShopTimeline((prev) => {
      const next = [...prev, point];
      return next.length > SHOP_TIMELINE_CAP ? next.slice(-SHOP_TIMELINE_CAP) : next;
    });
  }, [analysis]);

  // Keep refs in sync with state so the 40s interval can read latest values.
  useEffect(() => { messagesCountRef.current = messages.length; }, [messages.length]);
  useEffect(() => { isAnalyzingRef.current = isAnalyzing; }, [isAnalyzing]);
  useEffect(() => { productsRef.current = products; }, [products]);

  // G-4-4: 활성 상품이 바뀌면 이전 블록을 닫고 새 블록을 연다 (StrictMode 중복 방지: ref 가드)
  const activeProductId = products.find((p) => p.isActive)?.id ?? null;
  useEffect(() => {
    if (activeProductId === lastActiveRef.current) return;
    lastActiveRef.current = activeProductId;
    const now = new Date().toISOString();
    setProductBlocks((prev) => {
      const closed = prev.map((b) => (b.endedAt ? b : { ...b, endedAt: now }));
      if (!activeProductId) return closed;
      const prod = productsRef.current.find((p) => p.id === activeProductId);
      if (!prod) return closed;
      return [...closed, { id: `blk-${Date.now()}`, productId: activeProductId, name: prod.name, startedAt: now, endedAt: null }];
    });
  }, [activeProductId]);
  useEffect(() => { runAIAnalysisRef.current = runAIAnalysis; });

  // 2. Automated AI Analysis trigger periodically (Every 40 seconds if new comments exist)
  useEffect(() => {
    if (!isPolling || !autoAnalysisEnabled) return;

    const tryInitial = () => {
      if (messagesCountRef.current > 0 && !isAnalyzingRef.current) {
        runAIAnalysisRef.current();
      }
    };
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
    return () => { stopCommentStream(); };
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
    setResolvedQuestionIds(new Set());
    setShopTimeline([]);
    setMentionMarks([]);
    setProductBlocks([]);
    lastActiveRef.current = null;

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
        publishedAt: result.publishedAt,
      });

      setSuccessMsg(`🚀 "${result.title}"에 연결되었습니다!`);

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
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const filteredNew = newItems.filter((m) => !existingIds.has(m.id));

            // 경량 프론트 힌트 태그 (AI 분석 전 피드 색상용)
            const typedNew = filteredNew.map((m) => {
              const text = m.message;
              let cat: ChatMessage['category'] = null;
              let reason = '';

              if (text.includes('소리') || text.includes('마이크') || text.includes('끊김') || text.includes('멈춤') || text.includes('랙')) {
                cat = 'stream_issue';
                reason = '송출 품질 피드백 감지';
              } else if (text.includes('구매') || text.includes('얼마') || text.includes('할인') || text.includes('가격') || text.includes('결제') || text.includes('샀')) {
                cat = 'purchase_signal';
                reason = '구매/가격 신호 매핑';
              } else if (text.includes('비싸') || text.includes('불만') || text.includes('별로') || text.includes('환불')) {
                cat = 'complaint';
                reason = '불만/저항 신호 감지';
              }

              return { ...m, category: cat, reason };
            });

            return [...prev, ...typedNew];
          });
        }

        currentToken = result.nextPageToken || null;
        setNextPageToken(currentToken);

        if (result.pollingIntervalMillis) {
          pollingRateRef.current = result.pollingIntervalMillis;
          setPollingRate(result.pollingIntervalMillis);
        }
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
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (autoAnalyzeTimerRef.current) {
      clearInterval(autoAnalyzeTimerRef.current);
      autoAnalyzeTimerRef.current = null;
    }
  };

  // Trigger 라이브 쇼핑 AI 분석
  const runAIAnalysis = async () => {
    if (isAnalyzing || messages.length === 0) return;
    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      lastAnalyzedCountRef.current = messages.length;

      const payload = {
        messages: messages.slice(-80),
        streamTitle: streamInfo?.title || '라이브 쇼핑 방송',
        products: productsRef.current,
      };

      const res = await fetch('/api/analyze/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success && result.analysis) {
        setAnalysis(result.analysis);
      } else {
        setErrorMsg('AI 댓글 분석 데이터를 수집하는 도중 문제가 발생했습니다.');
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
        streamTitle: streamInfo?.title || 'LiveChat Radar 라이브 쇼핑',
        peakCpm: peakCpm,
        products: productsRef.current,
      };

      const res = await fetch('/api/report/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success && result.report) {
        setReport(result.report);
      } else {
        setErrorMsg(result.error || '방송 종료 리포트를 구성하는 도중 거부되었습니다.');
      }
    } catch (err: any) {
      setErrorMsg(`종료 리포트 생성 중 예외 발생: ${err.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleCopyToClipboard = (text: string, elementId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(elementId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 상품 관리
  const handleAddProduct = (product: LiveProduct) => {
    setProducts((prev) => {
      // active 단일 보장
      if (product.isActive) return [...prev.map((p) => ({ ...p, isActive: false })), product];
      return [...prev, product];
    });
  };
  const handleSetActiveProduct = (id: string) => {
    setProducts((prev) => prev.map((p) => ({ ...p, isActive: p.id === id ? !p.isActive : false })));
  };
  const handleRemoveProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };
  const handleResolveQuestion = (id: string) => {
    setResolvedQuestionIds((prev) => new Set(prev).add(id));
  };

  // 미응답 큐 (로컬 해소 제외)
  const visibleUnanswered = (analysis?.unanswered ?? []).filter((q) => !resolvedQuestionIds.has(q.id));

  // G-1-1: 시청자(댓글러) 단위 핫리드 프로필 (author 집계, 신규 호출 없음)
  const viewerProfiles = useMemo(
    () => buildViewerProfiles(analysis?.analyses ?? [], analysis?.unanswered ?? [], messages),
    [analysis, messages],
  );
  // G-2-1: 전환 퍼널 (시청자 프로필에서 파생)
  const conversionFunnel = useMemo(() => buildConversionFunnel(viewerProfiles), [viewerProfiles]);
  // G-2-3: 클로징 윈도우 감지
  const closingWindow = useMemo(() => detectClosingWindow(analysis), [analysis]);
  // G-1-2/3/4: 시청자 세그먼트·망설임·트롤 요약
  const viewerSummary = useMemo(() => summarizeViewers(viewerProfiles), [viewerProfiles]);
  // G-2-5: 가격 탄력 경고
  const priceWarning = useMemo(() => detectPriceElasticityWarning(analysis), [analysis]);
  // G-2-4: 현재 누적 구매/온도 (멘트 리프트 측정 기준)
  const metricValue = (id: string): number => {
    const v = analysis?.metrics?.find((m) => m.id === id)?.value;
    return typeof v === 'number' ? v : 0;
  };
  const currentPurchased = metricValue('sales_estimate');
  const currentTemp = metricValue('purchase_temperature');

  const handleAddMark = (label: string) => {
    setMentionMarks((prev) => [
      ...prev,
      { id: `mk-${Date.now()}`, label, at: new Date().toISOString(), baselinePurchased: currentPurchased, baselineTemp: currentTemp },
    ]);
  };
  const handleClearMarks = () => setMentionMarks([]);

  // G-3: 종료 후 심화 분석 (세션 데이터 파생)
  const postLiveInsights = useMemo(
    () => buildPostLiveInsights({ timeline: shopTimeline, marks: mentionMarks, analysis, summary: viewerSummary }),
    [shopTimeline, mentionMarks, analysis, viewerSummary],
  );
  // G-4-3: 스크립트 어시스트 (셀링포인트 + 준비된 답변 매칭)
  const activeProduct = products.find((p) => p.isActive) ?? null;
  const presetMatches = useMemo(() => matchPresetAnswers(visibleUnanswered, products), [visibleUnanswered, products]);

  // 피드 힌트 카운트
  const totalPurchaseSignals = messages.filter((m) => m.category === 'purchase_signal').length;
  const totalStreamIssues = messages.filter((m) => m.category === 'stream_issue').length;

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
              <h1 className="text-lg font-extrabold tracking-tighter text-white">LiveChat Radar</h1>
              <span className="mono text-[10px] bg-cyan-950 text-cyan-400 px-1.5 py-0.2 border border-cyan-800/60 rounded">
                LIVE SHOPPING
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-sans">유튜브 라이브 쇼핑 전용 AI 판매 조연출</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs font-mono">
          {streamInfo ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-emerald-500/20 px-3 py-1.5 rounded-lg shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute"></span>
              <span className="text-emerald-400 font-bold ml-1.5 uppercase tracking-wide">
                [ {streamInfo.isDemo ? 'DEMO-LIVE' : 'CONNECTED'} ]
              </span>
              <span className="text-slate-400 max-w-[200px] truncate">{streamInfo.title}</span>
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
              placeholder="유튜브 라이브 쇼핑 URL 혹은 'demo' 입력..."
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
                title="수집된 댓글 기반으로 OpenAI 쇼핑 분석 즉시 실행"
              >
                {isAnalyzing ? <RotateCw size={12} className="animate-spin" /> : <Bot size={12} />}
                실시간 AI 재분석
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs font-sans text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoAnalysisEnabled}
              onChange={() => setAutoAnalysisEnabled(!autoAnalysisEnabled)}
              className="rounded border-slate-800 bg-slate-950 text-cyan-600 focus:ring-0"
            />
            <span>40초 마다 AI 자동 분석</span>
          </label>
        </div>
      </div>

      {/* 등록 상품 바 */}
      <ProductBar
        products={products}
        onAddClick={() => setShowProductModal(true)}
        onSetActive={handleSetActiveProduct}
        onRemove={handleRemoveProduct}
      />

      {/* Toast feedback */}
      {errorMsg && (
        <div className="bg-red-950/90 border-b border-red-500/40 text-red-100 text-xs px-6 py-2.5 flex items-center gap-2.5 font-sans animate-fadeIn">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white"><X size={14} /></button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-100 text-xs px-6 py-2.5 flex items-center gap-2.5 font-sans animate-fadeIn">
          <CheckCircle size={15} className="text-emerald-400 shrink-0" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white"><X size={14} /></button>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden max-h-[calc(100vh-160px)]">

        {/* LEFT: Live Comments Feed */}
        <section className="lg:basis-1/4 lg:flex-1 min-w-0 bg-slate-950/80 border border-[rgba(56,189,248,0.15)] rounded-xl flex flex-col overflow-hidden max-h-full">
          <div className="px-4 py-3 bg-slate-900/40 border-b border-[rgba(56,189,248,0.15)] flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">Live Chat Feed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono uppercase">{messages.length} 수집됨</span>
              <button
                onClick={() => setChatAutoScroll(!chatAutoScroll)}
                className={`text-[9px] px-1.5 py-0.5 rounded transition-all font-mono uppercase ${chatAutoScroll ? 'bg-cyan-950/60 border border-cyan-800 text-cyan-400' : 'bg-slate-800 text-slate-500 border border-transparent'}`}
                title="자동 스크롤"
              >
                {chatAutoScroll ? 'SCROLL: ON' : 'SCROLL: OFF'}
              </button>
            </div>
          </div>

          {streamInfo && (
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-3 shrink-0">
              <img src={streamInfo.thumbnailUrl} alt="Thumbnail" className="w-12 h-9 object-cover rounded border border-slate-700 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-200 truncate leading-snug">{streamInfo.title}</p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">CH: {streamInfo.channelName}</p>
              </div>
            </div>
          )}

          <div ref={chatListRef} className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-[11px]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 py-12 px-4 space-y-3">
                <MessageSquare size={32} className="text-slate-800 pointer-events-none" />
                <p className="max-w-[200px] leading-relaxed">
                  유튜브 라이브 쇼핑 링크를 연결하거나 <strong className="text-purple-400 underline cursor-pointer" onClick={() => handleConnectStream(true)}>데모 모드</strong>를 시작하세요.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                let rowBg = 'hover:bg-slate-900/45 p-1 px-1.5 rounded transition-all';
                let authorBadge = 'text-slate-400';

                if (m.isOwner) {
                  rowBg = 'bg-rose-500/10 border border-rose-500/20 p-1.5 px-2 rounded-lg';
                  authorBadge = 'text-rose-400 font-extrabold flex items-center gap-1';
                } else if (m.isSponsor) {
                  rowBg = 'bg-emerald-500/5 border border-emerald-500/10 p-1.5 px-2 rounded-lg';
                  authorBadge = 'text-emerald-400 font-semibold flex items-center gap-1';
                } else if (m.isModerator) {
                  rowBg = 'bg-cyan-500/5 border border-cyan-500/10 p-1.5 px-2 rounded-lg';
                  authorBadge = 'text-cyan-400 font-semibold flex items-center gap-1';
                }

                let tagMarkup = null;
                if (m.category === 'purchase_signal') {
                  tagMarkup = <span className="text-[9px] bg-green-500/10 text-green-400 px-1 border border-green-500/20 font-sans rounded shrink-0 uppercase tracking-tighter">🛒구매신호</span>;
                } else if (m.category === 'stream_issue') {
                  tagMarkup = <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1 border border-amber-500/20 font-sans rounded shrink-0 uppercase tracking-tighter">⚠️방송장애</span>;
                } else if (m.category === 'complaint') {
                  tagMarkup = <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1 border border-rose-500/20 font-sans rounded shrink-0 uppercase tracking-tighter">🚨가격저항</span>;
                }

                return (
                  <div key={m.id} className={`${rowBg} flex flex-col gap-1`}>
                    <div className="flex items-center justify-between gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img
                          src={m.avatar}
                          alt="avatar"
                          onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(m.author)}`; }}
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
                    <p className="text-slate-300 font-sans break-words pl-5 leading-normal">{m.message}</p>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
        </section>

        {/* CENTER: Shop dashboard */}
        <section className="lg:basis-2/4 lg:flex-[2] min-w-0 flex flex-col gap-4 overflow-y-auto max-h-full pr-1">

          {/* Mini KPI: 누적 댓글 / CPM */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] p-4 rounded-xl">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider font-sans">누적 수집 댓글</div>
              <div className="text-3xl font-extrabold text-white leading-tight font-mono tracking-tight">{messages.length.toLocaleString()}</div>
              <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                구매신호 {totalPurchaseSignals} · 방송장애 {totalStreamIssues}
              </div>
            </div>
            <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] p-4 rounded-xl">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider font-sans">분당 댓글수 (CPM)</div>
              <div className="text-3xl font-extrabold text-cyan-400 leading-tight font-mono tracking-tight flex items-baseline gap-1">
                {cpm}<span className="text-xs text-slate-500 font-normal">/min</span>
              </div>
              <div className="text-[9px] text-slate-400 mt-1 italic font-mono truncate">최고 기록: {peakCpm} CPM</div>
            </div>
          </div>

          {/* KPI 스트립 (쇼핑 지표 7종) */}
          <div className="shrink-0">
            <ShopKpiStrip metrics={analysis?.metrics ?? []} />
          </div>

          {/* 전환 퍼널 + 판매 모멘텀 + 가격 탄력 경고 */}
          <div className="shrink-0">
            <ConversionPanel funnel={conversionFunnel} timeline={shopTimeline} priceWarning={priceWarning} />
          </div>

          {/* 멘트 효과 추적 */}
          <div className="shrink-0">
            <MentionLiftCard
              marks={mentionMarks}
              currentPurchased={currentPurchased}
              currentTemp={currentTemp}
              onAdd={handleAddMark}
              onClear={handleClearMarks}
            />
          </div>

          {/* 6축 분포 + 상품별 관심 랭킹 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
            <AxisDistribution analyses={analysis?.analyses ?? []} />
            <ProductInterestRanking items={analysis?.productInterest ?? []} />
          </div>

          {/* 상품 소개 타임블록 */}
          <div className="shrink-0">
            <ProductTimeBlocks blocks={productBlocks} messages={messages} timeline={shopTimeline} />
          </div>

          {/* 판매 흐름 시간축 */}
          <div className="shrink-0 w-full min-w-0">
            <ShopTimelineDashboard points={shopTimeline} />
          </div>

          {/* 상품 FAQ */}
          <ShopFaqList faq={analysis?.faq ?? []} onCopy={handleCopyToClipboard} copiedId={copiedId} />
        </section>

        {/* RIGHT: 판매 처방 / 미응답 큐 / 요약 */}
        <section className="lg:basis-1/4 lg:flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto max-h-full">

          {/* 클로징 윈도우 카운트다운 (G-2-3) */}
          <ClosingWindowCard
            window={closingWindow}
            refreshKey={analysis?.analyzedAt}
            onCopy={handleCopyToClipboard}
            copiedId={copiedId}
          />

          {/* 클로징 처방 하이라이트 */}
          <div className="bg-gradient-to-br from-rose-950/40 to-amber-950/20 border-2 border-rose-600/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans">지금 클로징 전략</h3>
            </div>
            <p className="text-[12px] text-amber-100 font-sans leading-relaxed">
              {analysis?.conversionAdvice || '상품을 등록하고 라이브를 연동하면 지금 이 순간 가장 효과적인 판매 전략을 처방합니다.'}
            </p>
          </div>

          {/* 핫리드 보드 (살 것 같은 시청자) */}
          <HotLeadBoard viewers={viewerProfiles} />

          {/* 시청자 세그먼트 · 망설임 · 트롤 */}
          <ViewerInsights summary={viewerSummary} />

          {/* 실시간 액션 카드 */}
          <ShopActionCards cards={analysis?.actionCards ?? []} onCopy={handleCopyToClipboard} copiedId={copiedId} />

          {/* 미응답 질문 큐 */}
          <UnansweredQueue items={visibleUnanswered} onResolve={handleResolveQuestion} onCopy={handleCopyToClipboard} copiedId={copiedId} />

          {/* 스크립트 어시스트 (셀링포인트 + 준비된 답변) */}
          <ScriptAssist activeProduct={activeProduct} matches={presetMatches} onCopy={handleCopyToClipboard} copiedId={copiedId} />

          {/* 최근 요약 + 리포트 */}
          <div className="bg-slate-900/60 border border-[rgba(56,189,248,0.15)] rounded-xl p-4 flex flex-col flex-1 min-h-[180px] justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans flex items-center gap-1.5">
                  <Clock size={12} className="text-indigo-400" />최근 흐름 요약
                </h3>
                {analysis && <span className="text-[9px] text-slate-500 font-mono">{analysis.analyzedAt} 기준</span>}
              </div>
              <div className="text-[11px] text-slate-300 leading-relaxed font-sans">
                {analysis?.recentSummary ? (
                  <p className="italic pl-2.5 border-l-2 border-cyan-500/40 font-normal">{analysis.recentSummary}</p>
                ) : (
                  <p className="text-slate-500 italic">댓글이 분석되면 최근 채팅 흐름과 분위기를 요약합니다.</p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/80 shrink-0">
              <button
                id="generate_end_report_btn"
                onClick={handleGenerateReport}
                className="w-full py-2.5 bg-slate-800 border border-slate-700/60 hover:bg-slate-700/80 transition-colors text-white font-extrabold rounded-lg text-xs tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-black"
                title="방송 종료 종합 리포트 생성"
              >
                <FileText size={13} className="text-rose-400" />방송 종료 리포트 생성
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 상품 등록 모달 */}
      <ProductRegisterModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        onAdd={handleAddProduct}
        hasActive={products.some((p) => p.isActive)}
      />

      {/* REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-slate-800 w-full max-w-4xl h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl relative animate-fadeIn">
            <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Award className="text-rose-400 shrink-0" size={20} />
                <div>
                  <h2 className="text-base font-bold text-white">LiveChat Radar - 라이브 쇼핑 종료 리포트</h2>
                  <p className="text-[10px] text-slate-500">실시간 데이터와 OpenAI 기반 판매 성과 개선 보고서</p>
                </div>
              </div>
              <button onClick={() => setShowReportModal(false)} className="p-1.5 bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 select-text text-sm">
              {/* G-3: 세션 데이터 시각 분석 (AI 마크다운과 별개로 항상 표시) */}
              <PostLiveAnalysis
                insights={postLiveInsights}
                summary={viewerSummary}
                productInterest={analysis?.productInterest ?? []}
              />

              <div className="border-t border-slate-800 pt-2 text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-sans">
                🤖 AI 종합 리포트
              </div>

              {isGeneratingReport ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
                  <RotateCw size={40} className="text-cyan-400 animate-spin" />
                  <div className="text-center space-y-1.5">
                    <p className="text-sm font-bold text-slate-200">OpenAI가 방송 성과를 심층 분석하는 중입니다...</p>
                    <p className="text-xs text-slate-500">판매 신호, 미응답 질문, 가격 저항을 종합한 AI 피드백 문서를 제작하는 중입니다.</p>
                  </div>
                </div>
              ) : report ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl text-center">
                      <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">추정 판매</p>
                      <p className="text-2xl font-bold font-mono text-emerald-400">{report.summaryStats.estimatedSales}건</p>
                    </div>
                    <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl text-center">
                      <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">질문 응답률</p>
                      <p className="text-2xl font-bold font-mono text-cyan-400">{report.summaryStats.answerRate}%</p>
                    </div>
                    <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl text-center">
                      <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">미응답 질문</p>
                      <p className="text-2xl font-bold font-mono text-rose-400">{report.summaryStats.unansweredCount}건</p>
                    </div>
                    <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl text-center">
                      <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">관심 최상위 상품</p>
                      <p className="text-xs font-bold text-indigo-300 mt-1.5 truncate">{report.summaryStats.topProduct}</p>
                    </div>
                  </div>
                  <div className="bg-slate-950/80 rounded-xl p-5 border border-slate-800 text-slate-200 font-sans leading-relaxed whitespace-pre-wrap select-text selection:bg-purple-500/40">
                    {report.reportMarkdown}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">리포트를 가져오는 중 약간의 이상 흐름이 있었습니다. 다시 시도하십시오.</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-500 font-sans">{report ? `출력시각: ${report.generatedAt}` : ''}</span>
              <div className="flex items-center gap-2">
                {report && (
                  <button
                    onClick={() => handleCopyToClipboard(report.reportMarkdown, 'report-copy-doc')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${copiedId === 'report-copy-doc' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}
                  >
                    {copiedId === 'report-copy-doc' ? (<><CheckCircle size={13} /> 복사 완료!</>) : (<><Copy size={13} /> 전체 마크다운 복사하기</>)}
                  </button>
                )}
                <button onClick={() => setShowReportModal(false)} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors">
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
