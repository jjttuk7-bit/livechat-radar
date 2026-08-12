---
name: openai-schema-design
description: src/types/liveTalk.ts TypeScript 인터페이스와 src/prompts.ts의 OpenAI Structured Outputs(`response_format: json_schema, strict: true`) 스키마·시스템 프롬프트를 동시에 설계·수정한다. AI 분석 응답에 새 필드를 추가하거나 기존 필드 형태를 바꿀 때, 태그·축 enum을 변경할 때 반드시 이 스킬을 통해 작업하라. strict 모드 위반(additionalProperties 누락, required 불일치)을 자동 점검한다.
---

# openai-schema-design — OpenAI Structured Outputs + TypeScript 동시 설계

OpenAI의 `chat.completions.create`에서 `response_format: { type: 'json_schema', strict: true, ... }`을 사용해 모델 응답을 강제할 때, TypeScript 인터페이스와 JSON Schema를 **1:1 매핑**으로 유지하기 위한 스킬.

## 대상 파일 (중요)

| 무엇 | 어디 |
|------|------|
| 타입 인터페이스 + enum 배열 | `src/types/liveTalk.ts` (P-1 이전: `src/types/liveShopping.ts`) |
| json_schema + 시스템 프롬프트 | **`src/prompts.ts`** — `server.ts`가 아니다 |
| 시뮬레이터 | `src/lib/simulateTalkAnalysis.ts` (현행: `simulateShopAnalysis.ts`) |

`src/prompts.ts`가 단일 출처인 이유: `server.ts`(런타임)와 `evals/runner.ts`(회귀 평가)가 **같은 객체를 import**한다. 스키마를 server.ts에 인라인으로 쓰면 평가와 런타임이 갈라진다.

## 왜 동시에 작업하나

타입 인터페이스는 백엔드 응답과 프론트엔드 hook이 공유하는 단일 계약이다. 한쪽만 수정하면 런타임에 형태 불일치가 발생한다. 두 파일을 같은 작업 단위로 묶으면 컴파일 타임에 잡힐 확률이 높다.

## OpenAI Structured Outputs strict 규칙

OpenAI의 strict 모드는 다음 규칙을 **모두** 만족해야 한다. 위반 시 API가 400을 반환한다.

### 규칙 1: 모든 `object`에 `additionalProperties: false`

```js
// ✅ 옳음
{
  type: 'object',
  additionalProperties: false,
  properties: { /* ... */ },
  required: [ /* ... */ ],
}

// ❌ strict 위반
{
  type: 'object',
  properties: { /* ... */ },
  required: [ /* ... */ ],
}
```

### 규칙 2: `properties`의 모든 키가 `required`에 포함

strict 모드는 옵셔널 필드를 허용하지 않는다. 옵셔널이 필요하면 union으로 표현:

```js
{
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    nickname: { type: ['string', 'null'] }, // nullable
  },
  required: ['name', 'nickname'], // 둘 다 required, null 허용
}
```

### 규칙 3: 타입 키는 소문자 문자열

```js
// ✅ OpenAI
{ type: 'string' }
{ type: 'integer' }
{ type: 'array', items: { type: 'object', ... } }

// ❌ Gemini 잔재
{ type: Type.STRING }
{ type: Type.ARRAY, items: { type: Type.OBJECT, ... } }
```

### 규칙 4: 유한 집합은 enum으로, 그리고 enum은 타입 파일에서 import

자유 문자열로 두면 모델이 매번 다른 표현을 생성한다. 축/태그/감정/긴급도 같은 유한 집합은 enum으로 좁힌다.

**중요: enum 값을 스키마에 다시 나열하지 마라.** 타입 파일의 상수 배열을 import해서 쓴다. 두 곳에 적으면 반드시 갈라진다.

```ts
// src/types/liveTalk.ts — 단일 출처
export const TALK_AXES = ['agenda','stance','emotion','inquiry','loyalty','risk'] as const;
export const TALK_TAGS = ['issue_mention', /* ... 37개 ... */, 'other'] as const;

// src/prompts.ts — 재사용
import { TALK_AXES, TALK_TAGS } from './types/liveTalk.js';

axis: { type: 'string', enum: TALK_AXES },
tag:  { type: 'string', enum: TALK_TAGS },
sentiment: { type: 'string', enum: ['positive','neutral','negative'] },
```

태그를 추가할 때는 **세 곳이 동시에** 갱신되어야 한다: 유니온 타입, `TALK_TAGS` 배열, `TAG_AXIS` 맵. 하나라도 빠지면 qa-validator의 "쌍 4: enum 삼중 일치"에서 걸린다.

### 규칙 5: 루트는 반드시 `type: 'object'`

배열을 응답하고 싶다면 `{ items: [...] }` 같은 wrapper 객체로 감싼다.

### 규칙 6: 깊이 5단계, 총 properties 100개 제한 (OpenAI 공식 한도)

깊은 중첩이 필요하면 평탄화하거나 별도 엔드포인트로 분리.

## TypeScript ↔ JSON Schema 매핑 표

| TypeScript | JSON Schema |
|-----------|------------|
| `string` | `{ type: 'string' }` |
| `number` (정수) | `{ type: 'integer' }` |
| `number` (실수) | `{ type: 'number' }` |
| `boolean` | `{ type: 'boolean' }` |
| `'a' \| 'b' \| 'c'` | `{ type: 'string', enum: ['a', 'b', 'c'] }` |
| `T \| null` | `{ type: ['T-type', 'null'] }` |
| `T[]` | `{ type: 'array', items: { ... } }` |
| `{ x: T; y: U }` | `{ type: 'object', additionalProperties: false, properties: {...}, required: [...] }` |
| `?` 옵셔널 | strict 모드에서는 nullable로 (`T \| null`)로 표현 |

## 작업 절차

### Step 1. 현재 상태 읽기
- `src/types/liveTalk.ts` 전체 (인터페이스 + enum 배열 + `TAG_AXIS` 맵)
- `src/prompts.ts` — 영향 받는 스키마와 시스템 프롬프트
- 시뮬레이터 `src/lib/simulateTalkAnalysis.ts`

### Step 2. 타입 파일 수정
- 신규 인터페이스 추가 또는 기존 인터페이스에 필드 추가
- 유한 집합은 유니온 리터럴 타입 + 상수 배열 + (태그면) `TAG_AXIS` 맵까지 3곳 동시 갱신
- 서버가 주입하는 메타 필드(`analyzedAt` 등)만 TS 옵셔널로 두고 스키마에는 넣지 않는다

### Step 3. src/prompts.ts json_schema 수정
- 타입 변경과 1:1 매핑
- strict 규칙 6개 모두 점검
- enum은 타입 파일에서 import (규칙 4)

### Step 4. 시스템 프롬프트 보강
- `[분석 요구사항]` 목록에 새 필드 작성 지시 추가
- 톤: 존댓말, "~하십시오"
- **안전 지침 4종은 절대 삭제·약화하지 않는다** (D-1 성향 라벨 금지 / D-4 진위 판정 금지 / D-5 위법 판정 금지 / D-6 공격 문구 금지). 손대야 하면 safety-reviewer에게 먼저 문의
- 정적 system은 상수로 유지 — 호출별 데이터를 섞으면 Prompt Caching prefix가 깨진다

### Step 5. 시뮬레이터 동기화
- 시뮬레이터가 새 필드를 반드시 채우도록 수정 (키 없는 환경 보장)
- 더미값은 spec의 "시뮬레이터 동기화 지시"를 따름

### Step 6. 셀프 체크
- [ ] additionalProperties: false 모든 object에 있는가?
- [ ] required 배열에 properties의 모든 키가 있는가?
- [ ] 타입 키가 모두 소문자 문자열인가?
- [ ] 유한 집합에 enum이 있고, 타입 파일에서 import했는가?
- [ ] 태그 추가 시 유니온·배열·`TAG_AXIS` 세 곳이 일치하는가?
- [ ] 서버 주입 메타 필드가 스키마에 **없는가**?
- [ ] 타입과 schema가 1:1 매핑되는가?
- [ ] 시뮬레이터가 새 필드를 채우는가?
- [ ] 프롬프트에 새 필드 작성 지시가 있고, 안전 지침 4종이 살아 있는가?

### Step 7. 산출물 작성
`_workspace/01_schema_diff.md` — 변경된 필드 목록, 의미, 프론트 소비 위치 힌트.

## 자주 발생하는 실수

1. **옵셔널 필드를 `?`로 두려는 시도** → strict 모드는 거부. nullable로 표현.
2. **`additionalProperties` 누락** → 400 에러. 모든 object에 명시.
3. **enum 누락** → 모델이 "분노"/"outrage"/"ANGRY" 등 매번 다른 값 생성.
4. **enum을 스키마에 재나열** → 타입 파일과 갈라짐. import로 재사용.
5. **태그 추가 시 `TAG_AXIS` 누락** → 축 분포 집계에서 `undefined` 축이 생김.
6. **시뮬레이터 미동기화** → 키 없는 환경에서 신규 필드가 `undefined` → UI 깨짐.
7. **프롬프트 미수정** → schema는 통과하지만 의미 없는 빈 배열/빈 문자열로 채워짐.
8. **서버 주입 메타를 스키마에 포함** → 모델이 `analyzedAt`을 지어낸다. 스키마에서 빼고 서버가 덮어쓴다.

## 참고: OpenAI SDK 호출 (server.ts 헬퍼)

```ts
const completion = await ai.chat.completions.create({
  model,
  messages: [
    { role: 'system', content: systemPrompt },  // 정적 — Prompt Caching prefix
    { role: 'user',   content: userPrompt   },  // 호출별 데이터만
  ],
  response_format: {
    type: 'json_schema',
    json_schema: { name: schemaName, strict: true, schema: jsonSchema },
  },
});
const text = completion.choices[0].message.content; // JSON 문자열
```

**system/user 분리는 성능 요구사항이다.** 매 호출 동일한 systemPrompt를 `messages[0]`에 두면 캐시된 입력 토큰에 할인이 걸린다. 정적 프롬프트에 호출별 데이터를 섞으면 prefix가 매번 달라져 캐시가 죽는다.

응답은 `choices[0].message.content`에 JSON 문자열. `cleanAndParseJSON` 헬퍼로 파싱.
