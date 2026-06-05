/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LiveChat Radar — Eval suite assertions.
 *
 * universal: 모든 분석 응답이 만족해야 하는 구조/관계 검증
 * fixture-specific: 각 fixture가 자기 시나리오에 맞게 추가 검증
 */

export interface AnalyzeResponse {
  sentiment: { positive: number; neutral: number; negative: number };
  topKeywords: Array<{ keyword: string; count: number; trend: string }>;
  faq: Array<{ question: string; count: number; templateAnswer: string }>;
  specialComments: Array<{ text: string; author: string; category: string; reason: string }>;
  recentSummary: string;
  presenterActions: Array<{ type: string; message: string; target: string }>;
  suggestedTopic: string;
}

export interface FixtureAssertions {
  purchase_signal_min?: number;
  stream_issue_min?: number;
  complaint_min?: number;
  sentiment_positive_min?: number;
  sentiment_negative_min?: number;
  sentiment_max_any_category?: number;
  faq_min?: number;
  schema_complete?: boolean;
  suggested_topic_nonempty?: boolean;
  presenter_action_categories_any?: string[];
  presenter_action_urgent_or_audio?: boolean;
}

export type AssertResult = { ok: boolean; label: string; detail?: string };

// ── Universal assertions ─────────────────────────────────────────────────────

export function runUniversal(resp: AnalyzeResponse): AssertResult[] {
  const r: AssertResult[] = [];

  // sentiment 합 100
  const s = resp.sentiment;
  const sum = (s?.positive ?? 0) + (s?.neutral ?? 0) + (s?.negative ?? 0);
  r.push({
    ok: sum === 100,
    label: 'sentiment 합=100',
    detail: `pos=${s?.positive} neu=${s?.neutral} neg=${s?.negative} sum=${sum}`,
  });

  // topKeywords 1~5 (스펙은 3 권장이지만 모델이 약간 벗어날 수 있음)
  const tk = resp.topKeywords?.length ?? 0;
  r.push({
    ok: tk >= 1 && tk <= 5,
    label: 'topKeywords 개수 1~5',
    detail: `count=${tk}`,
  });

  // specialComments ≤ 5
  const sc = resp.specialComments?.length ?? 0;
  r.push({
    ok: sc <= 5,
    label: 'specialComments ≤ 5',
    detail: `count=${sc}`,
  });

  // specialComments category 유효
  const validCats = new Set(['complaint', 'purchase_signal', 'stream_issue']);
  const invalidCat = resp.specialComments?.find(c => !validCats.has(c.category));
  r.push({
    ok: !invalidCat,
    label: 'specialComments.category 유효',
    detail: invalidCat ? `invalid="${invalidCat.category}"` : undefined,
  });

  // presenterActions 1~5
  const pa = resp.presenterActions?.length ?? 0;
  r.push({
    ok: pa >= 1 && pa <= 5,
    label: 'presenterActions 개수 1~5',
    detail: `count=${pa}`,
  });

  // presenterActions type 유효
  const validTypes = new Set(['urgent', 'info', 'action']);
  const invalidType = resp.presenterActions?.find(p => !validTypes.has(p.type));
  r.push({
    ok: !invalidType,
    label: 'presenterActions.type 유효',
    detail: invalidType ? `invalid="${invalidType.type}"` : undefined,
  });

  // recentSummary 비어있지 않음
  r.push({
    ok: !!resp.recentSummary && resp.recentSummary.length > 5,
    label: 'recentSummary 비어있지 않음',
    detail: `len=${resp.recentSummary?.length ?? 0}`,
  });

  // suggestedTopic 비어있지 않음
  r.push({
    ok: !!resp.suggestedTopic && resp.suggestedTopic.length > 5,
    label: 'suggestedTopic 비어있지 않음',
    detail: `len=${resp.suggestedTopic?.length ?? 0}`,
  });

  return r;
}

// ── Fixture-specific assertions ──────────────────────────────────────────────

export function runFixtureSpecific(
  resp: AnalyzeResponse,
  a: FixtureAssertions,
): AssertResult[] {
  const r: AssertResult[] = [];

  if (a.purchase_signal_min !== undefined) {
    const n = resp.specialComments?.filter(c => c.category === 'purchase_signal').length ?? 0;
    r.push({
      ok: n >= a.purchase_signal_min,
      label: `purchase_signal ≥ ${a.purchase_signal_min}`,
      detail: `found=${n}`,
    });
  }

  if (a.stream_issue_min !== undefined) {
    const n = resp.specialComments?.filter(c => c.category === 'stream_issue').length ?? 0;
    r.push({
      ok: n >= a.stream_issue_min,
      label: `stream_issue ≥ ${a.stream_issue_min}`,
      detail: `found=${n}`,
    });
  }

  if (a.complaint_min !== undefined) {
    const n = resp.specialComments?.filter(c => c.category === 'complaint').length ?? 0;
    r.push({
      ok: n >= a.complaint_min,
      label: `complaint ≥ ${a.complaint_min}`,
      detail: `found=${n}`,
    });
  }

  if (a.sentiment_positive_min !== undefined) {
    const v = resp.sentiment?.positive ?? 0;
    r.push({
      ok: v >= a.sentiment_positive_min,
      label: `sentiment.positive ≥ ${a.sentiment_positive_min}`,
      detail: `value=${v}`,
    });
  }

  if (a.sentiment_negative_min !== undefined) {
    const v = resp.sentiment?.negative ?? 0;
    r.push({
      ok: v >= a.sentiment_negative_min,
      label: `sentiment.negative ≥ ${a.sentiment_negative_min}`,
      detail: `value=${v}`,
    });
  }

  if (a.sentiment_max_any_category !== undefined) {
    const max = Math.max(
      resp.sentiment?.positive ?? 0,
      resp.sentiment?.neutral ?? 0,
      resp.sentiment?.negative ?? 0,
    );
    r.push({
      ok: max < a.sentiment_max_any_category,
      label: `어느 sentiment 카테고리도 ${a.sentiment_max_any_category} 미만`,
      detail: `max=${max}`,
    });
  }

  if (a.faq_min !== undefined) {
    const n = resp.faq?.length ?? 0;
    r.push({
      ok: n >= a.faq_min,
      label: `faq ≥ ${a.faq_min}`,
      detail: `found=${n}`,
    });
  }

  if (a.schema_complete) {
    // universal에서 이미 다 검증되지만 명시적으로
    r.push({
      ok:
        resp.sentiment != null &&
        Array.isArray(resp.topKeywords) &&
        Array.isArray(resp.faq) &&
        Array.isArray(resp.specialComments) &&
        typeof resp.recentSummary === 'string' &&
        Array.isArray(resp.presenterActions) &&
        typeof resp.suggestedTopic === 'string',
      label: 'schema 7개 필드 모두 존재',
    });
  }

  if (a.suggested_topic_nonempty) {
    r.push({
      ok: !!resp.suggestedTopic && resp.suggestedTopic.trim().length > 5,
      label: 'suggestedTopic 의미 있는 길이',
      detail: `len=${resp.suggestedTopic?.length ?? 0}`,
    });
  }

  if (a.presenter_action_categories_any) {
    const targets = new Set(a.presenter_action_categories_any);
    const hasMatch = resp.presenterActions?.some(p => targets.has(p.target));
    r.push({
      ok: !!hasMatch,
      label: `presenterActions.target ∈ {${a.presenter_action_categories_any.join(',')}}`,
      detail: `targets=${resp.presenterActions?.map(p => p.target).join(',')}`,
    });
  }

  if (a.presenter_action_urgent_or_audio) {
    const hasUrgent = resp.presenterActions?.some(p => p.type === 'urgent');
    const hasAudio = resp.presenterActions?.some(p => p.target === '음향');
    r.push({
      ok: !!(hasUrgent || hasAudio),
      label: 'presenterActions에 urgent 또는 음향 target 1개 이상',
      detail: `urgent=${hasUrgent} audio_target=${hasAudio}`,
    });
  }

  return r;
}

// ── Dry-run mock response (런너 self-test용) ────────────────────────────────

export function buildMockResponse(): AnalyzeResponse {
  return {
    sentiment: { positive: 50, neutral: 30, negative: 20 },
    topKeywords: [
      { keyword: '구매', count: 8, trend: 'up_trend' },
      { keyword: '가격', count: 5, trend: 'stable' },
      { keyword: '배송', count: 4, trend: 'up_trend' },
    ],
    faq: [
      { question: '가격 얼마?', count: 3, templateAnswer: '여러분 가격은 X원입니다.' },
      { question: '배송 언제?', count: 2, templateAnswer: '내일 출고 예정이에요.' },
      { question: '할인 적용?', count: 2, templateAnswer: '쿠폰 자동 적용됩니다.' },
    ],
    specialComments: [
      { text: '가격 얼마?', author: 'A', category: 'purchase_signal', reason: '가격 문의' },
      { text: '소리 안 들려요', author: 'B', category: 'stream_issue', reason: '음향 문제' },
      { text: '답답하네요', author: 'C', category: 'complaint', reason: '불만 표현' },
    ],
    recentSummary: '최근 댓글은 구매 의사와 가격 문의가 우세하며 일부 기술 이슈가 보고되었습니다.',
    presenterActions: [
      { type: 'action', message: '가격 정보를 한 번 더 강조해 주세요.', target: '상품소개' },
      { type: 'urgent', message: '음향 점검 부탁드립니다.', target: '음향' },
    ],
    suggestedTopic: '시청자에게 어떤 색상이 더 어울리는지 의견을 물어보세요!',
  };
}
