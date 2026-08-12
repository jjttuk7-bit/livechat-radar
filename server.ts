/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import crypto from 'crypto';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import {
  STATIC_SHOP_ANALYZE_SYSTEM_PROMPT,
  STATIC_SHOP_REPORT_SYSTEM_PROMPT,
  shopAnalyzeJsonSchema,
  shopReportJsonSchema,
  STATIC_TALK_ANALYZE_SYSTEM_PROMPT,
  STATIC_TALK_REPORT_SYSTEM_PROMPT,
  talkAnalyzeJsonSchema,
  talkReportJsonSchema,
} from './src/prompts.js';
import { generateSimulatedShopAnalysis, generateSimulatedShopReport } from './src/lib/simulateShopAnalysis.js';
import { generateSimulatedTalkAnalysis, generateSimulatedTalkReport } from './src/lib/simulateTalkAnalysis.js';
import { runPrefilter, formatStatsForPrompt, type PrefilterStats } from './src/lib/prefilter.js';
import { applyDerivedAxes } from './src/lib/normalizeTalk.js';
import { getSessionStore, DEFAULT_RETENTION_DAYS } from './src/lib/sessionStore.js';
import {
  buildSessionRecord,
  compareToPrevious,
  buildAgendaTrends,
  buildReturningStats,
  buildCarryOver,
} from './src/lib/crossSession.js';
import { stratifiedSample, formatSampleForPrompt } from './src/lib/sample.js';
import type { LiveProduct } from './src/types/liveShopping.js';
import type { LiveIssue } from './src/types/liveTalk.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Helper function to extract YouTube Video ID
function extractVideoId(url: string): string | null {
  if (!url) return null;
  const cleaned = url.trim();
  // Check if it looks like a direct 11-char ID
  if (cleaned.length === 11 && !cleaned.includes('/') && !cleaned.includes('?')) {
    return cleaned;
  }
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|live\/)([^#\&\?]*).*/;
  const match = cleaned.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Global active chats mockup storage for DEMO MODE to statefully stream mock comments
interface DemoSession {
  lastIndex: number;
}
const demoSessions = new Map<string, DemoSession>();

// DEMO 모드용 가상 채팅 (정치·시사 라이브).
//
// ⚠️ 작성 원칙 (D-6 / D-7):
//   - 실존 인물·정당·진영을 지칭하지 않는다. "위원장", "예산안"처럼 일반 명사만 쓴다.
//   - 특정 진영에 유리하거나 불리한 서사를 담지 않는다. 동의/반대가 대칭으로 등장한다.
//   - 리스크 축 샘플은 **형식**(단정 표현·미확인 전언·도배)만 보여주며 실제 혐오 표현은 넣지 않는다.
//   데모는 제품 평가의 주 경로이므로, 여기 담긴 편향이 곧 제품의 첫인상이 된다.
const SIMULATED_CHAT_RESOURCES = [
  // 참여·후원 / 출석
  { author: "김민수", message: "오늘도 출석합니다! 본방 사수", isSponsor: true },
  { author: "이지혜", message: "퇴근하고 바로 들어왔습니다 반갑습니다", isSponsor: false },
  { author: "정상현", message: "매일 챙겨보고 있습니다. 늘 감사합니다", isSponsor: true },
  { author: "서미경", message: "슈퍼챗 보냅니다. 좋은 방송 부탁드려요", isSponsor: false },
  { author: "쿠쿠다스", message: "구독하고 알림 설정했습니다", isSponsor: false },
  { author: "달빛요정", message: "멤버십 가입했어요 앞으로도 응원합니다", isSponsor: true },

  // 질문·요구
  { author: "박태형", message: "예산안 처리 일정이 어떻게 되나요?", isSponsor: false },
  { author: "최유리", message: "관련 자료 좀 화면에 띄워주세요", isSponsor: false },
  { author: "마카롱", message: "그 근거 출처가 어디인가요? 원문 보고 싶습니다", isSponsor: true },
  { author: "이도원", message: "처음 보는 사람도 알 수 있게 쉽게 설명해주세요", isSponsor: false },
  { author: "블루스카이", message: "위원장 발언 부분 다시 들려주실 수 있나요?", isSponsor: false },
  { author: "김준호", message: "지난주에 다루신 그 건은 그 뒤로 어떻게 됐나요?", isSponsor: false },
  { author: "윤서연", message: "이 주제 다음 방송에서 자세히 다뤄주세요", isSponsor: false },
  { author: "Harry Park", message: "우리가 할 수 있는 게 뭐가 있을까요?", isSponsor: false },

  // 반응·의견 (동의/반대 대칭)
  { author: "한상현", message: "말씀하신 부분 정확한 지적이라고 봅니다", isSponsor: true },
  { author: "정우진", message: "저는 그 대목은 좀 다르게 봅니다", isSponsor: false },
  { author: "송지효", message: "동의합니다. 정리가 깔끔하네요", isSponsor: false },
  { author: "차은우사랑", message: "그 해석에는 동의하기 어렵습니다", isSponsor: false },
  { author: "미니미", message: "진짜 맞는 얘기인가요? 확인이 필요해 보입니다", isSponsor: false },

  // 정서
  { author: "강동우", message: "이건 좀 화가 나네요 어이가 없습니다", isSponsor: false },
  { author: "정수진", message: "앞으로 어떻게 될지 걱정이 큽니다", isSponsor: false },
  { author: "박지원", message: "그래도 오늘 정리 들으니 좀 낫네요", isSponsor: false },
  { author: "미래지향", message: "매번 똑같은 얘기라 좀 지치네요", isSponsor: false },

  // 리스크 형식 샘플 (실제 혐오 표현은 넣지 않는다 — 형식만)
  { author: "임재범", message: "카톡으로 받았는데 이거 사실인가요?", isSponsor: false },
  { author: "익명의시민", message: "저건 명백한 범죄다 구속감이다", isSponsor: false },
  { author: "새벽three", message: "지라시로 도는 내용인데 확인된 건가요", isSponsor: false },

  // 방송 운영
  { author: "Sonia Yang", message: "소리가 잘 안 들려요 마이크 확인 부탁드립니다", isSponsor: false },
  { author: "블루문", message: "화면이 잠깐 멈췄다가 돌아왔습니다", isSponsor: false }
];

// Initialize OpenAI SDK
const ai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// API Route: 1. Fetch channel & activeLiveChatId info
app.get('/api/youtube/info', async (req, res): Promise<any> => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: '유튜브 URL 또는 비디오 ID가 전달되지 않았습니다.' });
  }

  const trimmedUrl = url.trim();

  // Graceful DEMO Check
  if (trimmedUrl.toLowerCase() === 'demo' || trimmedUrl.toLowerCase().includes('demo') || trimmedUrl === 'DEMO_VIDEO') {
    return res.json({
      success: true,
      videoId: 'demo',
      activeLiveChatId: 'demo-chat-id',
      title: '🔴 [LIVE] 오늘의 시사 브리핑 — 예산안·청문회 쟁점 정리',
      channelName: 'LiveChat Radar 시사',
      thumbnailUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&auto=format&fit=crop&q=80',
      isDemo: true,
      publishedAt: new Date().toISOString()
    });
  }

  const videoId = extractVideoId(trimmedUrl);
  if (!videoId) {
    return res.status(400).json({ success: false, error: '올바른 유튜브 라이브 URL이 아닙니다.' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || apiKey === 'MY_YOUTUBE_API_KEY') {
    return res.json({
      success: false,
      error: 'YouTube API Key가 설정되어 있지 않습니다 . (설정 패널 또는 .env에서 YOUTUBE_API_KEY를 등록하거나 "demo" 모드를 눌러보세요)',
    });
  }

  try {
    const apiResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoId}&key=${apiKey}`
    );

    if (!apiResponse.ok) {
      const errorMsg = await apiResponse.text();
      throw new Error(`YouTube API returned status ${apiResponse.status}: ${errorMsg}`);
    }

    const data = await apiResponse.json();
    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ success: false, error: '유튜브 비디오를 찾을 수 없습니다. 올바른 URL 또는 비디오 ID인지 확인하세요.' });
    }

    const item = data.items[0];
    const snippet = item.snippet;
    const title = snippet.title;
    const channelName = snippet.channelTitle;
    const thumbnailUrl = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '';
    
    const liveDetails = item.liveStreamingDetails;
    const activeLiveChatId = liveDetails?.activeLiveChatId || null;

    if (!activeLiveChatId) {
      return res.json({
        success: false,
        error: '현재 라이브 중이 아니거나 채팅이 활성화되어 있지 않습니다.',
        info: {
          videoId,
          title,
          channelName,
          thumbnailUrl,
          activeLiveChatId: null
        }
      });
    }

    return res.json({
      success: true,
      videoId,
      activeLiveChatId,
      title,
      channelName,
      thumbnailUrl,
      isDemo: false,
      publishedAt: snippet.publishedAt
    });
  } catch (err: any) {
    console.error('YouTube Info API error:', err);
    return res.status(500).json({ success: false, error: `유튜브 정보를 가져오는 중에 오류가 발생했습니다: ${err.message}` });
  }
});

// API Route: 2. Fetch live chat messages via proxy (or simulated)
app.get('/api/youtube/chat', async (req, res): Promise<any> => {
  const { liveChatId, nextPageToken } = req.query;
  if (!liveChatId || typeof liveChatId !== 'string') {
    return res.status(400).json({ success: false, error: 'liveChatId가 명시되지 않았습니다.' });
  }

  // Handle DEMO MODE
  if (liveChatId === 'demo-chat-id') {
    const token = nextPageToken ? parseInt(nextPageToken as string, 10) : 0;
    
    // Grab the current state or initialize
    let session = demoSessions.get('demo');
    if (!session) {
      session = { lastIndex: 0 };
      demoSessions.set('demo', session);
    }
    
    // Determine simulated comment batch size (typically 2-4 comments per polling loop)
    const batchSize = Math.floor(Math.random() * 3) + 2; 
    const mockMessages = [];
    
    for (let i = 0; i < batchSize; i++) {
      const idx = (session.lastIndex + i) % SIMULATED_CHAT_RESOURCES.length;
      const t = new Date(Date.now() - (batchSize - i) * 1000);
      const resVal = SIMULATED_CHAT_RESOURCES[idx];
      mockMessages.push({
        id: `demo-msg-${token}-${idx}-${Date.now()}-${i}`,
        author: resVal.author,
        avatar: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(resVal.author)}`,
        message: resVal.message,
        timestamp: t.toISOString(),
        isSponsor: resVal.isSponsor,
        isModerator: Math.random() > 0.95,
        isOwner: false,
        category: null,
        reason: ''
      });
    }
    
    // Advance simulation window pointer
    session.lastIndex = (session.lastIndex + batchSize) % SIMULATED_CHAT_RESOURCES.length;
    demoSessions.set('demo', session);

    return res.json({
      success: true,
      items: mockMessages,
      nextPageToken: String(token + 1),
      pollingIntervalMillis: 3000, // Respect polling interval
      isDemo: true
    });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || apiKey === 'MY_YOUTUBE_API_KEY') {
    return res.status(400).json({ success: false, error: 'YouTube API Key가 설정되지 않았습니다 .' });
  }

  try {
    const pageTokenParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
    const apiResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=authorDetails,snippet&key=${apiKey}${pageTokenParam}`
    );

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      return res.status(apiResponse.status).json({
        success: false,
        error: errorData?.error?.message || 'YouTube Data API가 오류를 반환했습니다.'
      });
    }

    const data = await apiResponse.json();
    const items = data.items || [];
    
    // Map comments to cleaner system structure
    const chats = items.map((item: any) => {
      const snippet = item.snippet;
      const author = item.authorDetails;
      return {
        id: item.id,
        author: author?.displayName || '익명의 사용자',
        avatar: author?.profileImageUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(author?.displayName || 'User')}`,
        message: snippet?.displayMessage || snippet?.textMessageDetails?.messageText || '',
        timestamp: snippet?.publishedAt || new Date().toISOString(),
        isSponsor: author?.isChatSponsor || false,
        isModerator: author?.isChatModerator || false,
        isOwner: author?.isChatOwner || false
      };
    });

    return res.json({
      success: true,
      items: chats,
      nextPageToken: data.nextPageToken || null,
      pollingIntervalMillis: data.pollingIntervalMillis || 4000
    });
  } catch (err: any) {
    console.error('YouTube Fetch Chat API error:', err);
    return res.status(500).json({ success: false, error: `댓글 수집 오류: ${err.message}` });
  }
});

// Helper function to clean markdown wrappers and parse JSON resiliently
function cleanAndParseJSON(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned.trim());
}

// Helper function to call OpenAI chat.completions with retry (for 5xx/rate-limit errors) and model fallback.
// Uses Structured Outputs (json_schema, strict) to enforce response shape.
// systemPrompt vs userPrompt 분리는 OpenAI Prompt Caching의 자동 prefix 매칭을 위한 것 —
// 매 호출에서 동일한 systemPrompt를 messages[0]에 배치하면 ≥1024 토큰 시 캐시된 입력 토큰에 할인 적용.
async function generateContentWithRetryAndFallback(params: {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  jsonSchema: any;
}): Promise<{ text: string }> {
  const models = ['gpt-4o-mini', 'gpt-4o'];
  let lastError: any = null;

  for (const model of models) {
    let retries = 2; // Retry 2 times (3 attempts total per model)
    while (retries >= 0) {
      try {
        console.log(`[AI Listener] Attempting completion on ${model} (Retries left: ${retries})`);
        const completion = await ai!.chat.completions.create({
          model,
          // 분류·심각도 판정은 창의성이 필요한 작업이 아니다. 기본값(1)로 두면 같은 입력에
          // 다른 등급이 나온다 — 실제로 대상만 바꾼 대칭 fixture에서 심각도가 갈렸다(D-7 위반).
          temperature: 0,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: params.schemaName,
              strict: true,
              schema: params.jsonSchema,
            },
          },
        });

        const text = completion.choices?.[0]?.message?.content;
        if (text) {
          const usage: any = (completion as any).usage;
          const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;
          console.log(`[AI Listener] Success on ${model} — prompt=${usage?.prompt_tokens ?? '?'} cached=${cachedTokens} completion=${usage?.completion_tokens ?? '?'}`);
          return { text };
        }
        throw new Error('Retrieved empty or invalid response from the OpenAI model.');
      } catch (err: any) {
        lastError = err;
        console.error(`[AI Listener] Error with ${model} (attempts left ${retries}):`, err.message || err);
        retries--;
        if (retries >= 0) {
          // Wait 1 second before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  }

  throw lastError || new Error('All model generation attempts failed.');
}

// ── Response cache for /api/analyze ─────────────────────────────────────────
// polling 주기(~3.5s)가 새 댓글 유입 속도보다 빠를 때 동일한 메시지 윈도우에 대한
// 중복 분석을 차단한다. 단일 프로세스 메모리 LRU + TTL. 외부 의존(Redis 등) 없음.
type AnalyzeCacheEntry = { result: any; expires: number };
const analyzeCache = new Map<string, AnalyzeCacheEntry>();
const ANALYZE_CACHE_TTL_MS = 30_000;
const ANALYZE_CACHE_MAX = 100;
let analyzeCacheHits = 0;
let analyzeCacheMisses = 0;

function buildAnalyzeCacheKey(streamTitle: string, targetMessages: any[]): string {
  // ID 집합 + 제목만으로 결정됨. ID 순서는 polling 응답 순서를 따르므로 안정적.
  const idSig = targetMessages.map(m => m.id).join(',');
  return crypto.createHash('sha1').update(`${streamTitle}|${idSig}`).digest('hex');
}

function getCachedAnalysis(key: string): any | null {
  const entry = analyzeCache.get(key);
  if (!entry) {
    analyzeCacheMisses++;
    return null;
  }
  if (Date.now() > entry.expires) {
    analyzeCache.delete(key);
    analyzeCacheMisses++;
    return null;
  }
  // LRU recency 갱신: 재삽입으로 Map insertion order 끝으로 이동
  analyzeCache.delete(key);
  analyzeCache.set(key, entry);
  analyzeCacheHits++;
  return entry.result;
}

function setCachedAnalysis(key: string, result: any): void {
  analyzeCache.set(key, { result, expires: Date.now() + ANALYZE_CACHE_TTL_MS });
  // LRU 트리밍: insertion order 가장 오래된 항목부터 제거
  while (analyzeCache.size > ANALYZE_CACHE_MAX) {
    const oldestKey = analyzeCache.keys().next().value;
    if (oldestKey === undefined) break;
    analyzeCache.delete(oldestKey);
  }
}

function logCacheStats(): void {
  console.log(`[Cache] analyze hits=${analyzeCacheHits} misses=${analyzeCacheMisses} size=${analyzeCache.size}`);
}

// 정적 system 프롬프트 + json_schema는 src/prompts.ts에서 import (단일 출처).
// evals/runner.ts도 같은 객체를 import하여 회귀 평가 시 drift 방지.

// API Route: 3-S. 라이브 쇼핑 전용 분석 (6축 37태그 · 상품/옵션 매칭 · 미응답 큐 · 클로징 처방)
// 입력: messages[] + products(LiveProduct[]) 컨텍스트. 키 미설정/실패 시 로컬 시뮬레이터로 폴백.
app.post('/api/analyze/shop', async (req, res): Promise<any> => {
  const { messages, streamTitle } = req.body;
  const products: LiveProduct[] = Array.isArray(req.body?.products) ? req.body.products : [];

  // [1] 입력 검증 — 댓글이 없으면 시뮬레이터의 빈 상태 응답을 그대로 반환 (UI 안전)
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.json({
      success: true,
      analysis: generateSimulatedShopAnalysis([], products),
    });
  }

  // [2] !ai 폴백 (시뮬레이터) — DEMO/키 미설정 경로는 응답 캐시 우회
  if (!ai) {
    console.log('No OPENAI_API_KEY detected. Using local live-shopping simulator.');
    const simResult = generateSimulatedShopAnalysis(messages, products);
    return res.json({ success: true, analysis: simResult, isSimulated: true });
  }

  // [3] 정상 경로 (OpenAI)
  try {
    const windowOffset = Math.max(0, messages.length - 80);
    const targetMessages = messages.slice(windowOffset);

    // [A-2] 응답 캐시 — streamTitle + 메시지 ID 집합 + 상품 컨텍스트 시그니처로 결정.
    const productSig = products.map((p) => `${p.id}:${p.isActive ? 1 : 0}`).join(',');
    const cacheKey = buildAnalyzeCacheKey(`shop|${streamTitle || ''}|${productSig}`, targetMessages);
    const cached = getCachedAnalysis(cacheKey);
    if (cached) {
      logCacheStats();
      return res.json({ success: true, analysis: { ...cached, analyzedAt: new Date().toLocaleTimeString() }, cached: true });
    }

    const serializedComments = targetMessages
      .map((m) => `[ID:${m.id}] ${m.author}: "${m.message}"`)
      .join('\n');

    const serializedProducts = products.length > 0
      ? products
          .map((p) => `- id:${p.id} | ${p.name}${p.price != null ? ` | ${p.price}원` : ''}${p.options?.length ? ` | 옵션: ${p.options.join(', ')}` : ''}${p.isActive ? ' | [현재 소개중]' : ''}`)
          .join('\n')
      : '(등록된 상품 없음 — productId/optionLabel은 모두 null로 두십시오.)';

    // [A-1] system은 정적 프롬프트 그대로 (Prompt Caching prefix). user에는 호출별 데이터만.
    const userPrompt = `현재 방송 제목: "${streamTitle || '라이브 쇼핑 방송'}"

[등록 상품/옵션 목록]
${serializedProducts}

[수집된 실시간 최신 댓글 (${targetMessages.length}개)]
${serializedComments}`;

    const response = await generateContentWithRetryAndFallback({
      systemPrompt: STATIC_SHOP_ANALYZE_SYSTEM_PROMPT,
      userPrompt,
      schemaName: 'live_shopping_analysis',
      jsonSchema: shopAnalyzeJsonSchema,
    });

    const parsed = cleanAndParseJSON(response.text?.trim() || '{}');
    parsed.analyzedAt = new Date().toLocaleTimeString();

    setCachedAnalysis(cacheKey, parsed);
    logCacheStats();

    return res.json({ success: true, analysis: parsed });
  } catch (err: any) {
    console.error('OpenAI shop analysis internal failure:', err);
    // Graceful recovery: 로컬 시뮬레이터로 즉시 복구하여 앱 흐름을 막지 않는다.
    const fallback = generateSimulatedShopAnalysis(messages, products);
    return res.json({
      success: true,
      analysis: fallback,
      errorInfo: `라이브 쇼핑 AI 분석 중 지연이 발생하여 가상 분석 시스템으로 즉시 자동 복구되었습니다: ${err.message}`,
    });
  }
});

// API Route: 4-S. 라이브 쇼핑 종료 리포트 (판매 성과 중심)
app.post('/api/report/shop', async (req, res): Promise<any> => {
  const { messages, streamTitle, peakCpm } = req.body;
  const products: LiveProduct[] = Array.isArray(req.body?.products) ? req.body.products : [];

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, error: '분석에 필요한 댓글 목록이 비어 있습니다.' });
  }

  // !ai 폴백 — 로컬 시뮬레이터로 판매 성과 리포트 생성
  if (!ai) {
    console.log('No OPENAI_API_KEY detected. Using local live-shopping report simulator.');
    const simReport = generateSimulatedShopReport(messages, products, peakCpm || 0);
    return res.json({ success: true, report: simReport, isSimulated: true });
  }

  try {
    const serializedComments = messages
      .slice(0, 150)
      .map((m) => `${m.author}: "${m.message}"`)
      .join('\n');

    const serializedProducts = products.length > 0
      ? products
          .map((p) => `- id:${p.id} | ${p.name}${p.price != null ? ` | ${p.price}원` : ''}${p.options?.length ? ` | 옵션: ${p.options.join(', ')}` : ''}`)
          .join('\n')
      : '(등록된 상품 없음)';

    const userPrompt = `[방송 정보]
- 방송 제목: "${streamTitle || '라이브 쇼핑 방송'}"
- 총 수집 댓글 수: ${messages.length}개
- 최대 분당 댓글 수 (Peak CPM): ${peakCpm || 0} CPM

[등록 상품/옵션]
${serializedProducts}

[댓글 전반 데이터]
${serializedComments}`;

    const response = await generateContentWithRetryAndFallback({
      systemPrompt: STATIC_SHOP_REPORT_SYSTEM_PROMPT,
      userPrompt,
      schemaName: 'live_shopping_report',
      jsonSchema: shopReportJsonSchema,
    });

    const parsed = cleanAndParseJSON(response.text?.trim() || '{}');
    parsed.generatedAt = new Date().toLocaleString();
    return res.json({ success: true, report: parsed });
  } catch (err: any) {
    console.error('OpenAI shop report generation internal failure:', err);
    // Graceful recovery: 로컬 시뮬레이터로 복구
    const fallback = generateSimulatedShopReport(messages, products, peakCpm || 0);
    return res.json({
      success: true,
      report: fallback,
      errorInfo: `라이브 쇼핑 리포트 생성 중 지연이 발생하여 가상 리포트로 자동 복구되었습니다: ${err.message}`,
    });
  }
});

// ── 정치·시사 라이브 (P-4) ───────────────────────────────────────────────────
//
// 쇼핑 엔드포인트와 결정적으로 다른 점: **AI에 댓글 원문 전량을 넘기지 않는다.**
// L1(runPrefilter)이 전량을 비용 0으로 처리해 집계 통계 + 층화 표본을 만들고,
// AI에는 그것만 넘긴다. 그래야 호출당 입력 토큰이 CPM(분당 댓글 수)과 무관하게 상수로 고정된다.
// CPM 300짜리 방송에서 slice(-80) 방식은 40초 윈도우의 60%를 유실한다.

/** 큐시트 컨텍스트 직렬화 — 등록 이슈가 없으면 AI가 issueId를 null로 두게 한다 */
function serializeIssues(issues: LiveIssue[]): string {
  if (issues.length === 0) {
    return '(등록된 큐시트 없음 — issueId/figure는 모두 null로 두십시오.)';
  }
  return issues
    .map((i) => {
      const kw = i.keywords?.length ? ` | 키워드: ${i.keywords.join(', ')}` : '';
      const fg = i.figures?.length ? ` | 인물: ${i.figures.join(', ')}` : '';
      const act = i.isActive ? ' | [현재 진행중]' : '';
      return `- id:${i.id} | ${i.title}${kw}${fg}${act}`;
    })
    .join('\n');
}

/**
 * 정치·시사 분석 캐시 키.
 *
 * 메시지 ID 전량을 해시하면 고CPM에서 매 호출 집합이 달라져 히트율이 0이 된다.
 * 대신 (방송 제목, 큐시트 구성, 10초 시간 버킷, L1 통계 시그니처)로 결정한다.
 * L1 시그니처는 내용 구성이 같으면 같은 값이므로, 짧은 간격의 중복 분석을 실제로 차단한다.
 */
function buildTalkCacheKey(
  streamTitle: string,
  issues: LiveIssue[],
  stats: PrefilterStats,
): string {
  const issueSig = issues.map((i) => `${i.id}:${i.isActive ? 1 : 0}`).join(',');
  const bucket = Math.floor(Date.now() / 10_000); // 10초 버킷
  return crypto
    .createHash('sha1')
    .update(`talk|${streamTitle}|${issueSig}|${bucket}|${stats.signature}`)
    .digest('hex');
}

// API Route: 3-T. 정치·시사 실시간 분석 (6축 37태그 · 아젠다 · 리스크 레이더 · 미응답 요구)
app.post('/api/analyze/talk', async (req, res): Promise<any> => {
  const { messages, streamTitle, previousCpm } = req.body;
  const issues: LiveIssue[] = Array.isArray(req.body?.issues) ? req.body.issues : [];

  // [1] 입력 검증 — 댓글이 없으면 시뮬레이터의 빈 상태 응답 (UI 안전)
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.json({
      success: true,
      analysis: generateSimulatedTalkAnalysis([], issues),
    });
  }

  // [2] L1 — 키 유무와 무관하게 항상 전량 처리한다. 비용이 0이고,
  //     시뮬레이터 경로와 AI 경로가 같은 집계를 보게 해 결과 일관성이 유지된다.
  const stats = runPrefilter(messages, {
    previousCpm: typeof previousCpm === 'number' ? previousCpm : undefined,
    issueKeywords: issues.flatMap((i) => i.keywords ?? []),
    figures: issues.flatMap((i) => i.figures ?? []),
  });

  // [3] !ai 폴백 (로컬 시뮬레이터) — L1 결과를 재사용해 중복 계산을 피한다
  if (!ai) {
    console.log('No OPENAI_API_KEY detected. Using local politics simulator.');
    return res.json({
      success: true,
      analysis: generateSimulatedTalkAnalysis(messages, issues, stats),
      isSimulated: true,
      l1: summarizeL1(stats),
    });
  }

  // [4] 정상 경로 (OpenAI)
  try {
    const cacheKey = buildTalkCacheKey(streamTitle || '', issues, stats);
    const cached = getCachedAnalysis(cacheKey);
    if (cached) {
      logCacheStats();
      return res.json({
        success: true,
        analysis: { ...cached, analyzedAt: new Date().toLocaleTimeString() },
        cached: true,
        l1: summarizeL1(stats),
      });
    }

    const sample = stratifiedSample(stats, { size: 80 });

    // [A-1] system은 정적 프롬프트 그대로 (Prompt Caching prefix). user에는 호출별 데이터만.
    const userPrompt = `현재 방송 제목: "${streamTitle || '정치·시사 라이브'}"

[오늘의 큐시트]
${serializeIssues(issues)}

[채팅 집계 통계]
${formatStatsForPrompt(stats)}

[층화 표본 댓글 ${sample.items.length}건 — 원본 ${sample.representedMessages}건을 대표]
${formatSampleForPrompt(sample)}`;

    const response = await generateContentWithRetryAndFallback({
      systemPrompt: STATIC_TALK_ANALYZE_SYSTEM_PROMPT,
      userPrompt,
      schemaName: 'live_talk_analysis',
      jsonSchema: talkAnalyzeJsonSchema,
    });

    // axis는 스키마에 없다 — tag에서 파생해 주입한다 (normalizeTalk 주석 참조)
    const parsed = applyDerivedAxes(cleanAndParseJSON(response.text?.trim() || '{}'));
    parsed.analyzedAt = new Date().toLocaleTimeString();

    setCachedAnalysis(cacheKey, parsed);
    logCacheStats();

    return res.json({ success: true, analysis: parsed, l1: summarizeL1(stats) });
  } catch (err: any) {
    console.error('OpenAI talk analysis internal failure:', err);
    // Graceful recovery: 로컬 시뮬레이터로 즉시 복구하여 앱 흐름을 막지 않는다.
    return res.json({
      success: true,
      analysis: generateSimulatedTalkAnalysis(messages, issues, stats),
      l1: summarizeL1(stats),
      errorInfo: `정치·시사 AI 분석 중 지연이 발생하여 가상 분석 시스템으로 즉시 자동 복구되었습니다: ${err.message}`,
    });
  }
});

/** 프론트가 타임라인·경고에 쓰는 L1 요약 (원문·후보 배열은 제외해 페이로드를 작게 유지) */
function summarizeL1(stats: PrefilterStats) {
  return {
    total: stats.total,
    unique: stats.unique,
    dedupeRate: Number(stats.dedupeRate.toFixed(1)),
    authorCount: stats.authorCount,
    cpm: Math.round(stats.cpm),
    spike: stats.spike,
    riskCandidates: stats.riskCandidates.length,
    requestCandidates: stats.requestCandidates.length,
    brigading: stats.brigading.length,
  };
}

// API Route: 4-T. 정치·시사 종료 리포트
app.post('/api/report/talk', async (req, res): Promise<any> => {
  const { messages, streamTitle, peakCpm } = req.body;
  const issues: LiveIssue[] = Array.isArray(req.body?.issues) ? req.body.issues : [];

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, error: '분석에 필요한 댓글 목록이 비어 있습니다.' });
  }

  // 리포트도 L1을 거친다. 앞에서 150건을 자르는 방식(구 쇼핑 리포트)은 3시간 방송에서
  // 도입부만 보게 되어 방송 전체를 대표하지 못한다.
  const stats = runPrefilter(messages, {
    issueKeywords: issues.flatMap((i) => i.keywords ?? []),
    figures: issues.flatMap((i) => i.figures ?? []),
  });

  if (!ai) {
    console.log('No OPENAI_API_KEY detected. Using local politics report simulator.');
    return res.json({
      success: true,
      report: generateSimulatedTalkReport(messages, issues, peakCpm || 0),
      isSimulated: true,
    });
  }

  try {
    // 종료 리포트는 방송 전체를 대표해야 하므로 표본을 넉넉히 잡는다.
    const sample = stratifiedSample(stats, { size: 150 });

    const userPrompt = `[방송 정보]
- 방송 제목: "${streamTitle || '정치·시사 라이브'}"
- 총 수집 댓글 수: ${messages.length}개
- 최대 분당 댓글 수 (Peak CPM): ${peakCpm || 0} CPM

[오늘의 큐시트]
${serializeIssues(issues)}

[방송 전체 집계]
${formatStatsForPrompt(stats)}

[층화 표본 ${sample.items.length}건 — 원본 ${sample.representedMessages}건을 대표]
${formatSampleForPrompt(sample)}`;

    const response = await generateContentWithRetryAndFallback({
      systemPrompt: STATIC_TALK_REPORT_SYSTEM_PROMPT,
      userPrompt,
      schemaName: 'live_talk_report',
      jsonSchema: talkReportJsonSchema,
    });

    const parsed = cleanAndParseJSON(response.text?.trim() || '{}');
    parsed.generatedAt = new Date().toLocaleString();
    return res.json({ success: true, report: parsed });
  } catch (err: any) {
    console.error('OpenAI talk report generation internal failure:', err);
    return res.json({
      success: true,
      report: generateSimulatedTalkReport(messages, issues, peakCpm || 0),
      errorInfo: `정치·시사 리포트 생성 중 지연이 발생하여 가상 리포트로 자동 복구되었습니다: ${err.message}`,
    });
  }
});

// ── 크로스세션 (P-11) ────────────────────────────────────────────────────────
//
// 매일 방송 + 고정 시청층이 자산이 되는 지점. 회차 요약을 저장하고 회차 비교·아젠다 추이·
// 단골 누적·미해소 요구 이월을 계산한다.
//
// ⚠️ D-8: 저장되는 것은 집계치 + 참여자 **해시**뿐이다. 원문 닉네임·댓글은 저장하지 않는다.
//   SUPABASE_URL 미설정 시 로컬 파일로 폴백하므로 설정 없이도 동작한다.

// API Route: 5-T. 회차 저장 (방송 종료 시)
app.post('/api/sessions', async (req, res): Promise<any> => {
  const { id, title, startedAt, endedAt, analysis, report, timelineAvgHeat, peakCpm, authors } = req.body ?? {};

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ success: false, error: '회차 id가 필요합니다.' });
  }

  try {
    const record = buildSessionRecord({
      id,
      title: title || '제목 없는 방송',
      startedAt: startedAt || new Date().toISOString(),
      endedAt,
      analysis: analysis ?? null,
      report: report ?? null,
      timelineAvgHeat: typeof timelineAvgHeat === 'number' ? timelineAvgHeat : 0,
      peakCpm: typeof peakCpm === 'number' ? peakCpm : 0,
      authors: Array.isArray(authors) ? authors : [],
    });

    const store = getSessionStore();
    await store.save(record);
    const pruned = await store.prune(DEFAULT_RETENTION_DAYS);
    if (pruned > 0) console.log(`[SessionStore] 보존기간(${DEFAULT_RETENTION_DAYS}일) 초과 ${pruned}건 정리`);

    return res.json({
      success: true,
      saved: { id: record.id, participantCount: record.participantHashes.length },
      store: store.kind,
      pruned,
    });
  } catch (err: any) {
    console.error('Session save failure:', err);
    // 크로스세션은 부가 기능이다 — 실패해도 방송 진행을 막지 않는다
    return res.status(500).json({ success: false, error: `회차 저장에 실패했습니다: ${err.message}` });
  }
});

// API Route: 6-T. 회차 히스토리 + 파생 (회차 비교 · 아젠다 추이 · 단골 · 이월)
app.get('/api/sessions/history', async (req, res): Promise<any> => {
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 30));
  const currentId = typeof req.query.currentId === 'string' ? req.query.currentId : null;

  try {
    const store = getSessionStore();
    const history = await store.list(limit);

    const current = currentId ? history.find((r) => r.id === currentId) ?? null : history[0] ?? null;

    return res.json({
      success: true,
      store: store.kind,
      sessions: history.map((r) => ({
        // 목록에는 해시 배열을 실어보내지 않는다 — 페이로드도 줄고 노출면도 줄인다
        ...r,
        participantHashes: undefined,
        participantCount: r.participantHashes.length,
      })),
      comparison: current ? compareToPrevious(current, history) : null,
      agendaTrends: buildAgendaTrends(history),
      returning: buildReturningStats(history),
      carryOver: buildCarryOver(history),
      retentionDays: DEFAULT_RETENTION_DAYS,
    });
  } catch (err: any) {
    console.error('Session history failure:', err);
    return res.status(500).json({ success: false, error: `회차 기록을 불러오지 못했습니다: ${err.message}` });
  }
});

// Setup Vite Dev server middleware or static serve in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server starting... Listening exclusively on outer dynamic entry Port ${PORT}`);
  });
}

// Only auto-start when run directly (local dev / node start).
// On Vercel, api/index.ts imports `app` without triggering listen.
if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app };
