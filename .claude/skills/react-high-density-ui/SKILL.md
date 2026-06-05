---
name: react-high-density-ui
description: LiveChat Radar의 React 19 + Tailwind 4 + Lucide-React + Motion 기반 High Density 다크 대시보드에 UI 요소(카드/모달/리스트/메트릭)를 추가/수정한다. #020617 우주적 다크 배경, 슬레이트/시안 글로우 보더, JetBrains Mono 숫자 폰트 컨벤션을 따른다. 새 대시보드 카드, 분석 결과 시각화, 모달, 카테고리 색상 변경 시 반드시 이 스킬 사용.
---

# react-high-density-ui — High Density 다크 대시보드 UI

LiveChat Radar의 디자인 철학("정보 점유율 100%, 시각 방해 최소화")을 코드 레벨에서 실천하기 위한 스킬.

## 디자인 토큰 (필수 준수)

### 색상
```
배경 (앱):       bg-[#020617]
배경 (카드):     bg-slate-900/80
보더 (기본):     border border-slate-800
보더 (호버):     hover:border-slate-700/80
텍스트 (본문):   text-slate-200
텍스트 (보조):   text-slate-400
텍스트 (약화):   text-slate-500
글로우 데코:     bg-{indigo|cyan|emerald|amber|rose}-500/5 blur-2xl
```

### 액센트 색상 (카테고리별)
```
purchase_signal:  emerald-400 / emerald-500
stream_issue:     amber-400 / orange-500
complaint:        rose-400 / red-500
urgent (action):  red-400 / red-500
action (presenter): indigo-400 / indigo-500
info:             slate-400 / slate-500
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

## 카테고리 라벨 한국어 매핑

```
purchase_signal → "🛒 구매 신호"
stream_issue    → "⚡ 방송 장애"
complaint       → "🚨 불만 의심"
urgent          → "긴급"
action          → "행동"
info            → "정보"
positive        → "긍정"
neutral         → "중립"
negative        → "부정"
```

## 자주 발생하는 실수

1. **인라인 타입** — `(data: any)` 또는 인라인 interface 작성 → types.ts 활용
2. **카테고리 색상 임의 변경** — 기존 emerald/amber/rose 매핑 유지
3. **DEMO 안전 접근 누락** — `data.field.length`처럼 undefined 위험
4. **App.tsx에 인라인으로 큰 UI** — 새 컴포넌트는 `src/components/`로 분리
5. **JetBrains Mono를 본문에 사용** — Mono는 숫자/값 전용
6. **Tailwind 색상의 일관성 깨기** — slate-700/800/900 외 회색 추가 금지

## 빌드 검증

작업 종료 직전:
```
npm run lint
```

타입 에러가 나면 ai-schema-engineer 또는 backend-engineer에게 메시지로 즉시 보고.

## 산출물

`_workspace/03_frontend_changes.md` — 신규/수정 컴포넌트, App.tsx state/effect 변경점, 사용한 디자인 토큰 목록.
