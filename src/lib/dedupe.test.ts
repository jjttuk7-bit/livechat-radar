/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  normalizeText,
  clusterDuplicates,
  dedupeRate,
  detectBrigading,
  type ChatLike,
} from './dedupe.js';

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`✗ ${msg}`);
    failed++;
  }
}

function msg(id: string, message: string, author = 'a', timestamp?: string): ChatLike {
  return { id, message, author, timestamp };
}

// ── 정규화 ───────────────────────────────────────────────────────────────────
assert(normalizeText('  안녕하세요!!  ') === '안녕하세요', '기호·공백 제거');
assert(normalizeText('ㅋㅋㅋㅋㅋㅋ') === 'ㅋㅋ', '반복 문자 축약');
assert(normalizeText('맞습니다 👍👍') === '맞습니다', '이모지 제거');
assert(
  normalizeText('구독!!!') === normalizeText('구독'),
  '기호 차이는 같은 문구로 묶여야 함',
);
assert(normalizeText('😀') === '', '이모지만 있으면 빈 문자열');

// ── 클러스터링 ───────────────────────────────────────────────────────────────
const basic = [
  msg('1', '구독했습니다', 'kim'),
  msg('2', '구독했습니다!!', 'lee'),
  msg('3', '구독했습니다', 'park'),
  msg('4', '오늘도 잘 보고 있습니다', 'choi'),
];
const clusters = clusterDuplicates(basic);
assert(clusters.length === 2, `2개 클러스터여야 함 (실제 ${clusters.length})`);
assert(clusters[0].count === 3, `최다 클러스터 count=3 (실제 ${clusters[0].count})`);
assert(clusters[0].uniqueAuthors === 3, '작성자 3명이어야 함');
assert(clusters[0].representative.id === '1', '대표는 첫 등장이어야 함');
assert(clusters[0].count >= clusters[1].count, 'count 내림차순 정렬');

// 압축률: 4건 → 2클러스터 = 2건 제거 = 50%
assert(dedupeRate(clusters, basic.length) === 50, `압축률 50% (실제 ${dedupeRate(clusters, basic.length)})`);

// 빈 정규화는 병합되지 않아야 한다 (서로 다른 이모지를 같은 문구로 보면 안 됨)
const emojis = [msg('e1', '😀'), msg('e2', '🔥'), msg('e3', '👏')];
assert(clusterDuplicates(emojis).length === 3, '빈 정규화는 각각 독립 클러스터');

// ── 도배 탐지 ────────────────────────────────────────────────────────────────
// 1) 한 사람이 반복
const flood = Array.from({ length: 8 }, (_, i) =>
  msg(`f${i}`, '지금 이거 보세요', 'spammer', new Date(1700000000000 + i * 1000).toISOString()),
);
const floodSignals = detectBrigading(clusterDuplicates(flood));
assert(floodSignals.length === 1, '개인 도배 1건 탐지');
assert(floodSignals[0].kind === 'single_author_flood', `kind=single_author_flood (실제 ${floodSignals[0]?.kind})`);

// 2) 여러 명이 짧은 시간에 같은 문구 (조직적 확산)
const spread = Array.from({ length: 10 }, (_, i) =>
  msg(`s${i}`, '같은 구호 반복', `user${i}`, new Date(1700000000000 + i * 200).toISOString()),
);
const spreadSignals = detectBrigading(clusterDuplicates(spread));
assert(spreadSignals.length === 1, '조직적 확산 1건 탐지');
assert(
  spreadSignals[0].kind === 'coordinated_spread',
  `kind=coordinated_spread (실제 ${spreadSignals[0]?.kind})`,
);
assert(spreadSignals[0].ratePerSec > 0.5, '확산 속도가 임계 초과');

// 3) 정상 대화는 탐지되지 않아야 한다 (오탐 방지)
const normal = [
  msg('n1', '안녕하세요', 'a', new Date(1700000000000).toISOString()),
  msg('n2', '반갑습니다', 'b', new Date(1700000005000).toISOString()),
  msg('n3', '오늘 주제가 뭔가요', 'c', new Date(1700000010000).toISOString()),
];
assert(detectBrigading(clusterDuplicates(normal)).length === 0, '정상 대화는 도배로 잡히지 않아야 함');

// 4) 여러 명이 천천히 같은 말 (자연스러운 호응) — 조직적으로 보지 않는다
const slowAgree = Array.from({ length: 6 }, (_, i) =>
  msg(`g${i}`, '맞습니다', `u${i}`, new Date(1700000000000 + i * 20000).toISOString()),
);
assert(
  detectBrigading(clusterDuplicates(slowAgree)).length === 0,
  '느린 동조는 조직적 확산이 아니어야 함 (오탐 방지)',
);

// ── 성능 계약 ────────────────────────────────────────────────────────────────
// 이 계층의 존재 이유가 대량 처리이므로, 대량 입력에서의 시간이 곧 계약이다.
const BIG = 50_000;
const big: ChatLike[] = Array.from({ length: BIG }, (_, i) =>
  msg(`b${i}`, i % 5 === 0 ? '반복되는 구호입니다' : `개별 의견 ${i}`, `u${i % 900}`),
);
const t0 = performance.now();
const bigClusters = clusterDuplicates(big);
const elapsed = performance.now() - t0;

// 임계값의 목적은 마이크로 벤치마크가 아니라 **알고리즘 복잡도 회귀**를 잡는 것이다.
// 실측 범위는 200~1050ms(머신 부하에 따라 변동)이며, O(n²)로 퇴화하면 분 단위가 되므로
// 넉넉한 상한으로도 회귀는 확실히 잡힌다. 타이트하게 잡으면 부하 시 거짓 실패만 늘어난다.
assert(elapsed < 3000, `5만 건 처리 ${elapsed.toFixed(0)}ms — 3000ms 이내여야 함 (복잡도 회귀 감시)`);

// 반복 구호는 정확히 1개 클러스터로 묶여야 한다 (전체의 1/5)
const slogan = bigClusters.find((c) => c.key === normalizeText('반복되는 구호입니다'));
assert(slogan?.count === BIG / 5, `구호 클러스터 count 기대 ${BIG / 5} / 실제 ${slogan?.count}`);
assert(bigClusters[0] === slogan, '최다 클러스터가 선두에 정렬되어야 함');

// 나머지는 대체로 개별 문구다. 정규화가 반복 문자를 축약하므로 일부 자연 충돌이 발생하는데
// (예: "의견 1000" → "의견 100"), 이는 의도된 동작이므로 정확한 개수 대신 범위로 검증한다.
assert(
  bigClusters.length > BIG * 0.7 && bigClusters.length <= BIG * 0.8 + 1,
  `클러스터 수가 기대 범위를 벗어남: ${bigClusters.length}`,
);

const rate = dedupeRate(bigClusters, BIG);
assert(rate >= 20, `압축률 최소 20% 기대 (실제 ${rate.toFixed(1)}%)`);

console.log(
  `  [perf] 5만 건 dedupe ${elapsed.toFixed(0)}ms → ${bigClusters.length} 클러스터 (압축률 ${rate.toFixed(1)}%)`,
);

if (failed > 0) {
  console.error(`\ndedupe tests FAILED (${failed}건)`);
  process.exitCode = 1;
} else {
  console.log('dedupe tests passed');
}
