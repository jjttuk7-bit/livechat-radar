# LiveChat Radar — 고도화 로드맵

> 작성일: 2026-06-05 · 최종 업데이트: 2026-06-06
> 최근 완료: **E-0 Vercel Serverless 배포** ✅ (2026-06-06)
> 진행 이력: A-1/A-2 캐싱 → A-3 평가 → B-4 시간축 → E-0 Vercel 배포 → (다음: **E-1 외부 KV 캐시**)
> 라이브 URL: https://livechat-radar.vercel.app

---

## A. AI 품질 & 비용 (Quick Win)

| # | 항목 | 효과 | 난이도 | 상태 |
|---|------|------|------|------|
| 1 | **OpenAI Prompt Caching 적용** — 시스템/스키마 프롬프트를 캐시 마커로 분리. 동일 방송 세션 내 분석 호출이 빈번하므로 토큰 비용 50%+ 절감 가능 | 🔥🔥🔥 | 낮음 | ✅ 완료 (2026-06-05) |
| 2 | **분석 응답 캐싱 (서버 메모리/Redis)** — 같은 댓글 묶음에 대한 중복 분석 방지. CPM이 낮을 때 polling이 빈번해 같은 30개 메시지를 반복 분석하는 낭비 발생 중 | 🔥🔥 | 낮음 | ⚠️ 부분 완료 (2026-06-05) — 인메모리 LRU 구현했으나 Vercel Serverless cold start마다 휘발 → **E-1로 보강 필요** |
| 3 | **프롬프트 회귀 테스트 (Evaluation Suite)** — 고정된 댓글 스냅샷 6세트 + 기대 결과로 `gpt-4o-mini` vs `gpt-4o` 응답 품질 정량 비교. 모델 교체 시 안전망 | 🔥🔥🔥 | 중간 | ✅ 완료 (2026-06-05) — 6 fixture, dry-run/live 분리 |

## B. UX 깊이 (사용자 체감)

| # | 항목 | 효과 | 난이도 | 상태 |
|---|------|------|------|------|
| 4 | **시간축 분석 차트** — CPM·감정 비율·카테고리 발생을 시간 누적해 라인/스택드 차트로 표시. 현재는 "지금 상태"만 보임 → "방송 흐름"이 보이게 됨 | 🔥🔥🔥 | 중간 | ✅ 완료 (2026-06-05) — Recharts, 3 미니 차트 단일 카드. ※ 2026-06-06 grid → flex 레이아웃 fix |
| 5 | **WebSocket/SSE 푸시로 polling 대체** — 현재 3.5초 polling. 백엔드가 YouTube에서 받은 메시지를 SSE로 즉시 푸시. 진행자 반응 속도 향상 | 🔥🔥 | **중-상** | 대기 — ⚠️ Vercel Serverless는 long-lived 연결 불가. Edge Function + SSE 또는 외부 WS 서비스(Ably/Pusher) 필요 |
| 6 | **OBS 브라우저 소스 오버레이 라우트** — `/overlay?token=...` 경로로 투명 배경 미니 가이드 패널. 진행자가 OBS 화면에 직접 띄움 → 두 모니터 안 봐도 됨 | 🔥🔥🔥 | 중간 | 대기 |
| 7 | **방송 기록 영구 저장** — 종료 리포트를 DB로 저장 → 과거 방송 비교, 트렌드 추적 가능 | 🔥🔥 | 중간 | 대기 — ⚠️ Vercel KV / Supabase Postgres 필요 (파일 시스템 휘발) |

## C. 기술 부채 (Maintainability)

| # | 항목 | 효과 | 난이도 | 상태 |
|---|------|------|------|------|
| 8 | **server.ts 모듈 분리** — 36KB 단일 파일을 `routes/youtube.ts`, `routes/analyze.ts`, `routes/report.ts`, `ai/openai-client.ts`, `simulators/`, `prompts/`로 분해. 하네스가 모듈별 핀포인트 수정 가능해짐 | 🔥🔥 | 중간 | 대기 |
| 9 | **App.tsx 컴포넌트 분리** — 56KB → `<ChatFeed/>`, `<AnalysisPanel/>`, `<PresenterActionsList/>`, `<ReportModal/>` 등 분리. 현재 `src/components/`엔 2개뿐(MetricCard, TimelineDashboard) | 🔥🔥 | 중간 | 대기 |
| 10 | **한국어 NLP 라이브러리 도입** — 시뮬레이터의 stopwords와 어미 trim이 수동 휴리스틱. `hangul-js`, `mecab-ko-wasm` 등으로 키워드 추출 정확도 향상 | 🔥 | 중간 | 대기 |
| 11 | **타입 단일 출처 강화** — `ChatMessage.category` 같은 enum literal을 server.ts json_schema의 enum과 한 곳에서 생성하도록 (`as const` + 도출) | 🔥🔥 | 낮음 | 대기 |

## D. 하네스 진화 (Self-Improving)

| # | 항목 | 효과 | 난이도 | 상태 |
|---|------|------|------|------|
| 12 | **`prompt-engineer` 에이전트 추가** — 현재 ai-schema-engineer가 스키마+프롬프트 겸직. 분리하면 프롬프트 톤·예시·few-shot을 전담 검증. 항목 #3 evaluation suite와 짝 | 🔥🔥 | 낮음 | 대기 |
| 13 | **`security-reviewer` 에이전트 추가** — API 키 노출, CORS, 입력 검증을 별도 패스로 점검. 현재 server.ts에 키 검증은 있지만 응답에 sanitize 누락 가능 | 🔥 | 낮음 | 대기 |
| 14 | **운영용 별도 하네스 (`livechat-ops-monitor`)** — 비용/지연/에러율을 분석하고 모델·polling rate를 권고하는 별도 팀. 빌드용 하네스와 분리 | 🔥 | 중간 | 대기 — E-2 Sentry 도입 이후 데이터 소스로 활용 |

## E. 운영 안정성 (Production Readiness) — 신설 2026-06-06

> Vercel Serverless 배포 후 발견된 운영 이슈/한계 대응. 트래픽 증가 전 선제 해결 필요.

| # | 항목 | 효과 | 난이도 | 상태 |
|---|------|------|------|------|
| 0 | **Vercel Serverless 배포** — `api/index.ts` catch-all + 명시 rewrites + ESM `.js` 확장자 정합화 + Express app export | 🔥🔥🔥 | 중 | ✅ 완료 (2026-06-06) |
| 1 | **외부 KV 캐시 (Vercel KV / Upstash Redis)** — 현재 인메모리 LRU 캐시가 Lambda cold start마다 휘발 → A-2 캐시 효과 사실상 무효. 트래픽↑ 시 OpenAI 호출 폭증 위험. KV로 이전 시 cross-instance 공유 가능 | 🔥🔥🔥 | 낮 | 대기 — **다음 작업 1순위** |
| 2 | **에러 추적 (Sentry/Logtail/Axiom)** — Vercel Logs는 retention 짧고 검색 단편적. 무증상 4xx/5xx와 클라이언트 런타임 에러 통합 추적 | 🔥🔥 | 낮 | 대기 |
| 3 | **함수 cold start 워밍** — 첫 `/api/analyze` 호출 지연 2~5s 가능. Vercel Cron 1분 ping 또는 Edge Runtime 검토(단 Edge는 npm 패키지 제약) | 🔥 | 중 | 대기 |
| 4 | **클라이언트 silent failure 가시화** — 현재 `setErrorMsg` 한 군데(상단 toast)만. 폴링 stale closure(2026-06-06 fix) 같은 무증상 버그가 또 생기면 또 무증상. dev/staging 환경 자동 verbose logging 토글 + 에러 boundary 추가 | 🔥🔥 | 낮 | 대기 |

---

## 추천 조합 (3가지 시나리오)

- 🛡️ **"운영 안정화 먼저"**: E-1 + E-2 + E-4 — Vercel 배포 직후 가장 ROI 좋음. 1~2일  ← **현재 권장**
- 📊 **"사용자 가치 다음 분기"**: B-6 OBS 오버레이 + B-5 SSE 전환 — 진행자가 실제로 더 빨라짐
- 🛠️ **"코드 건강성"**: C-8 + C-9 (모노리식 분리) — 이후 모든 기능 추가 속도 가속

---

## 다음 작업 우선순위 (2주 시야)

```
1주차 (운영 안정성 마무리)
├─ E-1. Vercel KV 도입         ← 최우선. OpenAI 비용 즉시 절감 (A-2 effective 복원)
├─ E-4. 에러 toast 보강         ← 디버깅 비용 절감 (2026-06-06 디버깅 어려웠던 교훈)
└─ E-2. Sentry 통합             ← 무증상 버그 사전 감지

2주차 (UX 가속 + 부채 청산)
├─ C-9. App.tsx 컴포넌트 분리   ← 1191 라인 단일 파일 → 4~5개 컴포넌트
└─ B-6. OBS 오버레이 라우트     ← 사용자 체감 최대. 실제 진행자 워크플로우 침투
```

---

## Vercel 환경 제약 (로드맵 검토 시 반드시 참고)

| 기존 항목 | Vercel Serverless 제약 | 권장 대안 |
|----------|----------------------|----------|
| A-2 응답 캐시 | 인메모리 LRU → cold start 휘발 | E-1 (KV) |
| B-5 WebSocket | Serverless 함수는 long-lived 연결 불가 | Edge Function + SSE (단방향이면 충분) / 외부 WS (Ably, Pusher) |
| B-7 방송 기록 저장 | 파일 시스템 휘발, 함수 stateless | Vercel KV (소량) / Supabase Postgres (장기) |
| 폴링 nextPageToken 상태 | 현재 클라이언트 측 보관 → OK. 서버 측 stateful map(`demoSessions`) 사용 시 instance 간 불일치 위험 | demo 모드만이라 현재는 무해. 실 라이브에 server-side state 도입 시 KV 필요 |
| Cron / 주기 작업 | 함수는 trigger 기반 | Vercel Cron Jobs (분당 1회 무료, hobby plan은 일 1회) |

---

## 진행 이력

| 날짜 | 작업 | 비고 |
|------|------|------|
| 2026-06-05 | 로드맵 작성, A-1/A-2 착수 | `livechat-feature-build` 하네스 적용 |
| 2026-06-05 | A-1 + A-2 완료 | `_workspace/qa_report.md` 8/8 통과, lint 통과. system 프롬프트 정적 상수화 → 향후 A-3 evaluation suite 베이스 |
| 2026-06-05 | A-3 완료 | `src/prompts.ts` 단일 출처 추출, `evals/` 6 fixture + runner + assertions, `_workspace/qa_report_eval.md` 8/8 통과. dry-run/live 분리 |
| 2026-06-05 | B-4 완료 | Recharts 도입, `<TimelineDashboard/>` 단일 카드 + 3 미니 차트, App.tsx state/effect 통합, `_workspace/qa_report_b4.md` 9/9 통과 + Vite production build 성공 |
| 2026-06-06 | **E-0 Vercel Serverless 배포** | `api/index.ts` catch-all + `vercel.json` (buildCommand vite build, function maxDuration 30s) + `server.ts` `export default app` + `process.env.VERCEL` 가드 + ESM `.js` 확장자 정합화 |
| 2026-06-06 | 폴링 stale closure 버그 fix | `startCommentStream`의 `pullBatch` 클로저가 캡처한 `isPolling` stale false → 첫 batch 후 폴링 중단. `isPollingRef` / `pollingRateRef` 도입으로 해결 |
| 2026-06-06 | 자동 AI 분석 interval reset 버그 fix | useEffect deps에 `messages.length` 포함되어 댓글 도착마다 40s setInterval 재설정 → 영구 미발동. deps 축소 + ref 미러 패턴으로 해결. 첫 분석은 1.5s 버퍼 후 발동 |
| 2026-06-06 | Recharts 레이아웃 fix | `width(-1) height(-1)` 경고로 분석 패널 collapse. ChartFrame height 고정 → min-w-0 cascade → 최종적으로 main `grid grid-cols-12` → `flex flex-col lg:flex-row`로 전환하여 grid implicit min-content 순환 의존성 해소 |

---

## 오늘 세션(2026-06-06) 배운 교훈 (다음 작업 시 참조)

1. **Vercel Serverless + Express 통합**: `api/[...path].ts` 보다 `api/index.ts` + 명시적 `rewrites`가 더 안정적. `req.url` 정규화(x-vercel-original-url 헤더 활용)로 Express 라우트 매칭 보장.
2. **ESM 모듈 해석**: `package.json: "type": "module"` 환경에서 Vercel은 TS→JS 트랜스파일 후 Node ESM resolver를 쓰므로 import는 `.js` 확장자 명시 필수 (`./server` X → `./server.js` O). `tsconfig.moduleResolution: bundler`는 빌드 시점만 영향.
3. **stale closure 진단법**: setInterval/setTimeout 콜백 내부에서 state 값이 "예전 값"으로 보이면 거의 100% stale closure. 해결책 정형 패턴 = `xxxRef = useRef(...)` + state 변경마다 동기화 useEffect.
4. **Recharts ResponsiveContainer**: CSS Grid item의 implicit `min-width: auto`와 충돌. **모든 grid item에 `min-w-0`** 또는 main 컨테이너를 flex로 전환. 콘솔이 열고 닫음에 따라 보였다 안 보였다 하면 **viewport reflow가 width 측정을 일시적으로 정상화**시키는 증거.
5. **환경변수 명명**: Vite의 `VITE_*` 접두사는 **클라이언트 노출 변수 전용**. 백엔드 키는 `OPENAI_API_KEY`, `YOUTUBE_API_KEY` 처럼 접두사 없이. API 키는 절대 `VITE_` 접두사로 등록 금지(빌드 결과물에 평문 노출).
