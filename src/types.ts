/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChatMessage {
  id: string;
  author: string;
  avatar: string;
  message: string;
  timestamp: string; // ISO or date string
  isSponsor?: boolean;
  isModerator?: boolean;
  isOwner?: boolean;
  // Detected tags by frontend patterns or local filters
  category?: 'complaint' | 'purchase_signal' | 'stream_issue' | null;
  reason?: string;
}

export interface StreamInfo {
  videoId: string;
  activeLiveChatId: string | null;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  publishedAt?: string;
  isDemo?: boolean;
}

export interface SentimentData {
  positive: number; // percentage (0-100)
  neutral: number;  // percentage (0-100)
  negative: number; // percentage (0-100)
}

export interface KeywordData {
  keyword: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
}

export interface FAQItem {
  question: string;
  count: number;
  templateAnswer: string;
}

export interface SpecialComment {
  text: string;
  author: string;
  category: 'complaint' | 'purchase_signal' | 'stream_issue';
  reason: string;
}

export interface PresenterAction {
  type: 'urgent' | 'info' | 'action';
  message: string;
  target: string; // e.g., "음향", "소통", "상품소개", "진행"
}

export interface AnalysisResult {
  sentiment: SentimentData;
  topKeywords: KeywordData[];
  faq: FAQItem[];
  specialComments: SpecialComment[];
  recentSummary: string;
  presenterActions: PresenterAction[];
  suggestedTopic: string;
  analyzedAt: string;
}

export interface ReportResult {
  reportMarkdown: string;
  summaryStats: {
    totalMessages: number;
    peakCpm: number;
    dominantSentiment: string;
    resolvedFaqsCount: number;
  };
  generatedAt: string;
}

// ── Timeline (B-4): 방송 흐름 추이 데이터 ─────────────────────────────────
// 클라이언트 메모리에만 누적. 새 stream 연결 시 초기화.

export interface CpmPoint {
  t: number;       // Unix ms timestamp (X축)
  cpm: number;     // 그 시점의 분당 댓글 수
}

export interface SentimentSnapshot {
  t: number;
  positive: number;  // %
  neutral: number;
  negative: number;
}

export interface CategorySnapshot {
  t: number;
  purchase_signal: number;  // specialComments 내 카운트
  stream_issue: number;
  complaint: number;
}
