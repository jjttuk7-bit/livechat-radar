/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI 응답 정규화 (P-12).
 *
 * 왜 필요한가: `axis`는 `tag`에서 100% 파생되는 값이다(TAG_AXIS). 그런데 스키마가 둘을
 * 독립 필드로 받으면 모델이 서로 어긋나게 채운다 — live eval 8개 fixture **전부**에서
 * 불일치가 나왔다. 파생 가능한 값을 모델에게 시키는 것 자체가 설계 오류였다.
 *
 * 해결: 스키마에서 `axis`를 빼고(모델이 낼 수 없게 하고) 서버가 tag에서 채운다.
 * `analyzedAt` 같은 서버 주입 메타와 같은 원리다.
 *
 * server.ts(런타임)와 evals/runner.ts(회귀 평가)가 같은 함수를 쓴다 — 한쪽만 정규화하면
 * 평가와 런타임이 갈라진다.
 */

import { TAG_AXIS, TALK_TAGS, type TalkTag } from '../types/liveTalk.js';

/**
 * 파싱된 분석 응답에 축을 주입하고, 모델이 낸 알 수 없는 태그를 안전하게 처리한다.
 * 입력 객체를 그대로 수정하지 않고 필요한 부분만 새로 만든다.
 */
export function applyDerivedAxes<T extends { analyses?: unknown }>(parsed: T): T {
  const list = (parsed as { analyses?: unknown }).analyses;
  if (!Array.isArray(list)) return parsed;

  const normalized = list.map((raw) => {
    const item = raw as Record<string, unknown>;
    const tag = item.tag as TalkTag;

    // 모델이 enum 밖 태그를 냈다면 'other'로 떨어뜨린다. 그대로 두면 TAG_AXIS 조회가
    // undefined가 되어 축 분포 집계에 빈 칸이 생긴다.
    const safeTag: TalkTag = TALK_TAGS.includes(tag) ? tag : 'other';

    return {
      ...item,
      tag: safeTag,
      axis: TAG_AXIS[safeTag],
      // duplicateCount가 없거나 이상하면 1로 — 가중치 계산이 NaN이 되지 않도록
      duplicateCount:
        typeof item.duplicateCount === 'number' && item.duplicateCount >= 1
          ? Math.floor(item.duplicateCount)
          : 1,
    };
  });

  return { ...parsed, analyses: normalized };
}
