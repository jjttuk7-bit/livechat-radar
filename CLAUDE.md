# LiveChat Radar — 프로젝트 가이드

## 하네스: LiveChat Radar 풀스택 기능 빌드

**목표:** 유튜브 **정치·시사** 라이브 채팅 AI 조연출 대시보드에 새 분석/카드/엔드포인트를 풀스택으로 일관되게 추가한다.

**트리거:** 새 분석 카드·아젠다 지표·리스크 항목·대시보드 패널·AI 분석 필드·엔드포인트 추가, 기존 분석 보강, 신규 메트릭·모달, L1 파이프라인 변경, AI 응답 형식 변경 요청 시 `livechat-feature-build` 스킬을 사용하라. 단순 텍스트 수정, 색상 한두 곳 변경, 라벨 변경 등은 직접 처리.

**안전 게이트 (정치 도메인 필수):** 시청자 개인·주장 진위·선거·멘트 생성·리스크 사전에 닿는 작업은 `safety-reviewer`를 반드시 소집한다. 제약 원문은 `docs/plans/politics-pivot.md` 2절(D-1~D-8). 요약: 개인 정치성향 라벨 금지 / 여론은 집계 단위로만 / AI의 진위·위법 판정 금지 / 처방 멘트는 진행 품질에 한정.

**기획 단일 출처:** `docs/plans/politics-pivot.md` (6축 37태그·KPI 9종·액션 카드·P 트랙 로드맵). 태그·지표를 임의로 발명하지 말고 이 문서를 따른다.

**기술 스택 메모 (참고용, 자세한 패턴은 스킬에서):**
- AI: OpenAI `chat.completions` + Structured Outputs (`json_schema` strict), `gpt-4o-mini` 우선 / `gpt-4o` 폴백
- **프롬프트·스키마 위치: `src/prompts.ts`** (server.ts 아님 — `evals/runner.ts`와 공유하는 단일 출처)
- **타입 계약: `src/types/liveTalk.ts`** (P-1 이전 현행: `src/types/liveShopping.ts`)
- Frontend: React 19 + Tailwind CSS 4 + Lucide-React + Motion + Recharts. **디자인 시스템은 Linear("midnight precision instrument") — 토큰 단일 출처는 `src/index.css`의 `@theme`, 근거·이탈 기록은 리포 루트 `DESIGN.md`.** 캔버스 `#08090a`, 그림자 금지(hairline 보더), 굵기 700+ 금지
- Backend: Express + `tsx`, 모노리식 `server.ts`
- 외부 API: YouTube Data API v3

**고CPM 전제:** 정치·시사는 CPM 200~600이다. AI 입력은 댓글 원문 전량이 아니라 **L1 집계 통계 + 층화 표본**이며 호출당 입력을 상수로 고정한다. `slice(-N)` 말단 윈도우, `slice(0,N)` 앞자르기, ID 전량 해시 캐시 키, `messages` 전량 렌더는 금지 패턴이다.

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
| 2026-08-12 | 🚩 정치·시사 전용 전환 기획 (P 트랙) | docs/plans/politics-pivot.md (신규) | 라이브 쇼핑은 동접 100명 미만이라 통계적으로 분석 불가 → 정치·시사(CPM 200~600·매일 방송·고충성층)로 피벗. 6축 37태그 재정의, 킬러 기능을 미응답 큐 → **리스크 레이더**로 교체, L1/L2/L3 고CPM 파이프라인 신설, 안전 제약 D-1~D-8 수립. 확정: `Talk*` 네이밍 / Supabase / 쇼핑 코드 삭제+태그 보존 |
| 2026-08-12 | P-0 수집 방식 조사 | docs/plans/politics-pivot.md 4-4·R-1, scripts/diag-youtube.ts (신규) | `liveChatMessages.list` 유닛 비용이 공식 쿼터 표에 **없음**(2차 자료는 1 vs 5 모순) → 실측 필요로 재정의. `streamList`(서버 스트리밍·pageToken 재개·activePollItem) 발견 → 폴링 대체 후보. Vercel Serverless와 long-lived 연결 충돌(R-1b) 확인 |
| 2026-08-12 | 하네스 정치 전환 + 드리프트 수리 | .claude/agents/* (5 수정 + 2 신규), .claude/skills/* (5 수정 + 2 신규, 빈 디렉터리 1 삭제), CLAUDE.md | 하네스가 6/5 구조에 정체: `src/types.ts`(13곳)·"server.ts 내 스키마"·`generateSimulatedAIAnalysis`(14곳)를 가리키고 `src/lib`·`components/shop`·`evals` 인지 0. 경로 전면 수리 + 정치 도메인 재타깃. 신규: `pipeline-engineer`(L1 고CPM), `safety-reviewer`(D-1~D-8 게이트) |
| 2026-08-12 | P-1 타입 계약 (정치·시사) | src/types/liveTalk.ts (신규), src/lib/talkTaxonomy.test.ts (신규), package.json | 6축 37태그(agenda 7·stance 5·emotion 6·inquiry 6·loyalty 6·risk 7) + `Talk*` strict 계약 + `RiskAlert` 신설. `SupporterProfile`은 비민감 축만(D-1/D-2). enum 삼중 일치(유니온·TALK_TAGS·TAG_AXIS)와 D-1 성향 라벨 금지를 회귀 테스트로 고정. 쇼핑 코드 비파괴 |
| 2026-08-12 | P-2 L1 고CPM 파이프라인 | src/lib/dedupe.ts·dictionaries.ts·prefilter.ts·sample.ts (신규) + dedupe/prefilter 테스트, package.json | 전량 처리(AI 호출 0) → 집계 통계 + 층화 표본으로 AI 입력을 CPM 무관 상수로 고정. 리스크·요구 후보는 표본이 아닌 **전수**. 실측: 5만 건 dedupe 418ms(압축률 22.1%) · prefilter 1.3s · 표본 80건이 11,273건 대표. 사전은 인물·정당명 하드코딩 금지(큐시트 주입) + 형식 기준 + 멸칭은 대칭 쌍만(D-7) |
| 2026-08-12 | 도배 오탐 임계 수정 | src/lib/dedupe.ts | 초기 임계(count≥5·rate≥0.5/s)가 "맞습니다" 같은 짧은 상용 호응 300건을 조직적 도배로 오탐. 실사용 시 거짓 경보 다발 → count≥8·rate≥2.0/s·정규화 길이≥8자로 상향. 개인 반복(single_author_flood)은 길이·속도 무관 유지 |
| 2026-08-12 | P-1(b) TALK 프롬프트·스키마 | src/prompts.ts, src/types/liveTalk.ts(RISK_TAGS 등 enum 배열) | `STATIC_TALK_ANALYZE/REPORT_SYSTEM_PROMPT` + `talkAnalyze/ReportJsonSchema` strict. 시스템 프롬프트에 안전 지침 4종(D-1 성향 라벨 금지·D-4 진위 판정 금지·D-5 위법 판정 금지·D-6 공격 문구 금지) 명시. enum은 liveTalk.ts 배열 재사용. 쇼핑 프롬프트 비파괴 |
| 2026-08-12 | P-3 시뮬레이터 | src/lib/simulateTalkAnalysis.ts(+test) | 키 없는 환경 전체 경로. L1(runPrefilter)을 재사용해 시뮬레이터/실파이프라인 drift 차단. 계약 완전성(전 필드)·enum 준수·심각도 정렬·D-1/D-4/D-5 단정 표현 금지를 테스트로 고정. 8천 건 286ms |
| 2026-08-12 | P-4 정치 엔드포인트 | server.ts | `POST /api/analyze/talk` · `/api/report/talk`. AI 입력 = L1 집계 + 층화 표본(원문 전량 아님) → 호출당 입력 상수 고정. 캐시 키 = (제목·큐시트·10초 버킷·L1 시그니처)로 ID 전량 해시 폐기. 리포트도 `slice(0,150)` 대신 전 구간 표본. 응답에 `l1` 요약 동봉 |
| 2026-08-12 | 리스크·미응답 중복 표시 fix | src/lib/simulateTalkAnalysis.ts | 스모크 테스트에서 동일 문구가 리스크 패널·미응답 큐에 20줄씩 반복되는 것 발견(진행자가 못 쓰는 화면). `foldByText`로 대표 1건+확산 수로 접음. 미응답 KPI도 총 발생 건수 → **서로 다른 요구 수**로 정정(200건 → 2건) |
| 2026-08-12 | P-5 UI 코어 + P-6 리스크 워치 | src/components/talk/* (신규 9), src/App.tsx (정치 재작성), src/components/shop/* (17 삭제) | 큐시트 바·등록 모달 / KPI 스트립 / 액션 카드 / 아젠다 레이더 / 여론 분포(집계 전용, 개인 역추적 없음) / **리스크 워치 패널 + 임계 초과 시 상단 배너**(P-6 킬러) / 미응답 큐. 면책 문구 상시 노출(D-5), 자동 삭제·차단 버튼 없음. 라벨 단정 금지(검증 필요/명예훼손 소지). 쇼핑 UI 제거 |
| 2026-08-12 | 고CPM 프론트 방어 | src/App.tsx | 저장은 전량 유지(리포트 대표성)·**렌더만 최근 200건**으로 제한(전량 렌더 시 브라우저 정지). 분석 윈도우를 고정 건수 → **3분 시간 윈도우**(CPM 무관하게 40초 주기를 덮음). 리포트 상한 초과 시 앞자르기 대신 전 구간 균등 추출 |
| 2026-08-12 | DEMO 채팅 정치·시사 교체 | server.ts | 데모가 쇼핑 대사("구매 주소·배송·재고")를 그대로 노출하던 문제. 6축을 모두 덮는 정치·시사 채팅 29건으로 교체. 작성 원칙: 실존 인물·정당 미지칭, 동의/반대 대칭, 리스크는 형식(단정·미확인 전언)만 (D-6/D-7). 데모 제목·채널명도 시사로 |
| 2026-08-12 | 브라우저 실동작 검증 | — | dev 서버 기동 후 데모 + 큐시트("예산안 처리") 등록 → 실제 OpenAI 분석까지 확인. L1 수집 49/고유 27(중복 44.9%), 리스크 배너 4건(높음 1), 아젠다 급상승 75, 미응답 14, Prompt Caching 적중(cached=2048/prompt=2478) |
| 2026-08-12 | P-8 시청자·참여 (비민감 축) | src/lib/supporters.ts·engagement.ts(+test), src/components/talk/SupporterBoard.tsx·ParticipationPanel.tsx (신규), src/App.tsx | 쇼핑 핫리드(구매 가능성)를 그대로 옮기지 않고 **참여·충성 점수**로 재정의(D-1/D-2). 성향·진영·정당 필드 없음, flag는 행위 기준. 참여 퍼널(채팅→반복→능동→후원) + 어필 윈도우(리스크 있으면 닫힘). 테스트로 D-1 대칭 회귀 고정: 동의/반대가 같은 참여량이면 같은 분류여야 함 |
| 2026-08-12 | P-9 시간축 추이 | src/components/talk/TalkTimelineDashboard.tsx (신규), src/App.tsx | 결집 온도 / 논쟁·리스크 / 활성도·미응답 3개 차트. Recharts `min-w-0` + `minWidth={0}` 적용. 브라우저 검증: SVG 3개 280×96, 시리즈 6개, 폭 붕괴 0, 가로 오버플로 없음 |
| 2026-08-12 | metric id 의존 제거 (robustness) | src/lib/engagement.ts(deriveStats), src/App.tsx | 브라우저 검증 중 발견: AI가 metrics의 `id`를 매번 다르게 지어냄(9개 `rally_heat` → 4개 `총 댓글 수`). 기계가 읽는 값을 모델 작명에 맡기면 어필 윈도우·타임라인이 조용히 0이 된다. **태그에서 직접 파생**(duplicateCount 가중)하도록 교체하고 metrics는 표시 전용으로. 회귀 테스트 추가 |
| 2026-08-12 | P-12 evals 정치 교체 + **D-7 대칭 회귀** | evals/runner.ts·assertions.ts·README.md, evals/fixtures/* (쇼핑 6 삭제 → 정치 8 신규) | 3층 채점: universal(계약 + **안전 회귀** D-1/D-4/D-5/D-6 금칙어) · specific(선언적 기대치) · **symmetry**. `03_risk_side_a` ↔ `04_risk_side_b`는 문장 동일·대상만 갑↔을 → 리스크 건수·심각도·축 분포·카드 우선순위가 같아야 통과. live 경로도 server.ts와 동일 파이프라인(L1+표본) 사용 |
| 2026-08-12 | L1 규칙 순서 fix | src/lib/dictionaries.ts | eval에서 발견: `factual_question`(catch-all "~나요?")이 아젠다 규칙보다 먼저 평가돼 "지난주에 다루신 그 건은 어떻게 됐나요?"의 **후속 요청 신호를 삼킴**. catch-all을 AGENDA_RULES 뒤로 이동 |
| 2026-08-12 | 도배 액션 카드 누락 fix | src/lib/simulateTalkAnalysis.ts | eval에서 발견: 9개 계정 조직적 도배가 태그 카운트로는 1건이라 `riskIndex>=2` 임계에 걸려 카드가 안 떴다. 심각도 high 또는 도배 신호가 있으면 건수와 무관하게 카드 발행 |
| 2026-08-12 | **axis 스키마 제거 (live eval 발견)** | src/prompts.ts, src/lib/normalizeTalk.ts (신규), server.ts, evals/runner.ts | live eval 8/8 fixture **전부**에서 `axis`≠`TAG_AXIS[tag]` 불일치. axis는 tag에서 100% 파생되는데 모델에게 둘 다 시킨 것이 설계 오류. 스키마에서 axis 제거 + `applyDerivedAxes()`로 서버 주입(런타임·평가 공용). 알 수 없는 태그는 'other'로, duplicateCount 결측은 1로 방어 |
| 2026-08-12 | **temperature 0 + 심각도 루브릭 (D-7 위반 해소)** | server.ts, evals/runner.ts, src/prompts.ts | 첫 live eval에서 대칭 위반 발생: 대상만 갑↔을인데 심각도가 `high3/med0` vs `high2/med1`. 원인 (1) `temperature` 기본값 1로 판정 불안정 (2) 프롬프트에 심각도 기준 부재. `temperature:0` + **형식 기반 severity 루브릭**(대상이 아니라 표현 형식으로만 판정) 추가 → 재실행 시 live 8/8·대칭 위반 0건 |
| 2026-08-12 | P-11 크로스세션 (Supabase + 파일 폴백) | src/types/liveTalk.ts(SessionRecord 등), src/lib/sessionStore.ts·crossSession.ts(+test), src/components/talk/SessionHistoryPanel.tsx, server.ts(`/api/sessions`·`/api/sessions/history`), supabase/schema.sql, .env.example, .gitignore | 매일 방송·고정 시청층이 처음으로 자산이 되는 지점. 회차 비교(델타 6종)·아젠다 수명(방향·연속 회차)·단골 누적(재방문율)·미해소 요구 이월. **SDK 의존 없이 PostgREST를 fetch로** 호출하고, 키 미설정 시 `.data/sessions.json`으로 자동 폴백(OpenAI 키 없을 때 시뮬레이터로 폴백하는 기존 원칙과 동일) |
| 2026-08-12 | D-8 저장 설계 | src/lib/sessionStore.ts, supabase/schema.sql | 닉네임은 **sha256(salt:author) 32자 해시만** 저장. 원문 닉네임·댓글 원문 컬럼이 스키마에 존재하지 않음. `assertNoRawAuthors()`로 저장 직전 차단, 보존기간 90일 초과분은 쓰기 시점 정리. 히스토리 응답에서 해시 배열 자체를 제외(개수만 반환). 해싱은 서버에서만 — 클라이언트가 하면 salt가 브라우저에 노출된다 |
| 2026-08-12 | 테스트가 실제 저장소 오염 fix | src/lib/sessionStore.ts(FileStore dir 주입), crossSession.test.ts | `npm test`가 앱의 `.data/sessions.json`에 테스트 레코드를 써서 실제 회차 기록을 오염시켰다. `FileStore(dir)`로 경로 주입 가능하게 하고 테스트는 os.tmpdir 격리 + 종료 시 정리 |
| 2026-08-13 | 🎨 Linear 디자인 시스템 적용 | DESIGN.md (신규), src/index.css(@theme), index.html, src/App.tsx, src/components/talk/*, MetricCard.tsx, .claude/agents·skills + 미러, CLAUDE.md·README.md·AGENTS.md | styles.refero.design 후보 중 **Linear("midnight precision instrument")** 채택. Factory("terminal war room")는 분위기가 더 맞았지만 "추가 액센트 금지" 규칙이 6축 의미 색상을 파괴해 탈락. Tailwind 4 `@theme`로 표준 색 이름의 값만 재정의 → 컴포넌트 무수정으로 전체 전환. 캔버스 #020617→#08090a, 6축을 Linear 팔레트에 매핑, 주 액션 Acid Lime 단일화(연결↔분석 상태 전환), 굵기 700+ 제거(font-bold 36곳→semibold), 그라디언트·글로우 폐기, Recharts 색도 토큰화. 옛 팔레트를 가르치던 에이전트·스킬·문서 6곳 동기화 |
| 2026-08-13 | CSS 주석이 `@theme`를 삼킨 버그 | src/index.css | 주석에 쓴 `slate-*/cyan-*`의 `*/`가 주석을 조기 종료시켜 **뒤따르는 `@theme` 블록 전체가 조용히 사라짐**. 빌드는 성공하고 색만 기본값으로 남아 발견이 어려웠다(주석 짝 31 vs 32로 특정). DESIGN.md에 재발 방지 메모 + `grep -c "0f1011" dist/assets/*.css` 검증법 기록 |
| 2026-08-12 | 브라우저 검증 (P-11) | — | 2회차 저장 후 UI 확인: 델타(총댓글 +500·CPM +50·온도 +14%·후원 +5·응답률 +13%·리스크 −2), 재방문 2명(67%), 아젠다 "예산안 처리" 55→82 상승·2회 연속, 단골 누적 재방문율 50%, 이월 1건. D-8 확인: 응답에 해시 배열 미포함·원문 닉네임 노출 0 |
