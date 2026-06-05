---
name: livechat-feature-build
description: LiveChat Radar(유튜브 라이브 채팅 AI 조연출 MVP)에 새 기능을 풀스택으로 추가하는 5인 에이전트 팀을 조율한다. 새 분석 카드/카테고리/대시보드 항목/AI 분석 필드/엔드포인트 추가, 기존 분석 결과 보강, 신규 메트릭, 신규 모달, AI 응답 형식 변경 시 반드시 이 스킬을 사용. "분석 추가", "카드 추가", "대시보드 항목", "AI 응답에 ~ 필드", "리포트 개선", "신규 API", "다시", "보완", "재실행", "부분 수정" 같은 표현이 나오면 반드시 트리거. 단순 단일 파일 수정이나 사소한 텍스트 변경은 직접 처리.
---

# livechat-feature-build — 풀스택 기능 빌드 오케스트레이터

LiveChat Radar에 새 기능을 추가하는 5명의 전문 에이전트 팀을 구성·조율한다. 본 스킬은 팀 구성 → 작업 분배 → 진행 모니터링 → 결과 통합 → 사용자 보고 전체를 책임진다.

## 팀 구성 (5명)

| 에이전트 | 역할 | 사용 스킬 |
|---------|------|----------|
| `architect` | 기능 spec 4경계 분해 | `feature-decomposition` |
| `ai-schema-engineer` | types.ts + OpenAI json_schema 동시 설계 | `openai-schema-design` |
| `backend-engineer` | server.ts 엔드포인트 + 시뮬레이터 동기화 | `express-endpoint-add` |
| `frontend-engineer` | App.tsx + components/ High Density UI | `react-high-density-ui` |
| `qa-validator` | 경계면 교차 비교 + lint | `livechat-qa-validation` |

**실행 모드:** 에이전트 팀 (`TeamCreate` + `SendMessage` + `TaskCreate`)

## 워크플로우

### Phase 0: 컨텍스트 확인

워크플로우 시작 시 `_workspace/` 디렉토리 상태로 실행 모드 판정:

| 조건 | 판정 |
|------|------|
| `_workspace/` 미존재 | **초기 실행** — 디렉토리 생성 후 Phase 1로 |
| `_workspace/` 존재 + 사용자가 "다시/보완/수정/이 부분만" 표현 | **부분 재실행** — 해당 에이전트만 재호출 |
| `_workspace/` 존재 + 사용자가 새 기능 요청 | **새 실행** — 기존 `_workspace/` → `_workspace_prev_{timestamp}/`로 이동 후 신규 |

### Phase 1: 기능 분해 (architect)

**실행 모드:** 서브 에이전트 (architect 단독, 후속 팀 작업의 spec 산출이 목표)

`Agent` 도구로 architect 호출:

```
Agent({
  subagent_type: "general-purpose",
  description: "Feature decomposition for LiveChat Radar",
  model: "opus",
  prompt: "당신은 .claude/agents/architect.md에 정의된 architect 에이전트입니다.
  요청: {사용자 요청}.
  먼저 .claude/agents/architect.md를 읽어 역할을 확인하고 .claude/skills/feature-decomposition/SKILL.md를 따라 _workspace/00_spec_{slug}.md를 작성하세요."
})
```

architect 산출물: `_workspace/00_spec_{feature_slug}.md`

### Phase 2: 팀 구성 + 병렬 구현

**실행 모드:** 에이전트 팀

`TeamCreate`로 4명 팀 구성 (architect 제외, 이미 산출 완료):

```
TeamCreate({
  team_name: "livechat-build",
  members: [
    { name: "ai-schema-engineer", subagent_type: "general-purpose", model: "opus" },
    { name: "backend-engineer", subagent_type: "general-purpose", model: "opus" },
    { name: "frontend-engineer", subagent_type: "general-purpose", model: "opus" },
    { name: "qa-validator", subagent_type: "general-purpose", model: "opus" }
  ]
})
```

`TaskCreate`로 작업 할당 (의존성 포함):

1. **Task A** (ai-schema-engineer): 스키마+타입 확정 → `_workspace/01_schema_diff.md`
2. **Task B** (backend-engineer): 엔드포인트/시뮬레이터 구현 → `_workspace/02_backend_changes.md` — `blockedBy: [A]`
3. **Task C** (frontend-engineer): UI 구현 → `_workspace/03_frontend_changes.md` — `blockedBy: [A]` (B와 병렬)
4. **Task D** (qa-validator): 점진 검증 → `_workspace/qa_report.md` — `blockedBy: [B, C]`

ai-schema-engineer가 완료되면 `SendMessage`로 backend/frontend에게 알리고 두 에이전트가 동시 시작.

### Phase 3: QA 검증 + 결함 수정 루프

qa-validator가 결함을 보고하면 책임 에이전트가 1회 재작업. 재검증 통과까지 반복 (최대 2회). 2회 후에도 실패하면 사용자에게 보고하고 개입 요청.

### Phase 4: 통합 + 사용자 보고

- 팀 정리 (`TeamDelete`)
- 사용자에게 변경 요약 + `_workspace/` 산출물 경로 + 다음 단계 권고 보고
- 피드백 요청: "결과에 개선할 부분이 있나요?" (Phase 7-1 진화 시작점)

## 데이터 전달 프로토콜

| 전략 | 내용 |
|------|------|
| **태스크 기반** | `TaskCreate`/`TaskUpdate`로 의존성 + 진행 추적 |
| **파일 기반** | `_workspace/00_spec_*.md` → `01_schema_diff.md` → `02/03_*.md` → `qa_report.md` 순 누적 |
| **메시지 기반** | `SendMessage`로 완료 알림, 결함 보고, 모호점 질문 실시간 교환 |

파일명 컨벤션: `{phase순번}_{agent}_{artifact}.md`. 최종 산출물(코드)은 프로젝트 본체에 직접 반영, `_workspace/`는 감사 추적용으로 보존.

## 에러 핸들링

| 상황 | 대응 |
|------|------|
| ai-schema-engineer 타입 충돌 발견 | architect에게 spec 보완 요청 (1회) → 실패 시 사용자 보고 |
| backend/frontend가 spec 모호점 발견 | architect에게 즉시 질문 → architect가 spec 보완 후 재개 |
| qa-validator 결함 보고 | 책임 에이전트 1회 재작업 → 재검증 통과 못하면 2차 시도 → 2회 실패 시 사용자 보고 |
| OpenAI strict 위반 (additionalProperties 누락 등) | ai-schema-engineer 자동 수정 (보고만) |
| `tsc --noEmit` 실패 | 라인/파일 명시하여 책임 에이전트에게 보고 |

상충 데이터는 삭제하지 않고 `qa_report.md`에 출처 병기.

## 팀 크기 가이드

이 워크플로우는 5인 팀 (architect 단독 1 + 팀 4). 작업 분량이 매우 작으면(예: "라벨 텍스트만 바꿔줘") 팀 구성 없이 backend 또는 frontend 1명만 서브 에이전트로 호출하여 비용 절감.

## 후속 작업 지원

- 트리거 키워드에 "다시", "보완", "재실행", "부분 수정" 포함됨
- Phase 0에서 `_workspace/` 상태로 초기/새/부분 모드 자동 판별
- 각 에이전트 정의에 "재호출 지침" 섹션 있음 — 이전 산출물 존재 시 동작 명시

## 테스트 시나리오

**정상 흐름:**
사용자: "구매 신호 댓글의 평균 단가를 추정하는 새 카드를 대시보드에 추가해줘"
1. architect: spec 작성 — `PurchaseSignalPriceEstimate` 인터페이스 + `/api/analyze` 응답에 `priceEstimates: PurchaseSignalPriceEstimate[]` 필드 + App.tsx에 `<PriceEstimateCard />` MetricCard 사용
2. ai-schema-engineer: types.ts에 인터페이스 추가, json_schema에 필드 추가, 시뮬레이터에 더미 데이터 추가
3. backend-engineer (Task B 시작): /api/analyze 프롬프트에 "구매 신호별 단가 추정" 지시 추가, 시뮬레이터 함수 보강
4. frontend-engineer (Task C 시작, B와 병렬): PriceEstimateCard.tsx 생성, App.tsx에 state/effect 추가
5. qa-validator: 3쌍 교차 비교 + lint → 통과
6. 사용자 보고: "추가 완료. 변경 파일 N개. DEMO MODE도 정상 동작"

**에러 흐름:**
사용자: "감정 분포를 7단계로 세분화해줘"
1. architect: spec 작성 — `sentiment`를 7키 객체로 확장
2. ai-schema-engineer: types.ts 수정, schema 수정. 시뮬레이터 함수 누락 (실수)
3. qa-validator: 쌍 2(schema ↔ simulator) 실패 보고 → ai-schema-engineer에게 메시지
4. ai-schema-engineer: 시뮬레이터에 7단계 더미 추가, 재완료 메시지
5. qa-validator: 재검증 통과 → 통합

## CLAUDE.md 동기화

본 스킬을 통한 변경마다 `CLAUDE.md`의 "변경 이력" 테이블에 1줄 추가:
- 날짜: 작업 완료일
- 변경 내용: 추가된 기능 요약 (~30자)
- 대상: 영향 받은 에이전트/스킬
- 사유: 사용자 요청 또는 피드백 요지
