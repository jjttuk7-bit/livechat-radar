/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 6축 37태그 분류 체계의 무결성 회귀 테스트 (P-1).
 *
 * qa-validator의 "쌍 4: enum 삼중 일치"를 자동화한다. 태그를 추가할 때 유니온 타입 ·
 * TALK_TAGS 배열 · TAG_AXIS 맵 중 하나만 갱신하는 실수가 가장 흔하며, 그 결과
 * 축 분포 집계에 undefined 축이 생기거나 모델이 낸 태그를 코드가 인식하지 못한다.
 */

import {
  TALK_AXES,
  TALK_TAGS,
  TAG_AXIS,
  RISK_TAGS,
  type TalkAxis,
  type TalkTag,
} from '../types/liveTalk.js';

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`✗ ${msg}`);
    failed++;
  }
}

// ── 1. 축 ────────────────────────────────────────────────────────────────────
assert(TALK_AXES.length === 6, `축은 6개여야 함 (실제 ${TALK_AXES.length})`);
assert(
  new Set(TALK_AXES).size === TALK_AXES.length,
  '축 배열에 중복이 없어야 함',
);

// ── 2. 태그 배열 ─────────────────────────────────────────────────────────────
assert(TALK_TAGS.length === 37, `태그는 37개여야 함 (실제 ${TALK_TAGS.length})`);

const dups = TALK_TAGS.filter((t, i) => TALK_TAGS.indexOf(t) !== i);
assert(dups.length === 0, `태그 배열 중복: ${dups.join(', ')}`);

// ── 3. 삼중 일치: TALK_TAGS ↔ TAG_AXIS 키 ────────────────────────────────────
const axisKeys = Object.keys(TAG_AXIS) as TalkTag[];

const missingInMap = TALK_TAGS.filter((t) => !axisKeys.includes(t));
assert(
  missingInMap.length === 0,
  `TALK_TAGS에 있으나 TAG_AXIS에 없음: ${missingInMap.join(', ')}`,
);

const missingInArray = axisKeys.filter((k) => !TALK_TAGS.includes(k));
assert(
  missingInArray.length === 0,
  `TAG_AXIS에 있으나 TALK_TAGS에 없음: ${missingInArray.join(', ')}`,
);

assert(
  axisKeys.length === TALK_TAGS.length,
  `개수 불일치 — TAG_AXIS ${axisKeys.length} vs TALK_TAGS ${TALK_TAGS.length}`,
);

// ── 4. 모든 태그의 축이 TALK_AXES 안에 있어야 함 ─────────────────────────────
for (const tag of TALK_TAGS) {
  const axis = TAG_AXIS[tag];
  assert(
    TALK_AXES.includes(axis),
    `태그 '${tag}'의 축 '${axis}'가 TALK_AXES에 없음`,
  );
}

// ── 5. 축별 태그 분포 (기획서 3절과 일치해야 함) ─────────────────────────────
const expected: Record<TalkAxis, number> = {
  agenda: 7,
  stance: 5,
  emotion: 6,
  inquiry: 6,
  loyalty: 6,
  risk: 7, // 6 + fallback 'other'
};

const actual = {} as Record<TalkAxis, number>;
for (const axis of TALK_AXES) actual[axis] = 0;
for (const tag of TALK_TAGS) actual[TAG_AXIS[tag]]++;

for (const axis of TALK_AXES) {
  assert(
    actual[axis] === expected[axis],
    `축 '${axis}' 태그 수: 기대 ${expected[axis]} / 실제 ${actual[axis]}`,
  );
}

// ── 6. RISK_TAGS는 TALK_TAGS의 부분집합이어야 한다 ───────────────────────────
// (RiskAlert.tag의 schema enum이 이 배열을 쓰므로, 여기가 갈라지면 모델이
//  코드가 모르는 태그를 낼 수 있다)
for (const rt of RISK_TAGS) {
  assert(TALK_TAGS.includes(rt), `RISK_TAGS의 '${rt}'가 TALK_TAGS에 없음`);
  assert(TAG_AXIS[rt] === 'risk', `RISK_TAGS의 '${rt}'의 축이 risk가 아님`);
}
assert(
  RISK_TAGS.length === TALK_TAGS.filter((t) => TAG_AXIS[t] === 'risk' && t !== 'other').length,
  `RISK_TAGS 개수가 risk 축 태그(other 제외)와 불일치: ${RISK_TAGS.length}`,
);

// ── 7. 안전 제약 회귀 (D-1) ──────────────────────────────────────────────────
// 개인 정치성향을 나타내는 태그가 분류 체계에 들어오면 안 된다.
// 여론은 stance 축의 집계 비율로만 표현하며, 진영·정당 라벨은 태그가 되지 않는다.
const FORBIDDEN_PATTERNS = [
  'conservative', 'progressive', 'liberal', 'leftist', 'rightist',
  'left_wing', 'right_wing', 'party_', 'partisan', 'ideology',
  'supporter_of', 'political_lean', 'lean_',
];
for (const tag of TALK_TAGS) {
  const hit = FORBIDDEN_PATTERNS.find((p) => tag.includes(p));
  assert(
    !hit,
    `D-1 위반: 태그 '${tag}'가 정치성향 라벨 패턴 '${hit}'을 포함. ` +
      `개인 성향 분류는 민감정보이므로 분류 체계에 두지 않는다.`,
  );
}

if (failed > 0) {
  console.error(`\ntalkTaxonomy tests FAILED (${failed}건)`);
  process.exitCode = 1;
} else {
  console.log('talkTaxonomy tests passed');
}
