---
name: openai-schema-design
description: src/types.ts TypeScript 인터페이스와 server.ts 내 OpenAI Structured Outputs(`response_format: json_schema, strict: true`) 스키마를 동시에 설계·수정한다. AI 분석 응답에 새 필드를 추가하거나 기존 필드 형태를 바꿀 때 반드시 이 스킬을 통해 작업하라. strict 모드 위반(additionalProperties 누락, required 불일치)을 자동 점검한다.
---

# openai-schema-design — OpenAI Structured Outputs + TypeScript 동시 설계

OpenAI의 `chat.completions.create`에서 `response_format: { type: 'json_schema', strict: true, ... }`을 사용해 모델 응답을 강제할 때, TypeScript 인터페이스와 JSON Schema를 **1:1 매핑**으로 유지하기 위한 스킬.

## 왜 동시에 작업하나

`types.ts` 인터페이스는 백엔드 응답과 프론트엔드 hook이 공유하는 단일 계약이다. 한쪽만 수정하면 런타임에 형태 불일치가 발생한다. 두 파일을 같은 작업 단위로 묶으면 컴파일 타임에 잡힐 확률이 높다.

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

### 규칙 4: 카테고리는 enum으로

자유 문자열로 두면 모델이 매번 다른 표현을 생성한다. 카테고리/타입/트렌드 같은 유한 집합은 enum:

```js
category: {
  type: 'string',
  enum: ['complaint', 'purchase_signal', 'stream_issue'],
}
trend: {
  type: 'string',
  enum: ['up', 'down', 'stable'],
}
```

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
- `src/types.ts` 전체
- `server.ts`의 영향 받는 호출부 (`/api/analyze` 또는 `/api/report`)
- 시뮬레이터 함수(`generateSimulatedAIAnalysis`)

### Step 2. types.ts 수정
- 신규 인터페이스 추가 또는 기존 인터페이스에 필드 추가
- 카테고리 필드는 유니온 리터럴 타입으로 (예: `category: 'complaint' | 'purchase_signal' | 'stream_issue'`)

### Step 3. server.ts json_schema 수정
- types.ts 변경과 1:1 매핑
- strict 규칙 6개 모두 점검
- 카테고리는 enum 사용

### Step 4. 프롬프트 보강
- `/api/analyze`나 `/api/report`의 프롬프트 텍스트(한국어 분석 요구사항 리스트)에 새 필드 작성 지시 추가
- 톤: 존댓말, "~하십시오", 가벼운 이모지 허용
- 예시 값이 도움 되면 1-2개 포함

### Step 5. 시뮬레이터 동기화
- `generateSimulatedAIAnalysis`가 새 필드를 반드시 채우도록 수정
- 더미값은 spec의 "DEMO MODE 동기화 지시"를 따름

### Step 6. 셀프 체크
- [ ] additionalProperties: false 모든 object에 있는가?
- [ ] required 배열에 properties의 모든 키가 있는가?
- [ ] 타입 키가 모두 소문자 문자열인가?
- [ ] 카테고리 필드에 enum이 있는가?
- [ ] types.ts와 schema가 1:1 매핑되는가?
- [ ] 시뮬레이터가 새 필드를 채우는가?
- [ ] 프롬프트에 새 필드 작성 지시가 있는가?

### Step 7. 산출물 작성
`_workspace/01_schema_diff.md` — 변경된 필드 목록, 의미, 프론트 소비 위치 힌트.

## 자주 발생하는 실수

1. **옵셔널 필드를 `?`로 두려는 시도** → strict 모드는 거부. nullable로 표현.
2. **`additionalProperties` 누락** → 400 에러. 모든 object에 명시.
3. **enum 누락** → 모델이 "구매 신호"/"purchase_signal"/"BUY" 등 매번 다른 값 생성.
4. **시뮬레이터 미동기화** → DEMO MODE에서 신규 필드가 `undefined` → UI 깨짐.
5. **프롬프트 미수정** → schema는 통과하지만 의미 없는 빈 배열/빈 문자열로 채워짐.

## 참고: OpenAI SDK 호출 (server.ts 헬퍼)

```ts
const completion = await ai.chat.completions.create({
  model,
  messages: [{ role: 'user', content: prompt }],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: schemaName,
      strict: true,
      schema: jsonSchema,
    },
  },
});
const text = completion.choices[0].message.content; // JSON 문자열
```

응답은 `choices[0].message.content`에 JSON 문자열. `cleanAndParseJSON` 헬퍼로 파싱.
