# LiveChat Radar — 프로젝트 가이드

## 하네스: LiveChat Radar 풀스택 기능 빌드

**목표:** 유튜브 라이브 채팅 AI 조연출 대시보드에 새 분석/카드/엔드포인트를 풀스택으로 일관되게 추가한다.

**트리거:** LiveChat Radar에 새 분석 카드/카테고리/대시보드 항목/AI 분석 필드/엔드포인트 추가, 기존 분석 결과 보강, 신규 메트릭, 신규 모달, AI 응답 형식 변경 요청 시 `livechat-feature-build` 스킬을 사용하라. 단순 텍스트 수정, 색상 한두 곳 변경, 라벨 변경 등은 직접 처리.

**기술 스택 메모 (참고용, 자세한 패턴은 스킬에서):**
- AI: OpenAI `chat.completions` + Structured Outputs (`json_schema` strict 모드), 모델 `gpt-4o-mini` 우선 / `gpt-4o` 폴백
- Frontend: React 19 + Tailwind CSS 4 + Lucide-React + Motion + Recharts. 디자인 시스템은 Linear — 캔버스 `#08090a`, 토큰은 `src/index.css` `@theme`, 상세는 `DESIGN.md`
- Backend: Express + `tsx` (TypeScript Native Type Stripping), 모노리식 `server.ts`
- 외부 API: YouTube Data API v3

**환경변수:** `OPENAI_API_KEY`, `YOUTUBE_API_KEY`. 미설정 시 자동으로 로컬 시뮬레이터로 폴백.

**변경 이력:**

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-05 | Gemini → OpenAI 전환 | server.ts, package.json, .env.example, README.md, metadata.json | 사용자 요청 ("OpenAI API key 사용") |
| 2026-06-05 | 초기 하네스 구성 (5인 팀 + 6개 스킬) | 전체 (.Codex/agents/, .Codex/skills/) | 풀스택 기능 추가를 일관된 워크플로우로 빌드 |
| 2026-06-05 | 고도화 로드맵 작성 (14개 항목 4축) | docs/roadmap.md | 다음 작업 우선순위 가시화 |
| 2026-06-05 | A-1 + A-2 캐싱 구현 (Prompt Caching + 응답 LRU 캐시) | server.ts | OpenAI 호출 비용/지연 감축. 헬퍼 시그니처 systemPrompt/userPrompt 분리 |
| 2026-06-05 | A-3 Evaluation Suite 구축 | src/prompts.ts (신규), evals/ (신규), server.ts (정리), package.json | 프롬프트/스키마 회귀 자동 채점. dry-run/live 분리, 6 fixture, universal+specific assertions |
| 2026-06-05 | B-4 Timeline Dashboard 구현 | src/types.ts, src/components/TimelineDashboard.tsx (신규), src/App.tsx, package.json (+recharts) | CPM/정서/카테고리 시간축 추이 시각화. 단일 카드 + 3 미니 차트, 캐핑 슬라이딩 윈도우, 빈 상태 처리 |
| 2026-06-06 | E-0 Vercel Serverless 배포 | api/index.ts (신규), vercel.json (신규), server.ts | catch-all rewrites + ESM `.js` 확장자 + `process.env.VERCEL` 가드 + `export default app`. 라이브: https://livechat-radar.vercel.app |
| 2026-06-06 | 폴링/자동분석 stale closure 버그 fix | src/App.tsx | `isPollingRef`, `pollingRateRef`, `messagesCountRef`, `isAnalyzingRef`, `runAIAnalysisRef` 도입. 댓글 폴링 무한 지속 + 자동 분석 40s cadence 복원 |
| 2026-06-06 | Recharts 레이아웃 fix (Grid → Flex) | src/App.tsx, src/components/TimelineDashboard.tsx | `width(-1)` collapse 이슈 해소. main `grid grid-cols-12` → `flex flex-col lg:flex-row`, 모든 section `min-w-0`, ResponsiveContainer `minWidth={0}` |
| 2026-06-06 | 고도화 로드맵 v2 (E 트랙 신설) | docs/roadmap.md | 운영 안정성 5개 항목(E-0~E-4) 추가. 다음 작업 1순위: E-1 Vercel KV 캐시 |
| 2026-06-12 | 목적별 레이더 모드 구현 | src/types/liveRadar.ts, src/config/liveModes.ts, src/lib/, src/components/, src/App.tsx | 사용자 요청: 라이브 목적별 지표/액션 카드/리포트가 바뀌는 AI 조연출 대시보드 |
