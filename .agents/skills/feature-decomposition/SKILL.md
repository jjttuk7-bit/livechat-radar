---
name: feature-decomposition
description: LiveChat Radar(정치·시사 라이브) 풀스택 기능 요청을 6개 경계(공유 타입 / AI 프롬프트·스키마 / L1 파이프라인 / Express 엔드포인트 / 파생 로직 / React UI)로 분해하여 spec 문서를 작성. architect 에이전트가 사용. 새 분석 카드·아젠다 지표·리스크 항목·AI 응답 필드·대시보드 패널 요청을 받으면 반드시 이 스킬로 spec을 작성한 뒤 팀에게 전달. "보완", "다시", "부분 수정" 요청에도 이 스킬로 spec을 갱신한다.
---

# feature-decomposition — 6경계 기능 분해

풀스택 변경을 6개 경계로 분해하여, 후속 에이전트가 더 묻지 않고 진행할 수 있는 구체적 spec을 작성한다.

기획 단일 출처는 `docs/plans/politics-pivot.md`다. 6축 37태그·KPI 9종·액션 카드 규칙·안전 제약 D-1~D-8이 모두 거기 있다. **태그나 지표를 임의로 발명하지 말고 기획서의 것을 쓴다.**

## 6경계

| # | 경계 | 파일 | 담당 |
|---|------|------|------|
| 1 | 공유 타입 | `src/types/liveTalk.ts` | ai-schema-engineer |
| 2 | AI 프롬프트 + strict 스키마 | **`src/prompts.ts`** | ai-schema-engineer |
| 3 | L1 로컬 파이프라인 | `src/lib/prefilter.ts`, `dedupe.ts`, `sample.ts` | pipeline-engineer |
| 4 | Express 엔드포인트 | `server.ts` | backend-engineer |
| 5 | 파생 로직 | `src/lib/*.ts` + `*.test.ts` | pipeline-engineer |
| 6 | React UI | `src/App.tsx`, `src/components/talk/` | frontend-engineer |

**횡단:** 안전 게이트(D-1~D-8)는 경계가 아니라 모든 경계를 가로지른다. safety-reviewer가 담당한다.

> 스키마는 `server.ts`가 아니라 `src/prompts.ts`에 있다 (A-3에서 분리). `evals/runner.ts`가 같은 객체를 import하므로 여기가 단일 출처다.

## 분해 절차

### Step 1. 기능 요약 (1-2줄)
사용자 요청을 한 문장으로 정리 + 기획서 참조 절 표기. 모호하면 1회 명확화 질문.

### Step 2. 경계별 변경 사항

각 경계에 "변화 없음 / 추가 / 수정"을 명시하고, 있으면 구체화:

**A. 공유 타입** — 신규 인터페이스 이름과 필드(타입, nullable 여부, 의미). 태그 추가 시 유니온·`TALK_TAGS`·`TAG_AXIS` 3곳 모두 명시.

**B. AI 프롬프트 + 스키마** — 추가/수정될 properties (소문자 타입, `additionalProperties:false`, 전 필드 `required`, nullable은 `['x','null']`). enum은 타입 파일에서 import. 모델이 새 필드를 채우게 할 프롬프트 지시문(한국어).

**C. L1 파이프라인** — 사전 항목 추가분, 새 집계 항목, 표본 전략 변경. **"모든 댓글을 AI에 넘긴다"는 전제를 쓰지 않는다** — 입력은 집계 통계 + 층화 표본이다.

**D. Express 엔드포인트** — 라우트 경로/수정점, 입력 파라미터, 응답 형태, 캐시 키 영향, 시뮬레이터가 채울 더미 값 가이드.

**E. 파생 로직** — 신규 함수 시그니처 + 대응 테스트 파일명.

**F. React UI** — 컴포넌트 이름과 위치(`src/components/talk/`), App.tsx state/fetch/useEffect, 축별 색상, 빈 상태 처리, 대량 렌더 방어(링버퍼/가상 스크롤) 필요 여부.

### Step 3. 안전 게이트 해당 항목

D-1~D-8 중 이 기능이 닿는 항목을 표기한다. **닿는 게 없으면 "해당 없음"이라고 명시적으로 적는다** (빈칸은 검토 누락과 구분되지 않는다).

닿기 쉬운 신호: 시청자 개인을 다룸(D-1~D-3), 주장 진위를 다룸(D-4), 선거 관련(D-5), 멘트 생성(D-6), 사전 변경(D-7), 저장(D-8).

### Step 4. 시뮬레이터 동기화 지시

새 필드 하나하나에 대해 시뮬레이터가 채울 더미 데이터를 명시. 이 지시가 없으면 API 키 없는 사용자가 깨진 UI를 본다.

### Step 5. 작업 순서 + 소집 팀원

7인을 매번 부르지 않는다. 필요한 팀원만 지정한다.

```
architect (현재)
  → ai-schema-engineer (단독 — 계약 확정)
    → pipeline-engineer ∥ backend-engineer ∥ frontend-engineer (병렬)
      → safety-reviewer (해당 시)
        → qa-validator (점진 + 통합)
```

| 작업 유형 | 소집 |
|-----------|------|
| AI 응답 필드 추가 | schema → backend + frontend → qa |
| L1·성능 | pipeline → backend → qa |
| UI 전용 | frontend → qa |
| 리스크·시청자 관련 | schema → pipeline → **safety** → frontend → qa |

각 에이전트가 받는 입력과 산출 파일을 1줄씩 명시.

### Step 6. 검증 항목 (3~5개)

qa-validator가 확인할 경계면 매칭 포인트를 구체적으로:
- "쌍 1: `RiskAlert.severity` (타입) ↔ schema `riskAlerts[].severity` (enum)"
- "쌍 4: 태그 1개 추가 → `TALK_TAGS` 38개 · `TAG_AXIS` 38키 일치"
- "안티패턴: 신규 라우트에 `slice(-N)` 없음"

## 출력 파일

`_workspace/00_spec_{feature_slug}.md` — 위 6 step을 섹션으로. 길이 100~200줄 권장.

## 좋은 spec vs 나쁜 spec

**나쁜 예:** "리스크 카드 추가. 백엔드/프론트 둘 다 작업 필요."
→ 후속 에이전트가 필드명·타입·위치를 추측해야 한다.

**좋은 예:**
```
타입: RiskAlert { id: string; tag: TalkTag; severity: 'low'|'medium'|'high';
                  text: string; spreadCount: number; recommendation: string }
스키마: /api/analyze/talk 응답에 riskAlerts: RiskAlert[] (max 10),
        required 전체, additionalProperties:false, severity는 enum
프롬프트: "9. riskAlerts: risk 축 댓글을 심각도순으로... 진위나 위법 여부는 판정하지 마십시오."
L1: dictionaries.ts에 단정표현 패턴 12건 추가 (진영 대칭 — safety 검토)
UI: components/talk/RiskWatchPanel.tsx (로즈 액센트), 우측 최상단 고정,
    임계 초과 시 상단 전체 폭 배너 승격, 면책 문구 상시
시뮬레이터: riskAlerts 2건 (medium 1, low 1)
안전: D-4(진위 판정 금지) · D-5(위법 판정 금지) · D-7(사전 대칭) 해당
검증: 쌍 1/2/3 riskAlerts 매칭, 쌍 4 태그 일치, 면책 문구 존재
```

## 재실행 시

- 보완 요청이면 기존 spec을 읽고 변경 diff만 추가 (덮어쓰지 않고 `_v2.md`)
- 새 기능이면 새 `00_spec_{slug}.md` 신규 작성
- 기획서에 없는 태그·지표를 요청받으면 "기획 확장 필요" 플래그를 달고 사용자에게 올린다
