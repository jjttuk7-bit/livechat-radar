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
| 2026-06-06 | E-0 Vercel Serverless 배포 | api/index.ts (신규), vercel.json (신규), server.ts | catch-all rewrites + ESM `.js` 확장자 + `process.env.VERCEL` 가드 + `export default app`. 라이브: https://livechat-radar.vercel.app |
| 2026-06-06 | 폴링/자동분석 stale closure 버그 fix | src/App.tsx | `isPollingRef`, `pollingRateRef`, `messagesCountRef`, `isAnalyzingRef`, `runAIAnalysisRef` 도입. 댓글 폴링 무한 지속 + 자동 분석 40s cadence 복원 |
| 2026-06-06 | Recharts 레이아웃 fix (Grid → Flex) | src/App.tsx, src/components/TimelineDashboard.tsx | `width(-1)` collapse 이슈 해소. main `grid grid-cols-12` → `flex flex-col lg:flex-row`, 모든 section `min-w-0`, ResponsiveContainer `minWidth={0}` |
| 2026-06-06 | 고도화 로드맵 v2 (E 트랙 신설) | docs/roadmap.md | 운영 안정성 5개 항목(E-0~E-4) 추가. 다음 작업 1순위: E-1 Vercel KV 캐시 |
| 2026-06-27 | 🚩 라이브 쇼핑 전용 전환 기획 | docs/plans/liveshopping-pivot.md (신규), docs/roadmap.md | 멀티모드 → 유튜브 라이브 쇼핑 전용. 6축 30+ 태그·상품×옵션 단위·미응답 질문 큐. 로드맵 F 트랙(S-1~S-8) 신설. 결정: 멀티상품+옵션 / 멀티모드 완전 제거 |
| 2026-06-27 | F/S-1~S-3 구현 (타입·스키마·시뮬레이터·백엔드) | src/types/liveShopping.ts, src/prompts.ts, src/lib/simulateShopAnalysis.ts(+test), server.ts | 6축 37태그 strict 계약, 키 없이 동작하는 시뮬레이터, `POST /api/analyze/shop`(상품 컨텍스트 입력+폴백). 비파괴 추가 |
| 2026-06-27 | F/S-4~S-6 구현 (멀티모드 제거 + 쇼핑 대시보드) | src/App.tsx, src/components/shop/* (신규 9), 멀티모드 11파일 삭제, package.json | App.tsx 라이브 쇼핑 단일화, /api/analyze/shop 연동, 상품 바/모달·KPI·액션카드·미응답 큐·6축·상품랭킹·FAQ. lint+test+vite build 통과 |
| 2026-06-27 | F/S-7 구현 (쇼핑 타임라인 + 판매 성과 리포트) | src/components/shop/ShopTimelineDashboard.tsx (신규), src/prompts.ts, src/lib/simulateShopAnalysis.ts, server.ts, src/App.tsx, TimelineDashboard.tsx 삭제 | ShopTimelinePoint 타임라인(구매온도/CPM/가격저항·미응답) + `POST /api/report/shop` 7섹션 판매 성과 리포트. 구 타임라인 제거 |
| 2026-06-27 | F/S-8 (evals 쇼핑 교체 + 레거시 제거 + QA) | evals/* (runner·assertions·6 fixture·README), src/prompts.ts·server.ts·src/types.ts 레거시 제거 | evals 쇼핑 스키마(dry-run 6/6, 시뮬레이터 채점), 레거시 /api/analyze·/api/report·AnalysisResult·analyze/reportJsonSchema·STATIC_ANALYZE/REPORT 제거. 경계면 QA 전부 통과(qa_report_s8). **F 트랙 완료** |
| 2026-06-27 | PORT 환경변수화 + 고도화 기획(G 트랙) | server.ts(PORT=env), docs/plans/liveshopping-advanced.md (신규), docs/roadmap.md | `PORT` env로 포트 변경 가능. G 트랙 신설: 시청자 인텔리전스(핫리드)·실시간 전환 엔진·종료 후 심화 분석·진행 보조·데이터 신뢰. 1순위 G-1-1 핫리드 보드 |
| 2026-06-27 | G-1-1 핫리드 보드 구현 | src/types/liveShopping.ts(ViewerProfile), src/lib/buildViewerProfiles.ts(+test), src/components/shop/HotLeadBoard.tsx (신규), src/App.tsx, package.json | author 단위 시청자 집계(leadScore·퍼널단계·망설임·미응답·단골/멤버/트롤 플래그). 신규 호출 0, useMemo 파생. lint+test+build 통과 |
| 2026-06-27 | G-2-1 전환 퍼널 + G-2-2 판매 모멘텀 | src/types/liveShopping.ts(ConversionFunnel, ShopTimelinePoint.purchased), src/lib/conversion.ts(+test), src/components/shop/ConversionPanel.tsx (신규), src/App.tsx | 시청자 퍼널(관심→고려→임박→구매)+추정 전환율+판매 모멘텀(타임라인 purchased 델타 스파크라인). 파생 계산, 신규 호출 0 |
| 2026-06-27 | G-2-3 클로징 윈도우 카운트다운 | src/types/liveShopping.ts(ClosingWindow), src/lib/conversion.ts(detectClosingWindow+test), src/components/shop/ClosingWindowCard.tsx (신규), src/App.tsx | 구매온도/타이밍/마감/재고 감지 → 우측 패널 상단 30초 카운트다운 + 클로징 멘트. open 전환·새 분석마다 타이머 리셋 |
| 2026-06-27 | G-1-2/3/4 시청자 세그먼트·망설임·트롤 | src/lib/buildViewerProfiles.ts(summarizeViewers+test), src/components/shop/ViewerInsights.tsx (신규), src/App.tsx | 배타적 세그먼트(구매자/핫리드/단골/관망/트롤) 스택바 + 망설임 사유 집계 + 트롤 워치. G-1 완료 |
| 2026-06-27 | G-2-4 멘트 효과 + G-2-5 가격 탄력 | src/types/liveShopping.ts(MentionMark), src/lib/conversion.ts(detectPriceElasticityWarning·computeMentionLift+test), src/components/shop/MentionLiftCard.tsx (신규), ConversionPanel.tsx(priceWarning), src/App.tsx | 혜택 멘트 마킹→직후 구매/온도 리프트 측정 + 가격 저항 과다 시 경고 배너. G-2 완료 |
| 2026-06-27 | G-3 종료 후 심화 분석 | src/types/liveShopping.ts(GoldenMoment·TimeBucket·PostLiveInsights), src/lib/postLive.ts(+test), src/components/shop/PostLiveAnalysis.tsx (신규), src/App.tsx(리포트 모달 상단) | 세션 데이터 파생: 골든모먼트(멘트 매칭)·시간대 히트맵·상품 손익·이탈 감지·세그먼트 결산+다음방송 체크리스트. 리포트 모달에 AI 마크다운과 함께 표시. G-3-6 방송비교는 보류 |
| 2026-06-27 | G-4-3 스크립트 어시스트 | src/types/liveShopping.ts(LiveProduct.sellingPoints·presetFaqs, PresetFaq), src/lib/scriptAssist.ts(matchPresetAnswers+test), src/components/shop/ScriptAssist.tsx (신규), ProductRegisterModal.tsx(셀링포인트·예상Q&A 입력), src/App.tsx | 상품 사전 등록 셀링포인트(읽기용) + 예상 Q&A를 미응답 질문과 키워드 매칭해 준비된 답변 제시. 신규 호출 0 |
| 2026-06-27 | G-4-4 멀티상품 타임블록 | src/types/liveShopping.ts(ProductBlock), src/lib/productBlocks.ts(summarizeBlock+test), src/components/shop/ProductTimeBlocks.tsx (신규), src/App.tsx(활성 상품 변경 effect, ref 가드) | 활성 상품 전환 자동 기록 → 구간별 소개 시간·댓글·구매 집계. StrictMode 중복 방지 ref 가드 |
