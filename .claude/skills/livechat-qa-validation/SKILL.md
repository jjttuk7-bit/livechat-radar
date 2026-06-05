---
name: livechat-qa-validation
description: LiveChat Radar 풀스택 변경의 경계면 교차 정합성을 검증한다. types.ts ↔ server.ts json_schema ↔ generateSimulatedAIAnalysis ↔ App.tsx hook을 grep으로 매칭 점검, OpenAI strict 규칙 위반(additionalProperties/required 등) 검사, tsc --noEmit lint 실행. 모듈 완성 직후마다 호출. "QA 돌려줘", "정합성 확인", "검증" 표현 시 트리거.
---

# livechat-qa-validation — 경계면 교차 비교 QA

LiveChat Radar의 풀스택 변경에서 단순 "파일이 있다"가 아니라 **경계면에서 같은 이름·같은 타입이 일관되게 흐르는지**를 검증하는 스킬.

## 핵심 원칙: 3쌍 교차 비교

새 필드 X에 대해 다음 3쌍을 모두 검증:

### 쌍 1: `types.ts` ↔ `server.ts json_schema`
- `src/types.ts`의 interface 필드 X가
- `server.ts`의 해당 엔드포인트 `jsonSchema.properties.X`로 동일 타입 매핑되는가?

### 쌍 2: `json_schema` ↔ `generateSimulatedAIAnalysis` (시뮬레이터)
- `json_schema`에 X가 추가되었다면
- `generateSimulatedAIAnalysis` 반환 객체에도 X가 채워져 있는가?
- 누락 시 DEMO MODE에서 UI가 `undefined`로 깨진다.

### 쌍 3: `json_schema` ↔ `App.tsx` 소비
- 백엔드 응답의 `data.X` 또는 `data.analysis.X`를 App.tsx 어딘가에서 읽는가?
- 안전 접근(`?.`, `?? defaultValue`)을 사용하는가?

## 검증 절차

### Step 1. 변경 사항 수집

`_workspace/` 디렉토리의 다음 파일을 읽어 변경된 필드 목록을 추출:
- `00_spec_*.md` — 의도된 변경
- `01_schema_diff.md` — 실제 schema 변경
- `02_backend_changes.md` — 백엔드 구현 노트
- `03_frontend_changes.md` — 프론트 구현 노트

### Step 2. 쌍 1 grep

각 새 필드 X에 대해:
```
Grep(pattern: "X", path: "src/types.ts")
Grep(pattern: "X['\"]\s*:", path: "server.ts")
```

타입이 일치하는지 수동 비교. 예: types에서 `count: number`인데 schema에서 `{ type: 'string' }`이면 불일치.

### Step 3. 쌍 2 grep

```
Grep(pattern: "generateSimulatedAIAnalysis", path: "server.ts", -n: true, -A: 200)
```

반환 객체 안에 X가 있는지 확인. 없으면 backend-engineer에게 보고.

### Step 4. 쌍 3 grep

```
Grep(pattern: "\.X\b|\['X'\]", path: "src/App.tsx", -n: true)
Grep(pattern: "\.X\b|\['X'\]", path: "src/components/", -n: true)
```

소비 지점이 없으면 frontend-engineer에게 보고 (의도된 무사용일 수 있으니 spec과 대조).

### Step 5. OpenAI strict 규칙 점검

`server.ts`의 모든 `jsonSchema`에 대해:

```
Grep(pattern: "type:\s*'object'", path: "server.ts", -n: true, -A: 1)
```

각 매치에 대해 다음 줄에 `additionalProperties: false`가 있는지 확인. 없으면 strict 위반.

```
Grep(pattern: "required:\s*\[", path: "server.ts", -n: true)
```

각 `required` 배열이 같은 객체의 `properties` 키 전체를 포함하는지 수동 검증.

```
Grep(pattern: "Type\.(STRING|OBJECT|ARRAY|INTEGER|NUMBER|BOOLEAN)", path: "server.ts")
```

매치가 있으면 Gemini 잔재. OpenAI 소문자로 교체 필요.

### Step 6. lint

```
Bash(command: "npm run lint")
```

`tsc --noEmit`이 실행됨. 에러가 있으면 파일/라인 추출하여 책임 에이전트에게 보고.

### Step 7. qa_report 작성

`_workspace/qa_report.md` — 아래 형식:

```markdown
## QA Report — {feature_slug} ({YYYY-MM-DD HH:MM})

### 변경 필드 목록
- `priceEstimates: PurchaseSignalPriceEstimate[]` (신규, /api/analyze 응답)

### 쌍 1: types.ts ↔ json_schema
- [✓] `priceEstimates`
  - types.ts L88: `priceEstimates: PurchaseSignalPriceEstimate[]`
  - server.ts L612: `priceEstimates: { type: 'array', items: {...} }`
  - 매핑 일치
- [✓] `PurchaseSignalPriceEstimate.avgPriceKrw`
  - types: number / schema: integer — ⚠️ 의미 일치하지만 정수 강제

### 쌍 2: json_schema ↔ simulator
- [✗] `priceEstimates`가 `generateSimulatedAIAnalysis`에 누락
  - 위치: server.ts L442-451 (return 객체)
  - 결함: DEMO 모드에서 frontend가 `analysis.priceEstimates`를 `undefined`로 받음
  - 책임: backend-engineer
  - 권고: [{item: '데모상품', minPriceKrw: 19900, ...}] 등 더미 1-2건 추가

### 쌍 3: json_schema ↔ App.tsx
- [✓] App.tsx L832: `analysis?.priceEstimates?.map(...)` 안전 접근

### Strict 규칙
- [✓] additionalProperties: false — 모든 신규 object에 존재
- [✓] required 배열 일치
- [✓] Gemini Type.* 잔재 없음
- [✓] enum 사용: `category`, `trend`, `type`

### Lint
- [✗] npm run lint: 1 error
  - src/App.tsx:832 — Property 'priceEstimates' does not exist on type 'AnalysisResult' until types.ts is rebuilt
  - 책임: 자동 해결 (TypeScript watcher 반영 대기)

### 누락/결함
1. 쌍 2: simulator에 priceEstimates 누락 → backend-engineer

### 권고
1. backend-engineer에게 위 결함 1건 보고 (`SendMessage`)
2. 수정 후 쌍 2만 재검증
```

## 점진적 QA (incremental)

- ai-schema-engineer 완료 → 쌍 1 + strict 규칙만 빠르게 (lint 생략)
- backend-engineer 완료 → 쌍 1 + 쌍 2 + lint
- frontend-engineer 완료 → 쌍 3 + lint
- 모두 완료 → 전체 통합 검증

이렇게 하면 결함이 작업 흐름 끝에 한꺼번에 쏟아지는 것을 막는다.

## 결함 보고 시 메시지 형식

```
SendMessage({
  to: "backend-engineer",
  content: "QA 결함 보고:
필드: priceEstimates
위치: server.ts L442-451 (generateSimulatedAIAnalysis)
기대: 시뮬레이터가 priceEstimates 더미 1-2건 채움
실제: 누락 (DEMO 모드에서 undefined)
참고: _workspace/qa_report.md
재검증 요청: 쌍 2만 다시"
})
```

비난 X, 데이터 O. 즉시 고칠 수 있게 구체적으로.

## 자주 놓치는 결함 패턴

1. **시뮬레이터 누락** — 가장 흔함. 새 필드의 80%가 여기서 실수
2. **enum 누락** — 카테고리/타입 필드를 자유 문자열로 두면 모델이 매번 다른 표현 생성
3. **옵셔널 → strict 충돌** — `?` 옵셔널을 strict 모드에서 그대로 두면 schema 위반
4. **App.tsx의 안전 접근 누락** — DEMO에서 `undefined.map(...)` 런타임 에러
5. **types.ts와 schema 타입 미스매치** — `number` vs `integer`, `string literal union` vs 일반 `string`
6. **카테고리 라벨 한국어 매핑 누락** — `purchase_signal`을 그대로 화면에 표시
