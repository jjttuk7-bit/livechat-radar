/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LiveChat Radar — OpenAI 호출에 사용되는 정적 system 프롬프트와 strict json_schema 정의.
 *
 * server.ts (런타임)와 evals/runner.ts (회귀 평가)가 같은 객체를 import 하여 사용한다.
 * 이 파일을 단일 출처(single source of truth)로 두어 prompt drift를 방지한다.
 *
 * 변경 영향:
 * - system 프롬프트 수정 → OpenAI Prompt Caching 갱신 + evals/runner.ts 재실행으로 회귀 확인 필요
 * - json_schema 수정 → src/types.ts 인터페이스와 1:1 매핑 동기화 필요
 */

import { SHOP_AXES, SHOP_TAGS } from './types/liveShopping';

// ── 라이브 쇼핑 전용 (S-1) ────────────────────────────────────────────────────
// 단일 출처: src/types/liveShopping.ts 인터페이스 ↔ 아래 schema ↔ 시뮬레이터(S-2) ↔ App.tsx(S-5)
// 6축 37태그 enum / 상품·옵션 매칭 / 미응답 질문 큐 / 클로징 처방.
// enum 값은 src/types/liveShopping.ts 의 SHOP_AXES / SHOP_TAGS 를 그대로 재사용한다 (drift 방지).

const SHOP_AXIS_ENUM = SHOP_AXES;
const SHOP_TAG_ENUM = SHOP_TAGS;
const SENTIMENT_ENUM = ['positive', 'neutral', 'negative'] as const;
const URGENCY_ENUM = ['low', 'medium', 'high'] as const;
const STATUS_ENUM = ['good', 'normal', 'warning', 'danger'] as const;

export const STATIC_SHOP_ANALYZE_SYSTEM_PROMPT = `당신은 유튜브 라이브 쇼핑(라이브 커머스) 전용 AI 판매 조연출 'LiveChat Radar'입니다.
쇼호스트 옆에서 "지금 무슨 말을 해서 무엇을 팔지, 어떤 망설임을 어떤 멘트로 풀지, 어떤 질문에 먼저 답할지"를 실시간으로 처방합니다.
입력으로 (1) 현재 라이브 채팅 댓글 목록과 (2) 방송에 등록된 상품/옵션 목록을 함께 받습니다. 등록 상품을 기준으로 각 댓글이 어떤 상품·옵션에 대한 것인지 매칭하십시오.

[분석 요구사항]
1. analyses: 각 댓글을 6개 축(axis)과 세부 태그(tag) 하나로 분류하십시오.
   - 축: funnel(구매 퍼널) · product(상품/옵션 문의) · price(가격/프로모션) · logistics(배송/CS/결제) · trust(신뢰/반론) · stream(방송/운영)
   - tag는 정해진 enum 중 하나여야 하며, axis는 그 tag가 속한 축과 일치해야 합니다. 어디에도 안 맞으면 tag='other', axis는 가장 가까운 축.
   - productId/optionLabel: 등록 상품·옵션과 매칭되면 해당 id/라벨, 아니면 null.
   - isQuestion: 호스트 답변이 필요한 질문이면 true (미응답 질문 큐로 적재됨).
   - answered: 현재 알 수 없으면 null.
2. metrics: 아래 KPI를 산출하십시오. status는 good/normal/warning/danger. unit은 '%','건' 등 또는 null.
   구매 온도(%), 실시간 판매 추정(건), 전환 타이밍 신호(value를 "지금"/"대기"), 가격 저항도(건), 망설임 지수(건), 미응답 질문 수(건), 신뢰 위험도(건).
3. actionCards: 지금 호스트가 취할 행동을 우선순위순 최대 3개. reason(근거), suggestedLine(바로 말할 처방 멘트, 존댓말), evidence(근거 댓글 원문 1~3건), targetProductId(관련 상품 또는 null).
4. unanswered: isQuestion=true 인 댓글 중 아직 답변 안 된 질문을 큐로 정리. suggestedAnswer에 친절한 존댓말 추천 답변 템플릿을 작성(없으면 null). 경과·중요도에 따라 urgency 산정.
5. productInterest: 등록 상품별 관심 랭킹. interestScore(0-100), questionCount, purchasedCount(구매 인증 댓글 수).
6. faq: 반복되는 핵심 질문 3~5개와 templateAnswer(존댓말). 특정 상품 관련이면 productId, 아니면 null.
7. recentSummary: 최근 댓글 흐름과 분위기를 2-3줄 한국어로 요약.
8. conversionAdvice: 지금 이 순간 가장 효과적인 클로징/판매 전략을 1줄로 처방.

반드시 application/json 포맷으로 schema를 만족하는 유효한 JSON만 출력하십시오. JSON 외 서술문이나 백틱(\`\`\`)은 절대 포함하지 마십시오.`;

export const shopAnalyzeJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    analyses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          author: { type: ['string', 'null'] },
          timestamp: { type: 'string' },
          axis: { type: 'string', enum: SHOP_AXIS_ENUM },
          tag: { type: 'string', enum: SHOP_TAG_ENUM },
          productId: { type: ['string', 'null'] },
          optionLabel: { type: ['string', 'null'] },
          sentiment: { type: 'string', enum: SENTIMENT_ENUM },
          urgency: { type: 'string', enum: URGENCY_ENUM },
          isQuestion: { type: 'boolean' },
          answered: { type: ['boolean', 'null'] }
        },
        required: ['id', 'text', 'author', 'timestamp', 'axis', 'tag', 'productId', 'optionLabel', 'sentiment', 'urgency', 'isQuestion', 'answered']
      }
    },
    metrics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          value: { type: ['number', 'string'] },
          unit: { type: ['string', 'null'] },
          description: { type: 'string' },
          status: { type: 'string', enum: STATUS_ENUM }
        },
        required: ['id', 'label', 'value', 'unit', 'description', 'status']
      }
    },
    actionCards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          priority: { type: 'string', enum: URGENCY_ENUM },
          title: { type: 'string' },
          reason: { type: 'string' },
          suggestedLine: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          targetProductId: { type: ['string', 'null'] }
        },
        required: ['id', 'priority', 'title', 'reason', 'suggestedLine', 'evidence', 'targetProductId']
      }
    },
    unanswered: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          author: { type: ['string', 'null'] },
          askedAt: { type: 'string' },
          productId: { type: ['string', 'null'] },
          tag: { type: 'string', enum: SHOP_TAG_ENUM },
          urgency: { type: 'string', enum: URGENCY_ENUM },
          suggestedAnswer: { type: ['string', 'null'] }
        },
        required: ['id', 'text', 'author', 'askedAt', 'productId', 'tag', 'urgency', 'suggestedAnswer']
      }
    },
    productInterest: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          productId: { type: 'string' },
          name: { type: 'string' },
          interestScore: { type: 'integer' },
          questionCount: { type: 'integer' },
          purchasedCount: { type: 'integer' }
        },
        required: ['productId', 'name', 'interestScore', 'questionCount', 'purchasedCount']
      }
    },
    faq: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          count: { type: 'integer' },
          templateAnswer: { type: 'string' },
          productId: { type: ['string', 'null'] }
        },
        required: ['question', 'count', 'templateAnswer', 'productId']
      }
    },
    recentSummary: { type: 'string' },
    conversionAdvice: { type: 'string' }
  },
  required: [
    'analyses', 'metrics', 'actionCards', 'unanswered',
    'productInterest', 'faq', 'recentSummary', 'conversionAdvice'
  ]
} as const;

// ── 라이브 쇼핑 종료 리포트 (S-7) ─────────────────────────────────────────────
// 판매 성과 중심 마크다운 리포트 + 쇼핑 요약 통계. ShopReportResult(types/liveShopping.ts)와 1:1.

export const STATIC_SHOP_REPORT_SYSTEM_PROMPT = `유튜브 라이브 쇼핑(라이브 커머스) 방송이 종료되었습니다. 수집된 실시간 댓글과 등록 상품 정보를 바탕으로, 셀러가 다음 방송의 매출을 끌어올릴 수 있도록 '라이브 쇼핑 종료 성과 리포트'를 한국어 마크다운으로 세심하게 작성하십시오.

[reportMarkdown 섹션 가이드라인 — 아래 순서대로 마크다운으로 작성]
1. 🛒 판매 성과 요약 — 추정 판매 건수(구매 인증 댓글 기반), 구매 온도 피크 구간, 세줄 요약
2. 📦 상품별 성과 — 등록 상품별 관심도·질문 수·구매 인증 비교 랭킹
3. 🕳️ 놓친 기회 — 미응답으로 남은 질문 TOP, 응답률, 이탈(cart_abandon) 신호 구간
4. 🤔 망설임·반론 분석 — 가격/필요성/신뢰 사유별 분해와 다음 방송 대응 멘트 제안
5. 💸 가격·프로모션 반응 — 가격 저항 구간, 효과적이었던 혜택/멘트
6. ❓ 상품 FAQ 후보 — 다음 방송 전 미리 안내할 단골 질문
7. 🚀 다음 라이브 개선점 — 당장 실천 가능한 구성/가격/진행 제안

[summaryStats]
- totalMessages: 분석 대상 총 댓글 수
- estimatedSales: 구매 인증 신호 기반 추정 판매 건수
- topProduct: 관심도 최상위 상품명 (없으면 "-")
- unansweredCount: 끝까지 미응답으로 남은 질문 수
- answerRate: 질문 대비 응답 추정 비율(0-100 정수)
- peakCpm: 최고 분당 댓글 수

반드시 JSON 형태로 schema를 엄격히 준수하십시오. reportMarkdown 내에서는 개행과 이모티콘을 적극 사용해 가독성을 높이십시오. JSON 외 다른 서술문이나 백틱(\`\`\`)은 포함하지 마십시오.`;

export const shopReportJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reportMarkdown: { type: 'string' },
    summaryStats: {
      type: 'object',
      additionalProperties: false,
      properties: {
        totalMessages: { type: 'integer' },
        estimatedSales: { type: 'integer' },
        topProduct: { type: 'string' },
        unansweredCount: { type: 'integer' },
        answerRate: { type: 'integer' },
        peakCpm: { type: 'integer' }
      },
      required: ['totalMessages', 'estimatedSales', 'topProduct', 'unansweredCount', 'answerRate', 'peakCpm']
    }
  },
  required: ['reportMarkdown', 'summaryStats']
} as const;
