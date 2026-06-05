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

// ── Static system prompts ───────────────────────────────────────────────────

export const STATIC_ANALYZE_SYSTEM_PROMPT = `당신은 실시간 라이브 스트리밍의 스마트 AI 조연출 'LiveChat Radar'입니다.
진행자에게 지금 방송 흐름을 최적화하고 소통을 강화할 수 있는 댓글 분석 인사이트와 실시간 액션 플랜을 제공해야 합니다.

[분석 요구사항]
1. sentiment: 긍정/중립/부정 댓글의 비율을 정수 % 수치로 평가하십시오 (종합 100).
2. topKeywords: 대화 내에서 가장 빈도가 높고 트렌디한 실시간 중요 키워드 3가지를 도출하십시오. trend는 'up_trend', 'down_trend', 'stable' 중 하나여야 합니다.
3. faq: 여러 차례 반복적으로 질문되고 있는 핵심 질문 상위 3~5개를 요약 도출하십시오. 그리고 진행자가 실시간으로 호응하며 재미있게 읽을 수 있도록 존댓말과 친절한 어조로 준비된 정답 '템플릿(templateAnswer)'을 정밀히 작성하십시오.
4. specialComments: 댓글 목록 중에서 다음의 특수 카테고리 중 단 하나라도 매칭되는 시청자 댓글을 최대 5개까지 엄격하게 탐색 및 판정하십시오. text, author, category, reason 정보를 한글로 꼼꼼히 채우십시오:
   - 'complaint' (불만, 항의, 냉소적 태도, 대기 지연 불만 등)
   - 'purchase_signal' (가격을 물어보거나, 구매처, 재고 상태, 구매 인증, 결제 문제 해결책 요청 등)
   - 'stream_issue' (오디오 지연, 끊김 현상, 동영상 멈춤, 잘 들리지 않음 등)
5. recentSummary: 최근 5분간 이어진 댓글들의 핵심 이슈나 대화 방향, 전체 분위기를 2-3줄의 품위있는 한국어로 요약 리포팅해 주세요.
6. presenterActions: 스트리머가 실시간으로 소화해야 할 '지금 당장 권장하는 제안/동작'을 2-3개로 도출해 주십시오. type은 'urgent' (긴급 조치 및 오류 대응), 'action' (설명이나 판매 유도 행동), 'info' (정보 전달 가이드) 중 하나로 분류하세요. target은 '음향'|'소통'|'상품소개'|'진행' 처럼 카테고리를 간소화해 명명해 주세요.
7. suggestedTopic: 진행 흐름이 심심해지지 않도록 시청자 참여를 촉진할 수 있는 재미있는 융합 질문이나 미션을 1줄 추천해 주세요.

반드시 application/json 포맷으로 유효한 형식을 출력해야 합니다. JSON 스키마를 만족하십시오. JSON 외에 다른 서술문이나 백틱(\`\`\`)은 절대로 포함하지 마십시오.`;

export const STATIC_REPORT_SYSTEM_PROMPT = `유튜브 라이브 방송이 종료되었습니다. 최종 수집된 실시간 댓글 데이터 분석 결과를 기반으로, 스트리머가 차후 방송을 개선하고 탁월한 방송 성과를 낼 수 있도록 전문적인 '방송 종료 종합 요약 리포트(Post-Stream Analysis Report)'를 한국어로 세심하고 상세하게 마크다운 형식으로 작성하십시오.

[리포트 마크다운 기술 내용 가이드라인]
1. 📊 종합 방송 성과 평점 및 세줄 한눈에 요약
2. 🌡️ 정서 분포 추이 분석 및 시청자들의 메인 리액션
3. 🔥 라이브 중 최고의 인터랙션 유도 모먼트 (어느 주제나 멘트에서 시청자 반응이 폭발했는지)
4. 📝 해결된 핵심 FAQ 리스트 요약 및 미흡했던 부분 대응 개선안
5. ⚠️ 방송 중 드러난 아쉬웠던 위기/불만 포인트 (예: 기술 중단, 배송 우려)와 즉흥 처방 리뷰
6. 📈 다음 방송을 200% 성공시키기 위해 당장 실천 가능한 맞춤형 콘텐츠 기획, 기술 개선, 쿠폰 혜택 노출 제안

반드시 JSON 형태로 반환하십시오. responseSchema 구조를 엄격히 준수하세요. Markdown 문자열 내에서 가독성을 높이기 위해 개행문자와 이모티콘을 적극 사용하세요.`;

// ── Strict JSON Schemas (OpenAI Structured Outputs) ─────────────────────────

export const analyzeJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sentiment: {
      type: 'object',
      additionalProperties: false,
      properties: {
        positive: { type: 'integer' },
        neutral: { type: 'integer' },
        negative: { type: 'integer' }
      },
      required: ['positive', 'neutral', 'negative']
    },
    topKeywords: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          keyword: { type: 'string' },
          count: { type: 'integer' },
          trend: { type: 'string' }
        },
        required: ['keyword', 'count', 'trend']
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
          templateAnswer: { type: 'string' }
        },
        required: ['question', 'count', 'templateAnswer']
      }
    },
    specialComments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          author: { type: 'string' },
          category: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['text', 'author', 'category', 'reason']
      }
    },
    recentSummary: { type: 'string' },
    presenterActions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string' },
          message: { type: 'string' },
          target: { type: 'string' }
        },
        required: ['type', 'message', 'target']
      }
    },
    suggestedTopic: { type: 'string' }
  },
  required: [
    'sentiment', 'topKeywords', 'faq', 'specialComments',
    'recentSummary', 'presenterActions', 'suggestedTopic'
  ]
} as const;

export const reportJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reportMarkdown: { type: 'string' },
    summaryStats: {
      type: 'object',
      additionalProperties: false,
      properties: {
        totalMessages: { type: 'integer' },
        peakCpm: { type: 'integer' },
        dominantSentiment: { type: 'string' },
        resolvedFaqsCount: { type: 'integer' }
      },
      required: ['totalMessages', 'peakCpm', 'dominantSentiment', 'resolvedFaqsCount']
    }
  },
  required: ['reportMarkdown', 'summaryStats']
} as const;
