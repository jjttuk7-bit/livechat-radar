import assert from 'node:assert/strict';
import { formatDuration, summarizeBlock } from './productBlocks';
import type { ProductBlock, ShopTimelinePoint } from '../types/liveShopping';

function tp(t: number, purchased: number): ShopTimelinePoint {
  return { t, cpm: 0, purchaseTemp: 0, priceResistance: 0, unansweredCount: 0, purchased };
}

function testSummarize() {
  const base = Date.parse('2026-01-01T00:00:00Z');
  const block: ProductBlock = {
    id: 'b1', productId: 'p1', name: '크림',
    startedAt: new Date(base).toISOString(),
    endedAt: new Date(base + 120_000).toISOString(), // 2분
  };
  const messages = [
    { timestamp: new Date(base + 10_000).toISOString() },  // 블록 내
    { timestamp: new Date(base + 60_000).toISOString() },  // 블록 내
    { timestamp: new Date(base + 200_000).toISOString() }, // 블록 밖
  ];
  const timeline = [tp(base - 1000, 2), tp(base + 30_000, 3), tp(base + 119_000, 6), tp(base + 130_000, 9)];
  const s = summarizeBlock(block, messages, timeline);
  assert.equal(s.durationSec, 120, '2분 구간');
  assert.equal(s.comments, 2, '블록 내 댓글 2');
  assert.equal(s.purchased, 4, '구매 6-2=4 (블록 시작~끝)');
  assert.equal(s.isLive, false, '종료된 블록');
}

function testLiveBlock() {
  const now = Date.now();
  const block: ProductBlock = { id: 'b', productId: 'p', name: 'x', startedAt: new Date(now - 30_000).toISOString(), endedAt: null };
  const s = summarizeBlock(block, [], [], now);
  assert.ok(s.durationSec >= 29 && s.durationSec <= 31, '진행중 구간 ~30초');
  assert.equal(s.isLive, true, '진행중');
}

function testFormat() {
  assert.equal(formatDuration(45), '45초');
  assert.equal(formatDuration(125), '2분 5초');
}

testSummarize();
testLiveBlock();
testFormat();

console.log('productBlocks tests passed');
