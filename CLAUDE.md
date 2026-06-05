# LiveChat Radar — 프로젝트 가이드

## 하네스: LiveChat Radar 풀스택 기능 빌드

**목표:** 유튜브 라이브 채팅 AI 조연출 대시보드에 새 분석/카드/엔드포인트를 풀스택으로 일관되게 추가한다.

**트리거:** LiveChat Radar에 새 분석 카드/카테고리/대시보드 항목/AI 분석 필드/엔드포인트 추가, 기존 분석 결과 보강, 신규 메트릭, 신규 모달, AI 응답 형식 변경 요청 시 `livechat-feature-build` 스킬을 사용하라. 단순 텍스트 수정, 색상 한두 곳 변경, 라벨 변경 등은 직접 처리.

**기술 스택 메모 (참고용, 자세한 패턴은 스킬에서):**
- AI: OpenAI `chat.completions` + Structured Outputs (`json_schema` strict 모드), 모델 `gpt-4o-mini` 우선 / `gpt-4o` 폴백
- Frontend: React 19 + Tailwind CSS 4 + Lucide-React + Motion, High Density 다크 테마(`#020617`)
- Backend: Express + `tsx` (TypeScript Native Type Stripping), 모노리식 `server.ts`
- 외부 API: YouTube Data API v3

**환경변수:** `OPENAI_API_KEY`, `YOUTUBE_API_KEY`. 미설정 시 자동으로 로컬 시뮬레이터로 폴백.

**변경 이력:**

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-05 | Gemini → OpenAI 전환 | server.ts, package.json, .env.example, README.md, metadata.json | 사용자 요청 ("OpenAI API key 사용") |
| 2026-06-05 | 초기 하네스 구성 (5인 팀 + 6개 스킬) | 전체 (.claude/agents/, .claude/skills/) | 풀스택 기능 추가를 일관된 워크플로우로 빌드 |
| 2026-06-05 | 고도화 로드맵 작성 (14개 항목 4축) | docs/roadmap.md | 다음 작업 우선순위 가시화 |
| 2026-06-05 | A-1 + A-2 캐싱 구현 (Prompt Caching + 응답 LRU 캐시) | server.ts | OpenAI 호출 비용/지연 감축. 헬퍼 시그니처 systemPrompt/userPrompt 분리 |
| 2026-06-05 | A-3 Evaluation Suite 구축 | src/prompts.ts (신규), evals/ (신규), server.ts (정리), package.json | 프롬프트/스키마 회귀 자동 채점. dry-run/live 분리, 6 fixture, universal+specific assertions |
| 2026-06-05 | B-4 Timeline Dashboard 구현 | src/types.ts, src/components/TimelineDashboard.tsx (신규), src/App.tsx, package.json (+recharts) | CPM/정서/카테고리 시간축 추이 시각화. 단일 카드 + 3 미니 차트, 캐핑 슬라이딩 윈도우, 빈 상태 처리 |
