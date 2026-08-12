/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { runPrefilter, formatStatsForPrompt } from './prefilter.js';
import { stratifiedSample, formatSampleForPrompt } from './sample.js';
import { dictionaryStats, POLITICAL_SLUR_PAIRS } from './dictionaries.js';
import { TALK_AXES } from '../types/liveTalk.js';
import type { ChatLike } from './dedupe.js';

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`✗ ${msg}`);
    failed++;
  }
}

let seq = 0;
function m(message: string, author = `u${seq}`, tsOffsetSec = seq): ChatLike {
  seq++;
  return {
    id: `m${seq}`,
    author,
    message,
    timestamp: new Date(1700000000000 + tsOffsetSec * 1000).toISOString(),
  };
}

// ── 1. 태그 추정 ─────────────────────────────────────────────────────────────
const sample1 = [
  m('자료 좀 화면에 띄워주세요'),
  m('이 사안 다음에 다뤄주세요'),
  m('구독했습니다'),
  m('출석합니다'),
  m('소리가 안 들려요'),
  m('맞습니다 정확합니다'),
  m('그건 아니라고 봅니다'),
  m('진짜 맞나요 확인이 필요합니다'),
  m('지겹네요 똑같은 얘기'),
  m('카톡으로 받았는데 이거 사실인가요'),
];
const s1 = runPrefilter(sample1);

assert(s1.total === 10, `총 10건 (실제 ${s1.total})`);
assert(s1.tagCounts.source_request === 1, 'source_request 추정');
assert(s1.tagCounts.topic_request === 1, 'topic_request 추정');
assert(s1.tagCounts.subscribe_share === 1, 'subscribe_share 추정');
assert(s1.tagCounts.attendance === 1, 'attendance 추정');
assert(s1.tagCounts.stream_issue === 1, 'stream_issue 추정');
assert(s1.tagCounts.agree_support === 1, 'agree_support 추정');
assert(s1.tagCounts.fatigue_disengage === 1, 'fatigue_disengage 추정');
assert(s1.tagCounts.misinfo_suspect === 1, 'misinfo_suspect 추정 (미확인 전언 형식)');

// ── 2. 후보 분류: 리스크·요구는 전수 대상 ────────────────────────────────────
assert(s1.riskCandidates.length >= 1, `리스크 후보 최소 1건 (실제 ${s1.riskCandidates.length})`);
assert(
  s1.requestCandidates.length >= 2,
  `요구 후보 최소 2건 (실제 ${s1.requestCandidates.length})`,
);
assert(
  s1.riskCandidates.every((h) => h.axis === 'risk'),
  '리스크 후보는 모두 risk 축이어야 함',
);

// stream_issue는 risk 축이지만 채널 제재 리스크가 아니므로 전수 대상이 아니다
assert(
  !s1.riskCandidates.some((h) => h.tag === 'stream_issue'),
  'stream_issue는 리스크 후보(전수)에서 제외되어야 함',
);

// ── 3. 큐시트 주입 (실제 인물·정당명을 코드에 하드코딩하지 않는 경로) ────────
const s2 = runPrefilter([m('오늘 그 특검 얘기 어떻게 되나요'), m('아무 말이나')], {
  issueKeywords: ['특검'],
});
assert(s2.tagCounts.issue_mention >= 0, 'issueKeywords 경로가 동작해야 함');

const s3 = runPrefilter([m('그분 오늘도 나왔네')], { figures: ['그분'] });
assert(s3.tagCounts.figure_mention === 1, 'figures 주입으로 figure_mention 추정');

// ── 4. 도배 탐지 → 리스크 후보 승격 ──────────────────────────────────────────
const flood: ChatLike[] = Array.from({ length: 12 }, (_, i) => ({
  id: `sp${i}`,
  author: `bot${i}`,
  message: '동일한 구호를 반복합니다',
  timestamp: new Date(1700000000000 + i * 300).toISOString(),
}));
const s4 = runPrefilter(flood);
assert(s4.brigading.length >= 1, '조직적 확산 탐지');
assert(
  s4.riskCandidates.some((h) => h.tag === 'brigading_spam'),
  '도배가 사전에 안 걸려도 구조적으로 리스크 후보에 올라야 함',
);

// ── 5. duplicateCount 전달 ───────────────────────────────────────────────────
const dupInput: ChatLike[] = [
  { id: 'd1', author: 'a', message: '같은 말', timestamp: new Date(1700000000000).toISOString() },
  { id: 'd2', author: 'b', message: '같은 말', timestamp: new Date(1700000001000).toISOString() },
  { id: 'd3', author: 'c', message: '같은 말', timestamp: new Date(1700000002000).toISOString() },
];
const s5 = runPrefilter(dupInput);
const allHits = [...s5.riskCandidates, ...s5.requestCandidates, ...s5.others];
assert(
  allHits.every((h) => h.duplicateCount === 3),
  `duplicateCount가 3이어야 함 (실제 ${allHits.map((h) => h.duplicateCount).join(',')})`,
);

// ── 6. 시그니처: 내용이 같으면 같고 다르면 달라야 한다 ───────────────────────
const a1 = runPrefilter([{ id: 'x1', author: 'a', message: '구독했습니다' }]);
const a2 = runPrefilter([{ id: 'x2', author: 'b', message: '구독했습니다' }]);
const a3 = runPrefilter([{ id: 'x3', author: 'c', message: '전혀 다른 내용입니다' }]);
assert(
  a1.signature === a2.signature,
  'ID가 달라도 내용 구성이 같으면 시그니처가 같아야 함 (고CPM 캐시 히트의 핵심)',
);
assert(a1.signature !== a3.signature, '내용이 다르면 시그니처가 달라야 함');

// ── 7. 층화 표본 ─────────────────────────────────────────────────────────────
const mixed: ChatLike[] = [];
for (let i = 0; i < 300; i++) mixed.push(m('맞습니다 동감입니다'));       // stance 다수
for (let i = 0; i < 200; i++) mixed.push(m('화가 나네요 어이가 없습니다')); // emotion 다수
for (let i = 0; i < 3; i++) mixed.push(m('자료 출처 좀 올려주세요'));        // agenda 소수
for (let i = 0; i < 2; i++) mixed.push(m('구속감이다 저건 범죄자다'));       // risk 소수
for (let i = 0; i < 2; i++) mixed.push(m('구독하고 갑니다'));                // loyalty 소수

const sBig = runPrefilter(mixed);
const picked = stratifiedSample(sBig, { size: 40 });

assert(picked.items.length <= 40 + picked.mandatoryCount, '표본 크기 상한 준수');
assert(picked.mandatoryCount >= 2, `리스크·요구 전수 포함 (실제 ${picked.mandatoryCount})`);

// 다수 축이 표본을 독점하면 소수 축(리스크·아젠다)이 사라진다 — 그것을 막는 것이 층화의 목적
const coveredAxes = TALK_AXES.filter((a) => picked.axisCoverage[a] > 0);
assert(
  coveredAxes.length >= 4,
  `최소 4개 축이 표본에 포함되어야 함 (실제 ${coveredAxes.length}: ${coveredAxes.join(',')})`,
);
assert(picked.axisCoverage.risk > 0, '소수여도 risk 축은 반드시 표본에 있어야 함');

// 표본이 원본 전체를 대표하는지 (dedupe로 압축된 건수 합)
assert(
  picked.representedMessages > picked.items.length,
  '표본이 자기 건수보다 많은 원본을 대표해야 함 (dedupe 활용)',
);

// ── 8. 입력 상수성: CPM이 10배여도 표본 크기는 그대로 ────────────────────────
const huge: ChatLike[] = [];
for (let i = 0; i < 5000; i++) huge.push(m(`의견 ${i} 입니다`));
const sHuge = runPrefilter(huge);
const pickedHuge = stratifiedSample(sHuge, { size: 40 });
assert(
  pickedHuge.items.length <= 40 + pickedHuge.mandatoryCount,
  `5천 건 입력에도 표본이 상수여야 함 (실제 ${pickedHuge.items.length})`,
);

// ── 9. 프롬프트 직렬화 ───────────────────────────────────────────────────────
const promptStats = formatStatsForPrompt(sBig);
assert(promptStats.includes('총 댓글'), '집계 요약에 총 건수 포함');
assert(promptStats.includes('축 분포'), '집계 요약에 축 분포 포함');

const promptSample = formatSampleForPrompt(picked);
assert(promptSample.includes('ID:'), '표본 직렬화에 ID 포함');
assert(promptSample.includes('동일 문구'), 'duplicateCount가 1보다 크면 명시되어야 함');

// ── 10. 안전: 사전에 정치적 멸칭이 단독으로 들어가지 않았는가 (D-7) ──────────
assert(
  POLITICAL_SLUR_PAIRS.every((p) => p.a && p.b),
  'D-7 위반: 정치적 멸칭은 반드시 대칭 쌍(a,b)으로만 존재해야 함',
);

// ── 11. 성능 계약 ────────────────────────────────────────────────────────────
const BIG = 50_000;
const bigInput: ChatLike[] = Array.from({ length: BIG }, (_, i) => ({
  id: `p${i}`,
  author: `u${i % 800}`,
  message:
    i % 7 === 0
      ? '자료 좀 올려주세요'
      : i % 11 === 0
        ? '구속감이다 명백한 범죄'
        : `개별 의견 ${i} 입니다`,
  timestamp: new Date(1700000000000 + i * 100).toISOString(),
}));

const t0 = performance.now();
const bigStats = runPrefilter(bigInput);
const t1 = performance.now();
const bigSample = stratifiedSample(bigStats, { size: 80 });
const t2 = performance.now();

// 복잡도 회귀 감시용 상한 (마이크로 벤치마크가 아니다 — 부하에 따라 실측이 크게 흔들린다)
assert(t1 - t0 < 6000, `5만 건 프리필터 ${(t1 - t0).toFixed(0)}ms — 6000ms 이내 (복잡도 회귀 감시)`);
assert(t2 - t1 < 1000, `표본 추출 ${(t2 - t1).toFixed(0)}ms — 1000ms 이내`);
assert(
  bigSample.items.length < 400,
  `5만 건 입력에도 표본이 수백 건 수준이어야 함 (실제 ${bigSample.items.length})`,
);

const dict = dictionaryStats();
console.log(
  `  [perf] 5만 건 prefilter ${(t1 - t0).toFixed(0)}ms + sample ${(t2 - t1).toFixed(0)}ms\n` +
    `         → 표본 ${bigSample.items.length}건 (전수 ${bigSample.mandatoryCount} / 층화 ${bigSample.sampledCount}), ` +
    `${bigSample.representedMessages}건 대표\n` +
    `  [dict] 규칙 ${dict.rules}개 · 패턴 ${dict.patterns}개 · 멸칭쌍 ${dict.slurPairs}쌍`,
);

if (failed > 0) {
  console.error(`\nprefilter tests FAILED (${failed}건)`);
  process.exitCode = 1;
} else {
  console.log('prefilter tests passed');
}
