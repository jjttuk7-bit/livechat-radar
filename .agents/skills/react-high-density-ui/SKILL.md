---
name: react-high-density-ui
description: LiveChat Radar의 React 19 + Tailwind 4 + Lucide-React + Motion 기반 High Density 다크 대시보드에 UI 요소(카드/패널/모달/리스트/메트릭/차트)를 추가·수정한다. Linear 디자인 시스템("midnight precision instrument") 토큰을 따른다 — Void #08090a 캔버스, hairline 보더, 6축 의미 색상, 주 액션 Acid Lime, 700+ 굵기 금지. 새 패널·시각화·모달·색상 변경 시 반드시 이 스킬 사용. 토큰 원문은 리포 루트 DESIGN.md.
---

# react-high-density-ui — High Density 다크 대시보드 UI

LiveChat Radar의 디자인 철학("정보 점유율 100%, 시각 방해 최소화")을 코드 레벨에서 실천하기 위한 스킬.

## 디자인 토큰 (필수 준수)

**단일 출처는 `src/index.css`의 `@theme` 블록이고, 근거와 이탈 기록은 리포 루트 `DESIGN.md`다.**
Tailwind 표준 색 이름의 *값만* 재정의해 두었으므로, 컴포넌트에서는 평소처럼 `bg-slate-900`,
`text-cyan-400`을 쓰면 Linear 팔레트가 적용된다. 새 팔레트 이름을 만들지 마라.

### 뉴트럴 (Linear)
```
캔버스:          bg-[#08090a]  또는 bg-slate-950   (Void)
카드 표면:       bg-slate-900/60                  (Carbon #0f1011)
상승 표면:       bg-slate-850                     (Obsidian #161718)
보더 (기본):     border border-slate-800          (Graphite #23252a)
보더 (고대비):   border-slate-700                 (Smoke #383b3f)
텍스트 (본문):   text-slate-200                   (Bone #e5e5e6)
텍스트 (2차):    text-slate-300                   (Mist #d0d6e0)
텍스트 (보조):   text-slate-400
텍스트 (약화):   text-slate-500 / text-slate-600
```

**깊이는 보더로만 만든다.** 그림자·글로우·블러를 쓰지 않는다 (Linear 규칙).
기존 `blur-2xl` 글로우 데코 패턴은 폐기됐다.

### 6축 의미 색상 — 색이 곧 정보다
```
agenda  (아젠다·이슈):  cyan-400     #02b8cc  Signal Teal
stance  (반응·의견):    blue-400     #6366f1  Iris Violet
emotion (정서·온도):    amber-400    #f2b422  (의도적 확장 — DESIGN.md 참조)
inquiry (질문·요구):    emerald-400  #27a644  Pulse Green
loyalty (참여·후원):    violet-400   #8b5cf6  Lavender
risk    (리스크·운영):  rose-400     #eb5757  Coral Red  ← 유일한 경고색
```

### 주 액션 — Acid Lime
```
lime-400 #e4f222 — 화면당 단일 주 액션에만. 축 색상으로는 절대 쓰지 않는다.
solid 버튼: bg-lime-400 text-slate-950 hover:bg-lime-300
```


## Linear 규율 (반드시)

| 규칙 | 이유 |
|------|------|
| **굵기 700+ 금지** — `font-semibold`(600)까지만 | 위계는 색과 크기로 만든다. `font-bold`/`font-extrabold`를 쓰지 마라 |
| **UI 컴포넌트에 그라디언트 금지** | 로고 마크도 평면 표면 + 단색 아이콘이다 |
| **그림자·글로우·블러 금지** | 깊이는 hairline 보더와 표면 밝기 차이로 |
| **반경** 버튼 `rounded-lg`(6px) / 카드 `rounded-xl`(12px) / 모달 `rounded-2xl`(16px) | Linear 스펙 |
| **모션** 0.15s, `cubic-bezier(0.4,0,0.2,1)`. 스프링·패럴랙스 금지 | CLI 도구의 감각 |
| **숫자는 `font-mono`** (tabular-nums 자동 적용) | 실시간 갱신 숫자가 자리마다 흔들리면 못 읽는다 |

### Recharts
CSS 클래스를 받지 못하므로 색을 직접 넘긴다. 반드시 Linear 토큰 값을 쓴다:
```
그리드/보더 #23252a · 축 텍스트 #62666d · 툴팁 배경 #08090a · 툴팁 텍스트 #e5e5e6
시리즈: #02b8cc(아젠다) #6366f1(논쟁) #eb5757(리스크) #8b5cf6(CPM) #27a644(미응답)
```
`ResponsiveContainer`는 flex 부모에서 폭이 붕괴한다 — 조상에 `min-w-0`, 컨테이너에 `minWidth={0}`.

### 상태
```
good: emerald-400 / warning: amber-400 / danger: rose-400 / normal: slate-200
sentiment.positive: emerald-400
sentiment.neutral:  slate-400
sentiment.negative: rose-400
```

### 폰트
```
숫자/값:    font-mono (JetBrains Mono, font-bold)
본문:       font-sans (Inter, font-medium)
타이틀:     font-sans, font-bold, tracking-tight
```

### 아이콘 (Lucide-React)
- 카드 헤더: size 18-20, 색상 `text-{accent}-400`
- 인라인 액션: size 14-16
- 모달/큰 영역: size 24-28

### 간격
- 카드 내 padding: `p-5`
- 카드 간 gap: `gap-4` 또는 `gap-6` (정보 밀도 우선)
- 섹션 간: `my-6` 또는 `my-8`

## 카드 구조 (MetricCard 기반)

`src/components/MetricCard.tsx`는 다음 props를 받음:
- `id`, `title`, `value` (string | number), `subtitle?`, `icon: LucideIcon`, `iconColorClass?`, `badge?`, `children?`

신규 메트릭 카드는 우선 MetricCard 재사용. 카드 형태가 크게 다른 경우(예: 리스트형, 차트형)만 새 컴포넌트.

## 새 컴포넌트 작성 패턴

```tsx
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MyCardProps {
  data: SomeType;
}

export const MyCard: React.FC<MyCardProps> = ({ data }) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg hover:border-slate-700/80 transition-all duration-300 relative overflow-hidden group">
      {/* 글로우 데코 */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-500"></div>

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-400 font-sans">제목</span>
        <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700/50 text-emerald-400">
          <Icon size={18} />
        </div>
      </div>

      {/* 본문 */}
      <div className="flex flex-col gap-2">
        {/* ... */}
      </div>
    </div>
  );
};
```

## App.tsx state 추가 패턴

App.tsx는 모노리식. 새 state는 기존 useState 그룹 영역에 추가:

```tsx
// 1) state (기존 분석/리포트 state 근처에)
const [newData, setNewData] = useState<NewType | null>(null);
const [isLoadingNew, setIsLoadingNew] = useState<boolean>(false);

// 2) fetch (기존 fetchAnalysis 등과 같은 위치)
const fetchNewData = async () => {
  setIsLoadingNew(true);
  try {
    const r = await fetch('/api/new-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* ... */ }),
    });
    const data = await r.json();
    if (!data.success) {
      setErrorMsg(data.error || '데이터를 가져오지 못했습니다.');
      return;
    }
    setNewData(data.payload);
  } catch (err: any) {
    setErrorMsg(`요청 실패: ${err.message}`);
  } finally {
    setIsLoadingNew(false);
  }
};

// 3) 트리거 useEffect (필요한 조건과 함께)
useEffect(() => {
  if (/* 조건 */) fetchNewData();
}, [/* deps */]);
```

## 데이터 안전 접근

응답 형태는 OpenAI strict 스키마로 강제되지만, **DEMO 시뮬레이터**나 **에러 폴백**에서는 비어 있을 수 있다. 항상 안전 접근:

```tsx
// ❌ 위험
{analysis.priceEstimates.map(...)}

// ✅ 안전
{analysis.priceEstimates?.length > 0
  ? analysis.priceEstimates.map(...)
  : <EmptyState />}
```

## 모션 가이드

`motion` 라이브러리 사용 시:
- transition: `{ duration: 0.2, ease: 'easeOut' }` 기본
- 카드 진입: opacity 0→1, y 8→0 (subtle)
- 강조 깜빡임: amber/red 액센트만, 1-2초 후 정지
- 과한 애니메이션은 정보 시야를 방해. 정보 밀도가 우선.

## 태그 라벨 한국어 매핑

태그 원문(`defamation_risk`)을 화면에 그대로 노출하지 않는다. 라벨 맵을 `src/components/talk/talkLabels.ts`에 모은다 (쇼핑의 `shopLabels.ts` 패턴).

```
issue_mention   → "사안 언급"      topic_request    → "주제 요청"
source_request  → "근거 요청"      agree_support    → "동의·지지"
disagree_object → "반대·이견"      doubt_verify     → "검증 요구"
outrage         → "분노"           fatigue_disengage→ "피로·이탈"
factual_question→ "사실 질문"      host_question_direct → "진행자 지목"
superchat       → "💜 후원"        attendance       → "출석"
hate_slur       → "🚨 혐오·욕설"   defamation_risk  → "⚠️ 명예훼손 소지"
misinfo_suspect → "❓ 검증 필요"    election_law_watch → "🗳️ 선거 주의"
brigading_spam  → "🌀 조직 도배"    stream_issue     → "⚡ 방송 장애"
positive → "긍정"  neutral → "중립"  negative → "부정"
```

리스크 태그 라벨은 **단정을 피한다.** `misinfo_suspect`는 "가짜뉴스"가 아니라 "검증 필요", `defamation_risk`는 "명예훼손"이 아니라 "명예훼손 소지"다. 라벨 한 단어가 제품의 법적 입장을 바꾼다 (D-4/D-5).

## 대량 렌더 방어

CPM 300 × 3시간 = 5만 건이다. 라이브 피드에 `messages.map()`을 그대로 쓰면 브라우저가 정지한다.

- 피드는 **최근 N건만 DOM에 유지**(링버퍼) 또는 가상 스크롤
- 집계·차트는 전체 배열이 아니라 **누적 카운터/타임라인 배열**에서 파생
- 자동 스크롤은 `chatEndRef.scrollIntoView()`가 아니라 **컨테이너의 `scrollTo({top: scrollHeight})`** — 전자는 페이지 전체를 움직인다

## 차트 (Recharts)

`ResponsiveContainer`는 flex 부모에서 `width(-1)`로 붕괴한다. 조상 flex 아이템에 `min-w-0`을 내리고 컨테이너에 `minWidth={0}`을 준다. 2026-06-06에 실제로 겪은 회귀이므로 새 차트마다 확인한다.

## 개인 정보 표시 제약 (D-1~D-3)

- 시청자 카드에 **정치성향·진영·정당 라벨을 표시하지 않는다.** 참여 빈도·후원·출석·미응답 보유 같은 비민감 축만
- 여론은 **집계 차트로만**. 집계에서 개인 목록으로 역추적하는 인터랙션(예: "반대 42%" 클릭 → 시청자 목록)을 만들지 않는다
- 리스크·선거 신호 패널에는 **"참고용이며 법적 판정이 아닙니다"** 면책 문구 상시 노출

이 제약에 닿는 UI는 safety-reviewer 검토 대상이다.

## 자주 발생하는 실수

1. **인라인 타입** — `(data: any)` 또는 인라인 interface → `src/types/liveTalk.ts` 활용
2. **축 색상 임의 변경** — 6축 매핑(시안/블루/앰버/에메랄드/바이올렛/로즈) 유지. 리스크만 경고색
3. **빈 응답 안전 접근 누락** — `data.field.length`처럼 undefined 위험
4. **App.tsx에 인라인으로 큰 UI** — 새 컴포넌트는 `src/components/talk/`로 분리
5. **JetBrains Mono를 본문에 사용** — Mono는 숫자/값 전용
6. **Tailwind 색상의 일관성 깨기** — slate-700/800/900 외 회색 추가 금지
7. **전량 렌더** — `messages.map()` 직접 사용
8. **타이머 콜백의 stale closure** — 폴링/인터벌이 참조하는 state는 `useRef` 미러링 필수 (2026-06-06 실제 버그)

## 빌드 검증

작업 종료 직전:
```
npm run lint
```

타입 에러가 나면 ai-schema-engineer 또는 backend-engineer에게 메시지로 즉시 보고.

## 산출물

`_workspace/03_frontend_changes.md` — 신규/수정 컴포넌트, App.tsx state/effect 변경점, 사용한 디자인 토큰 목록.
