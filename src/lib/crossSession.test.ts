/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 크로스세션 파생 + 저장 계약 테스트 (P-11).
 *
 * 기능 검증과 함께 **D-8 회귀**를 고정한다: 원문 닉네임이 저장 경로에 들어오면 실패해야 한다.
 */

import {
  buildSessionRecord,
  compareToPrevious,
  buildAgendaTrends,
  buildReturningStats,
  buildCarryOver,
} from './crossSession.js';
import { hashAuthor, assertNoRawAuthors, FileStore } from './sessionStore.js';
import type { SessionRecord, TalkAnalysisResult, TalkReportResult } from '../types/liveTalk.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`✗ ${msg}`);
    failed++;
  }
}

function mkRecord(
  id: string,
  day: string,
  authors: string[],
  agenda: { title: string; interestScore: number }[] = [],
  over: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    id,
    title: `${day} 방송`,
    startedAt: `2026-08-${day}T10:00:00.000Z`,
    endedAt: `2026-08-${day}T12:00:00.000Z`,
    totalMessages: 1000,
    peakCpm: 120,
    avgRallyHeat: 50,
    supportCount: 10,
    riskCount: 3,
    unansweredCount: 4,
    answerRate: 80,
    agenda: agenda.map((a) => ({ ...a, mentionCount: a.interestScore })),
    carryOverRequests: [],
    participantHashes: authors.map((a) => hashAuthor(a, 'test-salt')),
    ...over,
  };
}

// ── 1. 레코드 생성 — 원문이 떨어져 나가는가 ──────────────────────────────────
const analysis: TalkAnalysisResult = {
  analyses: [],
  metrics: [],
  actionCards: [],
  unanswered: [
    { id: 'u1', text: '예산안 처리 일정이 어떻게 되나요?', author: '시청자A', askedAt: '', issueId: null, tag: 'factual_question', urgency: 'medium', suggestedAnswer: null },
  ],
  agendaInterest: [
    { issueId: 'i1', title: '예산안 처리', interestScore: 80, mentionCount: 40, requestCount: 10, isRising: true },
  ],
  riskAlerts: [],
  faq: [],
  recentSummary: '',
  hostAdvice: '',
};

const report: TalkReportResult = {
  reportMarkdown: '# 리포트',
  summaryStats: {
    totalMessages: 1500, peakCpm: 200, topAgenda: '예산안 처리',
    supportCount: 12, unansweredCount: 1, answerRate: 90, riskCount: 2,
  },
};

const rec = buildSessionRecord({
  id: 'sess-1',
  title: '8월 12일 방송',
  startedAt: '2026-08-12T10:00:00.000Z',
  analysis,
  report,
  timelineAvgHeat: 55.4,
  peakCpm: 200,
  authors: ['시청자A', '시청자B', '시청자A'],
});

assert(rec.totalMessages === 1500, '리포트 통계 반영');
assert(rec.avgRallyHeat === 55, '평균 결집 온도 반올림');
assert(rec.agenda.length === 1 && rec.agenda[0].title === '예산안 처리', '아젠다 보관');
assert(rec.carryOverRequests.length === 1, '미해소 요구 이월 보관');

// D-8: 참여자는 해시로만, 중복 제거
assert(rec.participantHashes.length === 2, `고유 참여자 2명 (실제 ${rec.participantHashes.length})`);
for (const h of rec.participantHashes) {
  assert(/^[0-9a-f]{32}$/.test(h), `해시 형식이어야 함: ${h}`);
  assert(h !== '시청자A' && h !== '시청자B', 'D-8 위반: 원문 닉네임이 저장됨');
}

// 저장 레코드 어디에도 원문 닉네임이 남아 있으면 안 된다
const serialized = JSON.stringify(rec);
assert(!serialized.includes('시청자A'), 'D-8 위반: 직렬화 결과에 원문 닉네임 포함');
assert(!serialized.includes('시청자B'), 'D-8 위반: 직렬화 결과에 원문 닉네임 포함');

// ── 2. D-8 가드가 실제로 막는가 ──────────────────────────────────────────────
let guarded = false;
try {
  assertNoRawAuthors({ ...rec, participantHashes: ['시청자A'] });
} catch {
  guarded = true;
}
assert(guarded, 'D-8 가드: 원문 닉네임 저장 시도를 막아야 함');

// 해시는 결정적이어야 단골 인식이 가능하다
assert(hashAuthor('홍길동', 's') === hashAuthor('홍길동', 's'), '같은 salt·입력이면 같은 해시');
assert(hashAuthor('홍길동', 's1') !== hashAuthor('홍길동', 's2'), 'salt가 다르면 다른 해시');

// ── 3. 회차 비교 ─────────────────────────────────────────────────────────────
const s1 = mkRecord('s1', '10', ['A', 'B', 'C']);
const s2 = mkRecord('s2', '11', ['B', 'C', 'D'], [], { totalMessages: 1200, peakCpm: 150, avgRallyHeat: 60, answerRate: 70 });

const cmp = compareToPrevious(s2, [s1, s2]);
assert(cmp.previous?.id === 's1', '직전 회차를 찾아야 함');
assert(cmp.deltas?.totalMessages === 200, `댓글 델타 200 (실제 ${cmp.deltas?.totalMessages})`);
assert(cmp.deltas?.answerRate === -10, `응답률 델타 -10 (실제 ${cmp.deltas?.answerRate})`);
assert(cmp.returningCount === 2, `재방문 2명(B,C) (실제 ${cmp.returningCount})`);
assert(cmp.returningRate === 67, `재방문율 67% (실제 ${cmp.returningRate})`);

const firstEver = compareToPrevious(s1, [s1]);
assert(firstEver.previous === null && firstEver.deltas === null, '첫 회차는 비교 대상 없음');
assert(firstEver.returningCount === 0, '첫 회차 재방문 0');

// ── 4. 아젠다 추이 ───────────────────────────────────────────────────────────
const h1 = mkRecord('h1', '10', ['A'], [{ title: '예산안', interestScore: 40 }, { title: '청문회', interestScore: 70 }]);
const h2 = mkRecord('h2', '11', ['A'], [{ title: '예산안', interestScore: 60 }, { title: '청문회', interestScore: 65 }]);
const h3 = mkRecord('h3', '12', ['A'], [{ title: '예산안', interestScore: 85 }]);

const trends = buildAgendaTrends([h3, h1, h2]); // 입력 순서가 섞여 있어도 정렬해야 함
const budget = trends.find((t) => t.title === '예산안')!;
const hearing = trends.find((t) => t.title === '청문회')!;

assert(budget.points.length === 3, `예산안 3회차 (실제 ${budget.points.length})`);
assert(budget.direction === 'rising', `예산안 상승 (실제 ${budget.direction})`);
assert(budget.streak === 3, `예산안 연속 3회 (실제 ${budget.streak})`);
assert(hearing.streak === 0, `청문회는 최신 회차에 없으므로 streak 0 (실제 ${hearing.streak})`);
assert(
  budget.points[0].interestScore === 40,
  '추이는 오래된 것부터 정렬되어야 함',
);

// 소폭 변동은 flat — 매 회차 방향이 뒤집히면 신호로 쓸 수 없다
const f1 = mkRecord('f1', '10', ['A'], [{ title: '소폭', interestScore: 50 }]);
const f2 = mkRecord('f2', '11', ['A'], [{ title: '소폭', interestScore: 53 }]);
assert(buildAgendaTrends([f1, f2])[0].direction === 'flat', '소폭 변동은 flat');

// ── 5. 단골 누적 ─────────────────────────────────────────────────────────────
const stats = buildReturningStats([
  mkRecord('r1', '10', ['A', 'B', 'C']),
  mkRecord('r2', '11', ['A', 'B']),
  mkRecord('r3', '12', ['A']),
]);

assert(stats.sessions === 3, '회차 3');
assert(stats.uniqueParticipants === 3, `고유 참여자 3 (실제 ${stats.uniqueParticipants})`);
assert(stats.returning === 2, `2회 이상 참여 2명(A,B) (실제 ${stats.returning})`);
assert(stats.core === 2, `절반(2회) 이상 참여 2명 (실제 ${stats.core})`);
assert(stats.returningRate === 67, `재방문율 67% (실제 ${stats.returningRate})`);
assert(
  stats.distribution.reduce((n, d) => n + d.count, 0) === stats.uniqueParticipants,
  '분포 합이 고유 참여자 수와 같아야 함',
);

const emptyStats = buildReturningStats([]);
assert(emptyStats.uniqueParticipants === 0 && emptyStats.returningRate === 0, '빈 입력 안전');

// ── 6. 이월 ──────────────────────────────────────────────────────────────────
const withCarry = mkRecord('c1', '12', ['A'], [], { carryOverRequests: ['질문1', '질문2'] });
const older = mkRecord('c0', '11', ['A'], [], { carryOverRequests: ['옛질문'] });
const carry = buildCarryOver([older, withCarry]);
assert(carry.length === 2 && carry[0] === '질문1', '가장 최근 회차의 이월을 가져와야 함');
assert(buildCarryOver([]).length === 0, '기록 없으면 빈 배열');

// ── 7. 파일 저장소 왕복 ──────────────────────────────────────────────────────
(async () => {
  // 기본 경로(.data/)를 쓰면 앱의 실제 회차 기록을 오염시킨다 — 격리된 임시 디렉터리를 쓴다
  const tmpDir = path.join(os.tmpdir(), `livechat-radar-test-${process.pid}-${Date.now()}`);
  const store = new FileStore(tmpDir);
  assert(store.kind === 'file', '폴백은 file 저장소');

  await store.save(rec);
  const listed = await store.list(10);
  assert(listed.some((r) => r.id === 'sess-1'), '저장 후 조회 가능');

  // 같은 id 재저장은 중복이 아니라 갱신이어야 한다
  await store.save({ ...rec, totalMessages: 9999 });
  const after = await store.list(10);
  const dup = after.filter((r) => r.id === 'sess-1');
  assert(dup.length === 1, `같은 id는 1건으로 갱신 (실제 ${dup.length}건)`);
  assert(dup[0].totalMessages === 9999, '갱신 값 반영');

  // 보존기간 정리
  await store.save(mkRecord('old', '01', ['Z'], [], { startedAt: '2020-01-01T00:00:00.000Z' }));
  const removed = await store.prune(90);
  assert(removed >= 1, `보존기간 초과 레코드가 정리되어야 함 (실제 ${removed})`);
  const finalList = await store.list(50);
  assert(!finalList.some((r) => r.id === 'old'), '오래된 레코드 제거 확인');

  // 임시 디렉터리 정리 — 테스트가 흔적을 남기지 않게 한다
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }

  if (failed > 0) {
    console.error(`\ncrossSession tests FAILED (${failed}건)`);
    process.exitCode = 1;
  } else {
    console.log('crossSession tests passed');
  }
})();
