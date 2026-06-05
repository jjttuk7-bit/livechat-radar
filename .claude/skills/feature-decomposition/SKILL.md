---
name: feature-decomposition
description: LiveChat Radar 풀스택 기능 요청을 4개 경계(공유 타입 / OpenAI 스키마 / Express 엔드포인트 / React UI)로 분해하여 spec 문서를 작성. architect 에이전트가 사용. 새 분석 카드/카테고리/AI 응답 필드/대시보드 항목 요청을 받으면 반드시 이 스킬을 통해 spec을 작성한 뒤 팀에게 전달.
---

# feature-decomposition — 4경계 기능 분해

LiveChat Radar의 풀스택 변경을 4개 경계로 분해하여, 후속 에이전트가 더 묻지 않고 진행할 수 있는 구체적인 spec을 작성한다.

## 4경계

1. **공유 타입 (`src/types.ts`)** — 백엔드 응답과 프론트엔드 상태가 공유하는 인터페이스
2. **OpenAI Structured Output 스키마 (`server.ts` 내 `jsonSchema`)** — 모델이 생성할 JSON의 strict 계약
3. **Express 엔드포인트 (`server.ts`)** — 요청 검증, AI 호출, 시뮬레이터 fallback, 응답 직렬화
4. **React UI (`src/App.tsx`, `src/components/`)** — state/effect, 컴포넌트, MetricCard 활용

## 분해 절차

### Step 1. 기능 요약 (1-2줄)
사용자 요청을 한 문장으로 정리. 모호한 표현은 1회 명확화 질문.

### Step 2. 경계별 변경 사항 식별

각 경계에 대해 "변화 없음 / 추가 / 수정" 중 무엇인지, 무엇이 어떻게 바뀌는지 명시:

#### A. 공유 타입
- 신규 인터페이스 이름과 필드 (타입, 옵셔널 여부, 의미)
- 기존 인터페이스 수정 시 변경 diff

#### B. OpenAI 스키마
- 영향 받는 엔드포인트 (`/api/analyze` 또는 `/api/report`)
- 추가/수정될 properties (타입은 OpenAI strict 규칙 — `'string'`, `'integer'` 등 소문자)
- enum이 필요한 카테고리 필드는 enum 값 명시
- 새 필드를 모델이 채우게 할 프롬프트 지시 (한국어, 기존 톤)

#### C. Express 엔드포인트
- 신규 라우트 경로 또는 기존 라우트 수정점
- 입력 파라미터, 응답 형태
- 시뮬레이터(`generateSimulatedAIAnalysis` 또는 신규 함수)가 채울 더미 값 가이드

#### D. React UI
- 신규 컴포넌트 이름과 파일 위치 (`src/components/`)
- App.tsx에 추가될 state/fetch 함수/useEffect
- 디자인 토큰 (배경, 보더, 폰트, 아이콘, 카테고리 색상)
- MetricCard 재사용 여부

### Step 3. DEMO MODE 동기화 지시

새 필드 하나하나에 대해 DEMO 시뮬레이터가 어떤 더미 데이터를 채울지 명시. 이 지시가 없으면 API 키 없는 사용자가 깨진 UI를 보게 된다.

### Step 4. 작업 순서 명시

```
architect (현재) 
  → ai-schema-engineer (단독)
    → backend-engineer ∥ frontend-engineer (병렬)
      → qa-validator (점진 + 통합)
```

각 에이전트가 받는 입력과 산출 파일을 1줄씩 명시.

### Step 5. 검증 항목 (3-5개)

qa-validator가 확인해야 할 경계면 매칭 포인트를 구체적으로:
- "쌍 1: `PurchaseSignalPriceEstimate.avgPriceKrw` (types) ↔ schema `priceEstimates[].avgPriceKrw` (number)"
- "쌍 3: App.tsx의 `analysis.priceEstimates?.map(...)` 안전 접근 확인"

## 출력 파일

`_workspace/00_spec_{feature_slug}.md` — 위 5 step을 섹션으로 작성. 길이 100-200줄 권장.

## 좋은 spec vs 나쁜 spec

**나쁜 예:** "구매 신호 카드 추가. 백엔드/프론트 둘 다 작업 필요."
→ 후속 에이전트가 필드명, 타입, 위치를 추측해야 함.

**좋은 예:**
```
타입: `PurchaseSignalPriceEstimate { item: string; minPriceKrw: number; maxPriceKrw: number; sampleCount: number }`
스키마: /api/analyze 응답에 `priceEstimates: PurchaseSignalPriceEstimate[]` (max 3), required, additionalProperties: false
프롬프트: "8. priceEstimates: ..."
UI: components/PriceEstimateCard.tsx (MetricCard 기반, emerald 액센트), App.tsx 메트릭 그리드 3행에 배치
시뮬레이터: [{ item: '신제품 라이브 모델', minPriceKrw: 79000, ... }] 1-2건
검증: 쌍 1/2/3 각각 priceEstimates 필드 매칭, App.tsx의 안전 접근
```

## 재실행 시

- 같은 기능에 대해 보완 요청이 오면 기존 spec을 읽고 변경 diff만 추가 (덮어쓰지 않고 `_v2.md`로)
- 새 기능 요청이면 새 `_spec_{slug}.md` 파일 신규 작성
