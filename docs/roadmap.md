# LiveChat Radar — 고도화 로드맵

> 작성일: 2026-06-05
> 최근 완료: **B-4 (시간축 차트)** ✅ (2026-06-05)
> 진행 이력: A-1/A-2 캐싱 → A-3 평가 → B-4 시간축 → (다음: B-5 WebSocket)

---

## A. AI 품질 & 비용 (Quick Win)

| # | 항목 | 효과 | 난이도 | 상태 |
|---|------|------|------|------|
| 1 | **OpenAI Prompt Caching 적용** — 시스템/스키마 프롬프트를 캐시 마커로 분리. 동일 방송 세션 내 분석 호출이 빈번하므로 토큰 비용 50%+ 절감 가능 | 🔥🔥🔥 | 낮음 | ✅ 완료 (2026-06-05) |
| 2 | **분석 응답 캐싱 (서버 메모리/Redis)** — 같은 댓글 묶음에 대한 중복 분석 방지. CPM이 낮을 때 polling이 빈번해 같은 30개 메시지를 반복 분석하는 낭비 발생 중 | 🔥🔥 | 낮음 | ✅ 완료 (2026-06-05) |
| 3 | **프롬프트 회귀 테스트 (Evaluation Suite)** — 고정된 댓글 스냅샷 6세트 + 기대 결과로 `gpt-4o-mini` vs `gpt-4o` 응답 품질 정량 비교. 모델 교체 시 안전망 | 🔥🔥🔥 | 중간 | ✅ 완료 (2026-06-05) — 6 fixture, dry-run/live 분리 |

## B. UX 깊이 (사용자 체감)

| # | 항목 | 효과 | 난이도 | 상태 |
|---|------|------|------|------|
| 4 | **시간축 분석 차트** — CPM·감정 비율·카테고리 발생을 시간 누적해 라인/스택드 차트로 표시. 현재는 "지금 상태"만 보임 → "방송 흐름"이 보이게 됨 | 🔥🔥🔥 | 중간 | ✅ 완료 (2026-06-05) — Recharts, 3 미니 차트 단일 카드 |
| 5 | **WebSocket 푸시로 polling 대체** — 현재 3.5초 polling. 백엔드가 YouTube에서 받은 메시지를 SSE/WebSocket으로 즉시 푸시. 진행자 반응 속도 향상 | 🔥🔥 | 중간 | 대기 |
| 6 | **OBS 브라우저 소스 오버레이 라우트** — `/overlay?token=...` 경로로 투명 배경 미니 가이드 패널. 진행자가 OBS 화면에 직접 띄움 → 두 모니터 안 봐도 됨 | 🔥🔥🔥 | 중간 | 대기 |
| 7 | **방송 기록 영구 저장** — 종료 리포트를 SQLite/파일로 저장 → 과거 방송 비교, 트렌드 추적 가능 | 🔥🔥 | 중간 | 대기 |

## C. 기술 부채 (Maintainability)

| # | 항목 | 효과 | 난이도 | 상태 |
|---|------|------|------|------|
| 8 | **server.ts 모듈 분리** — 36KB 단일 파일을 `routes/youtube.ts`, `routes/analyze.ts`, `routes/report.ts`, `ai/openai-client.ts`, `simulators/`, `prompts/`로 분해. 하네스가 모듈별 핀포인트 수정 가능해짐 | 🔥🔥 | 중간 | 대기 |
| 9 | **App.tsx 컴포넌트 분리** — 56KB → `<ChatFeed/>`, `<AnalysisPanel/>`, `<PresenterActionsList/>`, `<ReportModal/>` 등 분리. 현재 `src/components/`엔 1개뿐 | 🔥🔥 | 중간 | 대기 |
| 10 | **한국어 NLP 라이브러리 도입** — 시뮬레이터의 stopwords와 어미 trim이 수동 휴리스틱. `hangul-js`, `mecab-ko-wasm` 등으로 키워드 추출 정확도 향상 | 🔥 | 중간 | 대기 |
| 11 | **타입 단일 출처 강화** — `ChatMessage.category` 같은 enum literal을 server.ts json_schema의 enum과 한 곳에서 생성하도록 (`as const` + 도출) | 🔥🔥 | 낮음 | 대기 |

## D. 하네스 진화 (Self-Improving)

| # | 항목 | 효과 | 난이도 | 상태 |
|---|------|------|------|------|
| 12 | **`prompt-engineer` 에이전트 추가** — 현재 ai-schema-engineer가 스키마+프롬프트 겸직. 분리하면 프롬프트 톤·예시·few-shot을 전담 검증. 항목 #3 evaluation suite와 짝 | 🔥🔥 | 낮음 | 대기 |
| 13 | **`security-reviewer` 에이전트 추가** — API 키 노출, CORS, 입력 검증을 별도 패스로 점검. 현재 server.ts에 키 검증은 있지만 응답에 sanitize 누락 가능 | 🔥 | 낮음 | 대기 |
| 14 | **운영용 별도 하네스 (`livechat-ops-monitor`)** — 비용/지연/에러율을 분석하고 모델·polling rate를 권고하는 별도 팀. 빌드용 하네스와 분리 | 🔥 | 중간 | 대기 |

---

## 추천 조합 (3가지 시나리오)

- 🚀 **"이번 주에 하나 한다면"**: #1 + #2 (캐싱 두 종) — 즉각적 비용 절감, 하루~이틀  ← **현재 진행**
- 📊 **"사용자 가치 다음 분기"**: #4 (시간축 차트) + #6 (OBS 오버레이) — 진행자가 실제로 더 빨라짐
- 🛠️ **"코드 건강성"**: #8 + #9 (모노리식 분리) — 이후 모든 기능 추가 속도 가속

---

## 진행 이력

| 날짜 | 작업 | 비고 |
|------|------|------|
| 2026-06-05 | 로드맵 작성, A-1/A-2 착수 | `livechat-feature-build` 하네스 적용 |
| 2026-06-05 | A-1 + A-2 완료 | `_workspace/qa_report.md` 8/8 통과, lint 통과. system 프롬프트 정적 상수화 → 향후 A-3 evaluation suite 베이스 |
| 2026-06-05 | A-3 완료 | `src/prompts.ts` 단일 출처 추출, `evals/` 6 fixture + runner + assertions, `_workspace/qa_report_eval.md` 8/8 통과. dry-run/live 분리로 사용자 친화적 인터페이스 |
| 2026-06-05 | B-4 완료 | Recharts 도입, `<TimelineDashboard/>` 단일 카드 + 3 미니 차트, App.tsx state/effect 통합, `_workspace/qa_report_b4.md` 9/9 통과 + Vite production build 성공 |
