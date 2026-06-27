/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 공용 프론트 타입. 라이브 쇼핑 분석 계약은 src/types/liveShopping.ts 참조.
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
  // 프론트 경량 힌트 태그 (AI 분석 전 피드 색상용)
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
