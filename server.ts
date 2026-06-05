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
  STATIC_ANALYZE_SYSTEM_PROMPT,
  STATIC_REPORT_SYSTEM_PROMPT,
  analyzeJsonSchema,
  reportJsonSchema,
} from './src/prompts';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

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

// Mock/Simulated AI Analysis output if OpenAI API or Credit is missing or overloaded to guarantee zero errors
function generateSimulatedAIAnalysis(messages: any[]): any {
  if (!messages || messages.length === 0) {
    return {
      sentiment: { positive: 50, neutral: 50, negative: 0 },
      topKeywords: [],
      faq: [],
      specialComments: [],
      recentSummary: "수집된 실시간 댓글이 부족하여 분석 대기 중입니다.",
      presenterActions: [
        { type: "info", message: "시청자들의 댓글이 수집되면 실시간 조연출이 동작합니다.", target: "진행" }
      ],
      suggestedTopic: "시청자들과 가볍게 소통을 나누며 댓글 작성을 유도해 보세요!",
      analyzedAt: new Date().toLocaleTimeString()
    };
  }

  // 1. Smart Keyword Extraction (Korean heuristic filtering particle endings)
  const stopWords = new Set([
    '오늘', '진짜', '너무', '그냥', '진짜로', '방송', '보고', '은요', '는요', '은', '는', '이', '가', '을', '를',
    '에', '의', '로', '으로', '고', '도', '과', '와', '한', '해서', '요', '거', '것', '합니다', '있습니다', '있네요',
    '아주', '매우', '약간', '이거', '혹시', '지금', '어디', '어떻게', '왜', '누구', '무슨', '아', '오', '우', '와우'
  ]);

  const wordCounts: { [key: string]: number } = {};
  messages.forEach(m => {
    const text = m.message || '';
    // Clean punctuation
    const words = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/);
    words.forEach((w: string) => {
      let cleanWord = w.trim();
      if (cleanWord.length > 1) {
        // Simple trim of postpositional endings
        if (cleanWord.endsWith('은') || cleanWord.endsWith('는') || cleanWord.endsWith('이') || cleanWord.endsWith('가') || cleanWord.endsWith('을') || cleanWord.endsWith('를') || cleanWord.endsWith('에') || cleanWord.endsWith('도') || cleanWord.endsWith('과') || cleanWord.endsWith('와')) {
          cleanWord = cleanWord.slice(0, -1);
        }
        if (cleanWord.length > 1 && !stopWords.has(cleanWord)) {
          wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
        }
      }
    });
  });

  const sortedKeywords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([keyword, count]) => ({
      keyword,
      count,
      trend: count > 3 ? "up" : "stable"
    }));

  // Fallback default keywords if none captured
  if (sortedKeywords.length === 0) {
    sortedKeywords.push({ keyword: "소통", count: 2, trend: "stable" });
    sortedKeywords.push({ keyword: "투표", count: 1, trend: "stable" });
  }

  // 2. Identify custom special comments (Purchase signals / Tech errors / Complaints)
  const specialComments: any[] = [];
  let purchaseSignals = 0;
  let streamIssues = 0;
  let complaints = 0;

  messages.forEach(m => {
    const text = m.message || '';
    if (text.includes('소리') || text.includes('마이크') || text.includes('끊김') || text.includes('멈춤') || text.includes('랙') || text.includes('버퍼링') || text.includes('싱크') || text.includes('화향')) {
      streamIssues++;
      if (specialComments.length < 5) {
        specialComments.push({
          text,
          author: m.author,
          category: 'stream_issue',
          reason: '인터넷 수신율 또는 소리/음량 피드백 감지'
        });
      }
    } else if (text.includes('정말 사고') || text.includes('구매') || text.includes('얼마') || text.includes('할인') || text.includes('가격') || text.includes('결제') || text.includes('배송') || text.includes('특전')) {
      purchaseSignals++;
      if (specialComments.length < 5) {
        specialComments.push({
          text,
          author: m.author,
          category: 'purchase_signal',
          reason: '상품 결제, 무료 특전, 수하물 배송일 정밀 문의'
        });
      }
    } else if (text.includes('답답') || text.includes('불만') || text.includes('화나') || text.includes('조롱') || text.includes('신경') || text.includes('거부') || text.includes('정치') || text.includes('반대')) {
      complaints++;
      if (specialComments.length < 5) {
        specialComments.push({
          text,
          author: m.author,
          category: 'complaint',
          reason: '시청자 불만 의심 및 적극적 비판 반향 피드백 수집'
        });
      }
    }
  });

  // Populate default special comments if none discovered
  if (specialComments.length === 0) {
    // Find some active chat messages to use
    const candidates = messages.slice(-2);
    candidates.forEach(c => {
      specialComments.push({
        text: c.message,
        author: c.author,
        category: 'purchase_signal',
        reason: '시청자의 실시간 소통 인게이지먼트 증폭 지점'
      });
    });
  }

  // 3. Formulate Dynamic FAQ based on actual questions asked by users
  const faq: any[] = [];
  const questionMessages = messages.filter(m => m.message && (m.message.includes('?') || m.message.includes('요?') || m.message.includes('가요') || m.message.includes('나요')));
  
  if (questionMessages.length > 0) {
    questionMessages.slice(0, 3).forEach((qm, idx) => {
      faq.push({
        question: qm.message.length > 25 ? qm.message.slice(0, 25) + '...' : qm.message,
        count: Math.floor(Math.random() * 2) + 2,
        templateAnswer: `항상 경청해 주셔서 깊이 감사드립니다! ${qm.author}님께서 달아주신 유익한 질문에 즉시 답해 드리겠습니다. 저희 방송 가이드와 노하우를 바탕으로 자세한 답변과 혜택을 전해드리니 꼭 참고하세요!`
      });
    });
  }

  // Add default robust FAQs if we don't have enough questions
  if (faq.length < 2) {
    faq.push({
      question: "실시간 투표 및 향후 일정 공지는 어디서 보나요?",
      count: 4,
      templateAnswer: "채널 상단 커뮤니티 탭 고정글을 통해 상시 업데이트 중입니다. 구독 알림을 켜두시면 다음 예고를 더 빨리 받아보실 수 있습니다!"
    });
    faq.push({
      question: "정규 편성 시간 외에 긴급 임시 라이브도 하시나요?",
      count: 3,
      templateAnswer: "중요한 현안이 터지거나 새로운 여론지표 평론이 필요할 때 언제든 실시간 긴급 번개 평론 방송을 열고 있습니다!"
    });
  }

  // 4. Sentiment Scoring
  const basePositive = 45 + (purchaseSignals * 6);
  const baseNegative = 10 + (complaints * 5) + (streamIssues * 3);
  const positive = Math.max(10, Math.min(85, basePositive));
  const negative = Math.max(5, Math.min(45, baseNegative));
  const neutral = 100 - positive - negative;

  // 5. Dynamic Summary Text
  const primaryTerm = sortedKeywords[0]?.keyword || "방송 소통";
  const secondaryTerm = sortedKeywords[1]?.keyword || "지지자";
  const recentSummary = `최근 댓글 피드에서 '${primaryTerm}'(와)과 '${secondaryTerm}'을(를) 화두로 활발해진 시청자 상호작용이 포착되고 있습니다. 전반적으로 에너지 가득하고 깊이 몰입적인 정서가 안정적으로 유지되고 있습니다.`;

  // 6. Dynamic Presenter Recommended Actions
  const presenterActions = [
    {
      type: streamIssues > 0 ? "urgent" : "info",
      message: streamIssues > 0 
        ? `🎙️ '${primaryTerm}' 이슈 및 송출 품질 간헐 피드백이 감지되었습니다. 인터넷 오디오 환경을 가볍게 점검해 주세요.`
        : `💬 시청자분들이 지금 '${primaryTerm}' 주제에 깊이 공감하고 있습니다! 이 타이밍에 질문을 주신 분들의 아이디를 언급해주시면 좋습니다.`,
      target: "소통"
    },
    {
      type: "action",
      message: `🗳️ '${secondaryTerm}' 관련 멘트를 가볍게 엮으시면서, "의견이 좋았다면 추천과 구독 한번씩 꼭 부탁드린다"고 채널 참여 화력을 이끌어내 보세요!`,
      target: "진행"
    }
  ];

  return {
    sentiment: { positive, neutral, negative },
    topKeywords: sortedKeywords,
    faq,
    specialComments,
    recentSummary,
    presenterActions,
    suggestedTopic: `'${primaryTerm}'에 과연 어떠한 생각들이 있으신지, 실시간 시청자분들의 생생한 소감을 댓글창에 자유롭게 남겨달라고 이끌어주세요!`,
    analyzedAt: new Date().toLocaleTimeString()
  };
}

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

// API Route: 3. Core AI Analysis Proxy using OpenAI (gpt-4o-mini primary / gpt-4o fallback)
app.post('/api/analyze', async (req, res): Promise<any> => {
  const { messages, streamTitle } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.json({
      success: true,
      analysis: {
        sentiment: { positive: 50, neutral: 50, negative: 0 },
        topKeywords: [],
        faq: [],
        specialComments: [],
        recentSummary: "충분한 실시간 댓글이 수집되지 않았습니다. 실시간 댓글이 쌓이면 AI 분석을 개시합니다.",
        presenterActions: [{ type: "info", message: "시청자들의 댓글 수집을 시작하고 있습니다. 잠시만 대기해주세요.", target: "진행" }],
        suggestedTopic: "시청자들에게 가볍게 하이파이브나 날씨 인사를 구하면서 댓글 유도를 해보세요!",
        analyzedAt: new Date().toLocaleTimeString()
      }
    });
  }

  // Fallback to offline simulation if OpenAI key is not loaded.
  // DEMO/시뮬레이터 경로는 응답 캐시 우회 — 시뮬레이터의 무작위성을 그대로 노출해야 자연스러움.
  if (!ai) {
    console.log("No OPENAI_API_KEY detected. Using High-Fidelity local simulation analyzer.");
    const simResult = generateSimulatedAIAnalysis(messages);
    return res.json({ success: true, analysis: simResult, isSimulated: true });
  }

  try {
    // We send a sliding window of recent messages
    const windowOffset = Math.max(0, messages.length - 80);
    const targetMessages = messages.slice(windowOffset);

    // [A-2] 응답 캐시 확인 — 동일 (streamTitle, message IDs) 조합이 TTL 내 재호출되면 즉시 반환.
    const cacheKey = buildAnalyzeCacheKey(streamTitle || '', targetMessages);
    const cached = getCachedAnalysis(cacheKey);
    if (cached) {
      logCacheStats();
      // analyzedAt만 새로 — UI는 "방금 분석" 표시를 그대로 보여줘도 의미 동일
      return res.json({ success: true, analysis: { ...cached, analyzedAt: new Date().toLocaleTimeString() }, cached: true });
    }

    const serializedComments = targetMessages
      .map((m) => `[ID:${m.id}] ${m.author}: "${m.message}"`)
      .join('\n');

    // [A-1] system은 STATIC_ANALYZE_SYSTEM_PROMPT 그대로 — Prompt Caching prefix.
    // user에는 호출별로 바뀌는 데이터만 (제목, 댓글, 카운트).
    const userPrompt = `현재 방송 제목: "${streamTitle || '실시간 라이브 방송'}"
수집된 실시간 최신 댓글 목록 (${targetMessages.length}개):
${serializedComments}`;

    const response = await generateContentWithRetryAndFallback({
      systemPrompt: STATIC_ANALYZE_SYSTEM_PROMPT,
      userPrompt,
      schemaName: 'live_chat_analysis',
      jsonSchema: analyzeJsonSchema,
    });

    const cleanText = response.text?.trim() || '';
    const parsingObj = cleanAndParseJSON(cleanText);
    parsingObj.analyzedAt = new Date().toLocaleTimeString();

    // 캐시 저장 — analyzedAt 제외한 본체만 저장하면 hit 시 새 timestamp 부여 가능.
    // 단순화를 위해 통째로 저장하고 hit 시 spread로 덮어쓴다.
    setCachedAnalysis(cacheKey, parsingObj);
    logCacheStats();

    return res.json({ success: true, analysis: parsingObj });
  } catch (err: any) {
    console.error('OpenAI Analysis internal failure:', err);
    // Graceful error recovery: Use simulated backup analysis to avoid blocking the app
    const fallbackAns = generateSimulatedAIAnalysis(messages);
    return res.json({
      success: true,
      analysis: fallbackAns,
      errorInfo: `AI 분석 호출 도중 지연이 발생하여 가상 분석 시스템으로 즉시 자동 복구되었습니다: ${err.message}`
    });
  }
});

// API Route: 4. Post-stream wrap-up report generation
app.post('/api/report', async (req, res): Promise<any> => {
  const { messages, streamTitle, peakCpm } = req.body;
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, error: '분석에 필요한 댓글 목록이 비어 있습니다.' });
  }

  // Graceful local compilation fallback if OpenAI key is missing
  if (!ai) {
    const reportText = `# 📊 LiveChat Radar 방송 종합 분석 리포트

## 1. 📈 방송 개요 및 주요 통계
- **라이브 타이틀**: ${streamTitle || '실시간 온라인 라이브'}
- **수집된 전체 댓글 수**: ${messages.length}개
- **최고 순간 분당 댓글 수 (Peak CPM)**: ${peakCpm || 24} CPM
- **지배적 시청 정서**: 😊 긍정 (수집 댓글 중 약 74% 차지)

---

## 2. 🔥 최고조 소통 모먼트 (Hot Moment)
- 방송 시작 후 약 10분경 제품의 실물 규격과 사은품 수량을 공개했던 시기에 분당 대화 강도가 가장 높았습니다.
- 가격 정보 공개 직후 "대박이다", "믿고 바로 산다"라는 긍정 피드백과 함께 구매 사이트 링크 요청이 최대치를 기록했습니다.

---

## 3.  핵심 해결/미해결 FAQ와 답변 요약
- **질문 1:** 무상 A/S 정책 및 보장 범위는?
  - **피드백:** 무상 2년 및 온라인 원스톱 접수처를 소개해 깔끔하게 궁금증이 해결되었습니다.
- **질문 2:** 당일 출고 여부 및 주말 배송 기간은?
  - **피드백:** 우체국 익일 빠른 특급 배송 약속을 하여 시청자 구매 동기를 높였습니다.

---

## 4. 📢 구매 의사/불만/방송 상태 시그널 분석
- **구매 전환 시그널**: 총 ${Math.floor(messages.length * 0.15)}회 검출. 할인 혜택 조합과 라이브 전용 한정 특별 사은품이 시청자들에게 신선한 구매 자극으로 입증되었습니다.
- **시청자 불편 호소**: 총 ${Math.floor(messages.length * 0.05)}회 검출. 오디오 미세 반향(울림) 및 버퍼링에 대한 마이너 의견이 간간이 관측되었습니다.

---

## 5. 💡 다음 방송 성공을 위한 필살 전략 제안
1. **기술 환경 사전 최적화**: 마이크 게인 조절 및 소음 억제 필터를 무조건 활성화하여 세팅할 것.
2. **할인 소구 방식 강화**: 라이브 전용 쿠폰 스티커 그래픽을 화면 자막 레이아웃에 직접 상시 표기하여 시청자가 뒤늦게 입장해도 헤매지 않도록 배려할 것.
3. **참여형 코너 강화**: 진행 중에 시청자 선호 색상을 실시간 설문(투표)을 받아 순위를 매기는 인터랙티브 미션을 중간에 배치하십시오.
`;

    return res.json({
      success: true,
      report: {
        reportMarkdown: reportText,
        summaryStats: {
          totalMessages: messages.length,
          peakCpm: peakCpm || 24,
          dominantSentiment: '긍정 및 기대감 충만 (74%)',
          resolvedFaqsCount: 3
        },
        generatedAt: new Date().toLocaleString()
      },
      isSimulated: true
    });
  }

  try {
    const serializedComments = messages
      .slice(0, 150) // Cap to avoid context overflow for a standard prompt MVP
      .map(m => `${m.author}: "${m.message}"`)
      .join('\n');

    // [A-1] system은 STATIC_REPORT_SYSTEM_PROMPT 그대로 — Prompt Caching prefix.
    // user에는 호출별 가변 데이터(제목, 카운트, peakCpm, 댓글 본문)만.
    const userPrompt = `[방송 정보]
- 방송 제목: "${streamTitle || '실시간 소통 라이브'}"
- 총 수집된 실시간 댓글 수 : ${messages.length}개
- 최대 분당 댓글 수 (Peak CPM): ${peakCpm || 18} CPM

[댓글 전반 데이터]
${serializedComments}`;

    const response = await generateContentWithRetryAndFallback({
      systemPrompt: STATIC_REPORT_SYSTEM_PROMPT,
      userPrompt,
      schemaName: 'live_chat_report',
      jsonSchema: reportJsonSchema,
    });

    const parsed = cleanAndParseJSON(response.text?.trim() || '{}');
    parsed.generatedAt = new Date().toLocaleString();
    return res.json({ success: true, report: parsed });
  } catch (err: any) {
    console.error('OpenAI report generation internal failure:', err);
    return res.status(500).json({ success: false, error: `종료 리포트 생성 실패: ${err.message}` });
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
