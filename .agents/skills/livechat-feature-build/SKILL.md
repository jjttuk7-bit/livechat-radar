---
name: livechat-feature-build
description: LiveChat Radar(유튜브 정치·시사 라이브 AI 조연출)에 새 기능을 풀스택으로 추가하는 7인 에이전트 팀을 조율한다. 새 분석 카드·아젠다 지표·리스크 항목·대시보드 패널·AI 분석 필드·엔드포인트 추가, 기존 분석 보강, 신규 메트릭, 신규 모달, L1 파이프라인 변경, AI 응답 형식 변경 시 반드시 이 스킬을 사용. "분석 추가", "카드 추가", "대시보드 항목", "AI 응답에 ~ 필드", "리포트 개선", "신규 API", "아젠다", "리스크", "성능", "다시", "보완", "재실행", "부분 수정" 같은 표현이 나오면 반드시 트리거. 단순 단일 파일 수정이나 사소한 텍스트 변경은 직접 처리.
---

# livechat-feature-build — 풀스택 기능 빌드 오케스트레이터

정치·시사 라이브 AI 조연출에 기능을 추가하는 7명의 전문 에이전트 팀을 구성·조율한다. 팀 구성 → 작업 분배 → 진행 모니터링 → 결과 통합 → 사용자 보고 전체를 책임진다.

기획 단일 출처는 `docs/plans/politics-pivot.md`다.

## 팀 구성 (7명)

| 에이전트 | 역할 | 사용 스킬 |
|---------|------|----------|
| `architect` | 기능 spec 6경계 분해 | `feature-decomposition` |
| `ai-schema-engineer` | `types/liveTalk.ts` + `prompts.ts` 동시 설계 | `openai-schema-design` |
| `pipeline-engineer` | L1 파이프라인·파생 로직·시뮬레이터 | `highvolume-pipeline` |
| `backend-engineer` | `server.ts` 엔드포인트 + 표본 조립 | `express-endpoint-add` |
| `frontend-engineer` | `App.tsx` + `components/talk/` UI | `react-high-density-ui` |
| `safety-reviewer` | D-1~D-8 안전·윤리 게이트 | `politics-safety-gate` |
| `qa-validator` | 경계면 교차 비교 + lint/test | `livechat-qa-validation` |

**실행 모드:** 하이브리드 — Phase 1은 서브 에이전트(architect 단독), Phase 2~3은 에이전트 팀(`TeamCreate` + `SendMessage` + `TaskCreate`)

## 전원 소집하지 않는다

7인을 매번 부르면 조율 오버헤드가 이득을 넘는다. **architect가 spec에 소집 명단을 적고, 그 명단만 팀으로 구성한다.**

| 작업 유형 | 소집 (architect 제외) |
|-----------|----------------------|
| AI 응답 필드 추가 | schema → backend + frontend → qa (4명) |
| L1 파이프라인·성능 | pipeline → backend → qa (3명) |
| UI 전용 (기존 데이터 재배치) | frontend → qa (2명) |
| **리스크·시청자·진위·후원 관련** | schema → pipeline → **safety** → frontend → qa (5명) |
| 신규 엔드포인트 | schema → backend → frontend → qa (4명) |

**safety-reviewer 필수 소집 조건:** 시청자 개인을 다룸 / 주장 진위를 다룸 / 선거 관련 / 멘트 생성 / 리스크 사전 변경 / 저장소 관련. 하나라도 걸리면 반드시 넣는다.

## 워크플로우

### Phase 0: 컨텍스트 확인

`_workspace/` 상태로 실행 모드 판정:

| 조건 | 판정 |
|------|------|
| `_workspace/` 미존재 | **초기 실행** — 디렉토리 생성 후 Phase 1 |
| 존재 + "다시/보완/수정/이 부분만" | **부분 재실행** — 해당 에이전트만 재호출 |
| 존재 + 새 기능 요청 | **새 실행** — 기존 → `_workspace_prev_{timestamp}/` 이동 후 신규 |

### Phase 1: 기능 분해 (architect 단독)

**실행 모드:** 서브 에이전트

```
Agent({
  subagent_type: "general-purpose",
  description: "Feature decomposition for LiveChat Radar",
  model: "opus",
  prompt: "당신은 .claude/agents/architect.md에 정의된 architect 에이전트입니다.
  요청: {사용자 요청}.
  .claude/agents/architect.md를 읽어 역할을 확인하고,
  .claude/skills/feature-decomposition/SKILL.md를 따라
  _workspace/00_spec_{slug}.md를 작성하세요.
  spec에는 반드시 (a) 6경계별 변경, (b) 안전 게이트 해당 D 항목,
  (c) 소집 팀원 명단을 포함하세요."
})
```

산출물: `_workspace/00_spec_{feature_slug}.md`

### Phase 2: 팀 구성 + 병렬 구현

**실행 모드:** 에이전트 팀

spec의 소집 명단대로 `TeamCreate`. 예 (리스크 기능 — 5명):

```
TeamCreate({
  team_name: "livechat-build",
  members: [
    { name: "ai-schema-engineer", subagent_type: "general-purpose", model: "opus" },
    { name: "pipeline-engineer",  subagent_type: "general-purpose", model: "opus" },
    { name: "backend-engineer",   subagent_type: "general-purpose", model: "opus" },
    { name: "frontend-engineer",  subagent_type: "general-purpose", model: "opus" },
    { name: "safety-reviewer",    subagent_type: "general-purpose", model: "opus" },
    { name: "qa-validator",       subagent_type: "general-purpose", model: "opus" }
  ]
})
```

`TaskCreate`로 의존성과 함께 할당:

1. **Task A** (ai-schema-engineer): 타입 + 스키마 확정 → `_workspace/01_schema_diff.md`
2. **Task B** (pipeline-engineer): L1/파생/시뮬레이터 → `_workspace/04_pipeline_changes.md` — `blockedBy: [A]`
3. **Task C** (backend-engineer): 엔드포인트 + 표본 조립 → `_workspace/02_backend_changes.md` — `blockedBy: [A, B]`
4. **Task D** (frontend-engineer): UI → `_workspace/03_frontend_changes.md` — `blockedBy: [A]` (B·C와 병렬)
5. **Task E** (safety-reviewer): D 항목 판정 → `_workspace/05_safety_review.md` — `blockedBy: [A, B, D]` *(해당 시에만)*
6. **Task F** (qa-validator): 점진 검증 → `_workspace/qa_report.md` — `blockedBy: [C, D]`

Task A 완료 시 `SendMessage`로 나머지에게 알려 병렬 시작. backend는 pipeline의 L1 산출물 shape이 필요하므로 B에도 의존한다.

### Phase 3: 게이트 + 결함 수정 루프

**두 게이트를 통과해야 통합한다.**

| 게이트 | 담당 | 실패 시 |
|--------|------|---------|
| 정합성 (타입·스키마·시뮬레이터·enum·안티패턴·lint/test) | qa-validator | 책임 에이전트 1회 재작업, 최대 2회 |
| **안전 (D-1~D-8)** | safety-reviewer | **반려 시 통합 보류.** 대안 설계로 재작업 |

안전 반려는 "나중에 고치자"가 성립하지 않는다. 정합성 결함과 다르게 취급한다.

2회 시도 후에도 통과하지 못하면 사용자에게 보고하고 개입을 요청한다.

### Phase 4: 통합 + 사용자 보고

- 팀 정리 (`TeamDelete`)
- 사용자에게 변경 요약 + `_workspace/` 산출물 경로 + 다음 단계 권고
- 피드백 요청: "결과에 개선할 부분이 있나요?"

## 데이터 전달 프로토콜

| 전략 | 내용 |
|------|------|
| **태스크 기반** | `TaskCreate`/`TaskUpdate`로 의존성 + 진행 추적 |
| **파일 기반** | `00_spec_*.md` → `01_schema_diff.md` → `02/03/04_*.md` → `05_safety_review.md` → `qa_report.md` |
| **메시지 기반** | `SendMessage`로 완료 알림, 결함 보고, 모호점 질문 |

최종 산출물(코드)은 프로젝트 본체에 직접 반영, `_workspace/`는 감사 추적용으로 보존.

## 에러 핸들링

| 상황 | 대응 |
|------|------|
| 타입 충돌 발견 | architect에게 spec 보완 요청 (1회) → 실패 시 사용자 보고 |
| spec 모호점 | architect에게 즉시 질문 → 보완 후 재개 |
| L1 산출물 shape 불명 | backend가 임의 가정하지 말고 pipeline에게 문의 |
| qa 결함 보고 | 책임 에이전트 1회 재작업 → 2회 실패 시 사용자 보고 |
| **safety 반려** | 대안 설계로 재작업. 회색지대는 사용자에게 판단을 올린다 |
| strict 위반 | ai-schema-engineer 자동 수정 (보고만) |
| `npm run lint` / `npm test` 실패 | 파일:라인 명시하여 책임 에이전트에게 |

상충 데이터는 삭제하지 않고 `qa_report.md`에 출처 병기.

## 소규모 작업

"라벨 텍스트만 바꿔줘" 수준이면 팀을 만들지 않고 해당 에이전트 1명만 서브 에이전트로 호출한다. 단, **리스크·시청자·진위 관련은 아무리 작아도 safety-reviewer를 건너뛰지 않는다.**

## 후속 작업 지원

- 트리거에 "다시", "보완", "재실행", "부분 수정" 포함
- Phase 0에서 `_workspace/` 상태로 초기/새/부분 모드 자동 판별
- 각 에이전트 정의에 "재호출 지침" 섹션 존재

## 테스트 시나리오

**정상 흐름 (안전 게이트 포함):**
사용자: "채팅에서 위험한 댓글을 실시간으로 잡아주는 패널 추가해줘"
1. architect: spec 작성 — `RiskAlert` 인터페이스, `/api/analyze/talk` 응답에 `riskAlerts[]`, `components/talk/RiskWatchPanel.tsx`. 안전 항목 **D-4·D-5·D-7 해당** 표기. 소집: schema/pipeline/safety/frontend/qa
2. ai-schema-engineer: `liveTalk.ts`에 `RiskAlert` 추가, `prompts.ts` 스키마 + "진위·위법 판정 금지" 지시문 유지
3. pipeline-engineer: `dictionaries.ts`에 단정표현 패턴 추가, `riskWatch.ts` + 테스트, 시뮬레이터 보강
4. frontend-engineer (병렬): `RiskWatchPanel.tsx` (로즈 액센트), 면책 문구 상시 노출
5. safety-reviewer: 사전 진영 대칭성 검토 → 한쪽에만 있는 항목 3건 지적 → pipeline 보완 → 승인
6. qa-validator: 5쌍 + 안티패턴 + lint/test → 통과
7. 보고: "추가 완료. 변경 파일 N개. 안전 게이트 승인. 키 없는 환경도 정상"

**에러 흐름 (안전 반려):**
사용자: "댓글러들 성향별로 분류해서 보여줘"
1. architect: spec 작성 중 **D-1 정면 위반** 감지 → 안전 항목에 D-1 표기, safety 소집
2. safety-reviewer: **반려.** 개인×정치성향 매핑은 민감정보이며 방어 불가
3. safety-reviewer가 대안 제시: 집계 여론 분포 차트 + 참여도 기준 활성 시청자 보드 (비민감 축만)
4. 오케스트레이터가 사용자에게 반려 사유와 대안을 보고하고 진행 여부 확인
5. 사용자 승인 시 대안 설계로 Phase 1부터 재시작

## CLAUDE.md 동기화

본 스킬을 통한 변경마다 `CLAUDE.md`의 "변경 이력"에 1줄 추가: 날짜 / 변경 내용(~30자) / 대상 / 사유.
