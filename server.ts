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
} from './src/prompts.js';
import { generateSimulatedShopAnalysis, generateSimulatedShopReport } from './src/lib/simulateShopAnalysis.js';
import type { LiveProduct } from './src/types/liveShopping.js';

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

// Predefined simulated stream messages for Demo Mode (Shopping Live Host / Tech Launch)
const SIMULATED_CHAT_RESOURCES = [
  { author: "김민수", message: "안녕하세요! 오늘 방송 정말 기대되네요~!", isSponsor: true },
  { author: "이지혜", message: "와 벌써 사람 많이 들어왔네요! 반갑습니다.", isSponsor: false },
  { author: "박태형", message: "소리가 잘 안들려요.. 마이크 소리 좀 키워주세요!", isSponsor: false },
  { author: "Sonia Yang", message: "이거 혹시 오늘 구매하면 언제 배송 시작되나요??", isSponsor: false },
  { author: "정우진", message: "방송 화질 설정 1080p 지원하나요? 아주 선명해요!", isSponsor: false },
  { author: "최유리", message: "구매 주소(링크) 올려주세요! 바로 사고 싶어요.", isSponsor: false },
  { author: "한상현", message: "가격대비 성능비 괜찮아 보이네요. 디자인도 깔끔하고.", isSponsor: true },
  { author: "미니미", message: "소리가 약간 울리는 것 같은데 저만 그런가요??", isSponsor: false },
  { author: "강동우", message: "초록색 색상 재고 얼마 안 남았나요? 급합니다!", isSponsor: false },
  { author: "윤서연", message: "지인 추천 받고 들어왔는데 호스트분 진행 엄청 잘하시네요 ㅋㅋ", isSponsor: false },
  { author: "임재범", message: "방금 결제 완료했습니다! 배송 빠르게 부탁드려요!!!", isSponsor: true },
  { author: "블루스카이", message: "이거 화이트 색상 실물 크기가 어느 정도 되나요?", isSponsor: false },
  { author: "박지원", message: "채팅창 넘 빨라서 정신이 없네ㅋㅋ 화이팅입니다!", isSponsor: false },
  { author: "정수진", message: "끊김이 좀 심해졌어요 확인부탁드려요 ㅠㅠ", isSponsor: false },
  { author: "Harry Park", message: "쿠폰 적용이 왜 안 되는거죠? 해결 방법 아시는 분?", isSponsor: false },
  { author: "송지효", message: "진짜 갖고 싶었는데 드디어 출시됐네... 무조건 삽니다.", isSponsor: false },
  { author: "마카롱", message: "질문있어요! 무상 A/S 기간은 몇 년 보장되나요??", isSponsor: true },
  { author: "김준호", message: "와 사은품 혜택 선착순인가요? 아직 유효한가요?", isSponsor: false },
  { author: "미래지향", message: "화질이 멈춰있어요.. 버퍼링 걸린 듯", isSponsor: false },
  { author: "달빛요정", message: "방송 보면서 결제 창 띄우고 있습니다! 할인코드 알려주세요!", isSponsor: false },
  { author: "이도원", message: "제품 상세 설명이 필요합니다. 크기랑 규격이 궁금해요.", isSponsor: false },
  { author: "서미경", message: "믿고 지릅니다!! 얼른 와라 배송아 ㅋㅋㅋ", isSponsor: false },
  { author: "정상현", message: "저번 방송 보고 샀는데 대만족이에요. 다들 고민 말고 사삼", isSponsor: true },
  { author: "쿠쿠다스", message: "댓글 소통 최고네요! 실시간 피드백 빠르십니다.", isSponsor: false },
  { author: "차은우사랑", message: "사고 싶은데 가격이 조오금 부담스럽네요. 혹시 할부 혜택도 있나요?", isSponsor: false }
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
      title: '🔴 [실시간 쇼핑] LiveChat Radar AI 연동 혁신 신제품 론칭 라이브!',
      channelName: 'LiveChat Radar Tech',
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
