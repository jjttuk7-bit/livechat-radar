---
name: livechat-qa-validation
description: LiveChat Radar 풀스택 변경의 경계면 교차 정합성을 검증한다. src/types/liveTalk.ts ↔ src/prompts.ts json_schema ↔ 시뮬레이터 ↔ server.ts 응답 ↔ App.tsx hook을 grep으로 매칭 점검, enum 삼중 일치, OpenAI strict 규칙 위반, 고CPM 안티패턴, npm test·tsc --noEmit lint 실행. 모듈 완성 직후마다 호출. "QA 돌려줘", "정합성 확인", "검증", "재검증", "결함 확인" 표현 시 트리거. 안전·윤리 판단(D-1~D-8)은 politics-safety-gate 소관이다.
---

# livechat-qa-validation — 경계면 교차 비교 QA

단순 "파일이 있다"가 아니라 **경계면에서 같은 이름·같은 타입이 일관되게 흐르는지**를 검증한다.

## 대상 파일 (중요)

| 경계 | 파일 |
|------|------|
| 타입 계약 | `src/types/liveTalk.ts` (P-1 이전: `liveShopping.ts`) |
| json_schema + 프롬프트 | **`src/prompts.ts`** — `server.ts`가 아니다 |
| 시뮬레이터 | `src/lib/simulateTalkAnalysis.ts` (현행: `simulateShopAnalysis.ts`) |
| 파생 로직 | `src/lib/*.ts` + `*.test.ts` |
| UI 소비 | `src/App.tsx`, `src/components/talk/` |

## 핵심: 5쌍 교차 비교

### 쌍 1: 타입 ↔ json_schema
타입 파일의 interface 필드 X가 `src/prompts.ts`의 `properties.X`로 동일 타입 매핑되는가?

### 쌍 2: json_schema ↔ 시뮬레이터
스키마에 X가 있으면 시뮬레이터 반환 객체에도 X가 채워지는가? 누락 시 키 없는 환경에서 UI가 `undefined`로 깨진다.

### 쌍 3: 응답 ↔ App.tsx 소비
`data.analysis.X`를 어딘가에서 읽는가? 안전 접근(`?.`, `?? default`)을 쓰는가?

### 쌍 4: enum 삼중 일치 ★
태그를 추가할 때 가장 자주 깨지는 지점이다. 세 곳의 원소가 **정확히 일치**해야 한다:
- 유니온 타입 (`type TalkTag = 'a' | 'b' | ...`)
- 상수 배열 (`TALK_TAGS`)
- 축 매핑 맵 (`TAG_AXIS`)

하나라도 빠지면 축 분포 집계에 `undefined` 축이 생기거나, 모델이 낸 태그를 코드가 모른다.

### 쌍 5: 파생 로직 ↔ 테스트
`src/lib/`의 신규 함수에 대응 `*.test.ts`가 있는가? 기존 6개 테스트는 `npm test`로 실행된다.

## 검증 절차

### Step 1. 변경 사항 수집
`_workspace/`의 `00_spec_*.md`, `01_schema_diff.md`, `02_backend_changes.md`, `03_frontend_changes.md`, `04_pipeline_changes.md`를 읽어 변경 필드 목록 추출.

### Step 2. 쌍 1
```
Grep(pattern: "X", path: "src/types/liveTalk.ts")
Grep(pattern: "X['\"]?\s*:", path: "src/prompts.ts")
```
타입 일치 비교. 예: 타입이 `count: number`인데 schema가 `{ type: 'string' }`이면 불일치.

### Step 3. 쌍 2
```
Grep(pattern: "X", path: "src/lib/simulateTalkAnalysis.ts", -n: true)
```
없으면 pipeline-engineer(또는 backend-engineer)에게 보고.

### Step 4. 쌍 3
```
Grep(pattern: "\.X\b|\['X'\]", path: "src/App.tsx", -n: true)
Grep(pattern: "\.X\b|\['X'\]", path: "src/components/", -n: true)
```
소비 지점이 없으면 spec과 대조 (의도된 무사용일 수 있다).

### Step 5. 쌍 4 — enum 개수 대조
```
Grep(pattern: "TALK_TAGS", path: "src/types/liveTalk.ts", -n: true, -A: 20)
Grep(pattern: "TAG_AXIS", path: "src/types/liveTalk.ts", -n: true, -A: 15)
```
세 곳의 원소 수와 이름을 대조한다. **개수만 같고 이름이 다른 경우가 실제로 발생하므로 이름까지 본다.**

### Step 6. strict 규칙 점검
```
Grep(pattern: "type:\s*'object'", path: "src/prompts.ts", -n: true, -A: 1)
```
각 매치 다음 줄에 `additionalProperties: false`가 있는가.

```
Grep(pattern: "required:\s*\[", path: "src/prompts.ts", -n: true)
```
각 `required`가 같은 객체 `properties` 키 전체를 포함하는가.

```
Grep(pattern: "Type\.(STRING|OBJECT|ARRAY|INTEGER|NUMBER|BOOLEAN)", path: "src/prompts.ts")
```
매치가 있으면 Gemini 잔재 — 소문자로 교체 필요.

**역방향 점검:** 서버가 주입하는 메타 필드(`analyzedAt`, `generatedAt`)가 스키마에 **들어가 있으면 안 된다.** 들어가면 모델이 시각을 지어낸다.

### Step 7. 고CPM 안티패턴 ★
저volume에서는 통과하지만 CPM 300에서 깨지는 패턴을 grep으로 잡는다.

```
Grep(pattern: "slice\(-\d+\)", path: "server.ts")        # 고정 말단 윈도우 → 유실
Grep(pattern: "slice\(0,\s*\d+\)", path: "server.ts")    # 앞자르기 → 리포트 왜곡
Grep(pattern: "map\(m => m\.id\)\.join", path: "server.ts") # ID 전량 캐시 키 → 히트율 0
Grep(pattern: "messages\.map\(", path: "src/App.tsx")    # 전량 렌더 → 정지
```

매치가 나오면 즉시 결함으로 올린다. 이것들은 "지금 잘 돌아간다"가 검증이 되지 않는 부류다.

### Step 8. 게이트
```
Bash(command: "npm run lint")   # tsc --noEmit
Bash(command: "npm test")       # src/lib 단위 테스트 체인
```

### Step 9. qa_report 작성
`_workspace/qa_report.md`:

```markdown
## QA Report — {feature_slug} ({YYYY-MM-DD HH:MM})

### 변경 필드 목록
- `riskAlerts: RiskAlert[]` (신규, /api/analyze/talk 응답)

### 쌍 1: 타입 ↔ json_schema
- [✓] `riskAlerts`
  - liveTalk.ts L102: `riskAlerts: RiskAlert[]`
  - prompts.ts L88: `riskAlerts: { type: 'array', items: {...} }`

### 쌍 2: json_schema ↔ 시뮬레이터
- [✗] `riskAlerts`가 시뮬레이터에 누락
  - 위치: src/lib/simulateTalkAnalysis.ts L210 (return 객체)
  - 결함: 키 없는 환경에서 `analysis.riskAlerts`가 undefined
  - 책임: pipeline-engineer

### 쌍 3: 응답 ↔ App.tsx
- [✓] App.tsx L640: `analysis?.riskAlerts?.map(...)` 안전 접근

### 쌍 4: enum 삼중 일치
- [✓] TALK_TAGS(37) ↔ schema enum(37) ↔ TAG_AXIS 키(37), 이름 전부 일치

### 쌍 5: 파생 로직 ↔ 테스트
- [✓] `riskWatch.ts` ↔ `riskWatch.test.ts`

### Strict 규칙
- [✓] additionalProperties / required / 소문자 타입
- [✓] 서버 주입 메타(analyzedAt)가 스키마에 없음

### 고CPM 안티패턴
- [✗] server.ts L417 `messages.slice(-80)` — CPM 300에서 약 60% 유실
  - 책임: backend-engineer

### 게이트
- [✓] npm run lint (0건)
- [✓] npm test (6/6 통과)

### 누락/결함
1. 쌍 2: 시뮬레이터 riskAlerts 누락 → pipeline-engineer
2. 안티패턴: slice(-80) → backend-engineer

### 권고
1. 위 2건 보고 후 해당 쌍만 재검증
```

## 점진적 QA

- ai-schema-engineer 완료 → 쌍 1 + 쌍 4 + strict (lint 생략)
- pipeline-engineer 완료 → 쌍 5 + `npm test`
- backend-engineer 완료 → 쌍 2 + Step 7 + lint
- frontend-engineer 완료 → 쌍 3 + Step 7 + lint
- 전체 완료 → 통합 검증

결함이 작업 흐름 끝에 한꺼번에 쏟아지는 것을 막는다.

## 결함 보고 형식

```
SendMessage({
  to: "pipeline-engineer",
  content: "QA 결함 보고:
필드: riskAlerts
위치: src/lib/simulateTalkAnalysis.ts L210 (return 객체)
기대: 시뮬레이터가 riskAlerts 더미 1~2건 채움
실제: 누락 (키 없는 환경에서 undefined)
참고: _workspace/qa_report.md
재검증 요청: 쌍 2만"
})
```

비난 X, 데이터 O. 즉시 고칠 수 있게 구체적으로.

## 안전 검토와의 경계

D-1~D-8(개인 성향 라벨, 진위 판정, 편향 등)은 **이 스킬의 범위가 아니다.** 정합성과 규범은 다른 축이며, 타입이 완벽해도 만들면 안 되는 기능이 있다. 리스크 축·시청자 프로필·주장 진위·후원 유도에 닿는 변경을 감지하면 safety-reviewer에게 검토를 요청하고, 판정은 그쪽에 맡긴다.

## 자주 놓치는 결함 패턴

1. **시뮬레이터 누락** — 가장 흔하다. 새 필드의 상당수가 여기서 샌다
2. **enum 삼중 불일치** — 유니온·배열·`TAG_AXIS` 중 하나만 갱신
3. **옵셔널 → strict 충돌** — `?`를 strict 스키마에 그대로 두면 위반
4. **서버 주입 메타를 스키마에 포함** — 모델이 시각을 지어낸다
5. **App.tsx 안전 접근 누락** — 빈 응답에서 `undefined.map(...)` 런타임 에러
6. **타입 미스매치** — `number` vs `integer`, 리터럴 유니온 vs 일반 `string`
7. **고CPM 안티패턴** — 저volume 테스트로는 절대 드러나지 않는다
8. **태그 한국어 라벨 매핑 누락** — `defamation_risk`를 그대로 화면에 표시
