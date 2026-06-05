---
name: express-endpoint-add
description: server.ts에 새 Express 엔드포인트를 추가하거나 기존 라우트를 수정한다. OpenAI generateContentWithRetryAndFallback 헬퍼 활용, !ai 시뮬레이터 fallback, YouTube Data API 키 검증, DEMO MODE 분기, 한국어 에러 메시지 패턴을 일관되게 적용. 신규 /api/* 라우트, AI 호출 추가, YouTube 통합 시 반드시 이 스킬 사용.
---

# express-endpoint-add — server.ts 엔드포인트 추가/수정 패턴

LiveChat Radar의 모노리식 `server.ts`에서 새 라우트를 추가할 때 따를 표준 패턴. 일관성이 라우트 간 가독성과 유지보수의 핵심이다.

## 표준 라우트 패턴

```ts
// API Route: N. {간단한 한국어 설명}
app.post('/api/{route}', async (req, res): Promise<any> => {
  const { /* req.body 또는 req.query 필드들 */ } = req.body;

  // [1] 입력 검증 (한국어 에러 메시지, 400)
  if (!필수파라미터) {
    return res.status(400).json({
      success: false,
      error: '한국어로 구체적인 에러 설명',
    });
  }

  // [2] DEMO 분기 (해당되는 경우)
  if (/* DEMO 조건 */) {
    return res.json({ success: true, /* DEMO 응답 */, isDemo: true });
  }

  // [3] !ai 폴백 (시뮬레이터)
  if (!ai) {
    console.log('No OPENAI_API_KEY detected. Using local simulator.');
    const simResult = /* 시뮬레이터 함수 호출 */;
    return res.json({ success: true, /* result */, isSimulated: true });
  }

  // [4] 정상 경로 (OpenAI 호출)
  try {
    const prompt = `한국어 프롬프트...`;
    const response = await generateContentWithRetryAndFallback({
      prompt,
      schemaName: 'my_schema',
      jsonSchema: { /* strict json_schema */ },
    });
    const parsed = cleanAndParseJSON(response.text?.trim() || '{}');
    parsed.analyzedAt = new Date().toLocaleTimeString(); // 또는 generatedAt
    return res.json({ success: true, /* parsed */ });
  } catch (err: any) {
    console.error('OpenAI {route} internal failure:', err);
    // 가능하면 graceful fallback, 아니면 500
    return res.status(500).json({
      success: false,
      error: `한국어 에러: ${err.message}`,
    });
  }
});
```

## 응답 형태 규약

- **성공:** `{ success: true, ...payload }` (예: `analysis`, `report`, `items`)
- **실패:** `{ success: false, error: '한국어 메시지' }`
- **DEMO:** payload + `isDemo: true`
- **시뮬레이터 폴백:** payload + `isSimulated: true`
- **부분 성공 (가상 분석으로 복구):** payload + `errorInfo: '한국어 메시지'`

프론트엔드 hook은 `success === true`만 보고 처리하므로 부분 성공도 success=true로 응답.

## AI 호출은 반드시 헬퍼 경유

새 라우트가 OpenAI를 호출해야 한다면, 반드시 다음 시그니처의 헬퍼를 사용:

```ts
async function generateContentWithRetryAndFallback(params: {
  prompt: string;
  schemaName: string;  // 예: 'live_chat_analysis'
  jsonSchema: any;     // strict JSON Schema
}): Promise<{ text: string }>
```

직접 `ai.chat.completions.create`를 호출하면 재시도/모델 폴백/로깅이 누락된다.

## YouTube Data API 호출 패턴

새 라우트가 YouTube API를 부른다면:

1. `apiKey === 'MY_YOUTUBE_API_KEY'` 또는 미설정 체크 → 한국어 에러
2. DEMO 분기 먼저 (`'demo'` 키워드 또는 `demo-chat-id`)
3. `fetch` 사용 (axios 추가하지 말 것)
4. `apiResponse.ok` 체크
5. 응답을 한국어 친화 객체로 변환 (예: `author`, `message`, `timestamp` 평탄화)

## 시뮬레이터 함수 작성/수정

새 AI 응답 필드를 추가했다면 `generateSimulatedAIAnalysis`에도 동일 필드를 채워야 한다.

원칙:
- 입력 메시지의 일부 특성(키워드, 길이)을 활용해 그럴듯한 더미 생성
- 빈 배열·기본값은 최소화 (DEMO도 풍부해 보여야 함)
- 한국어 톤 유지 (존댓말, 친절)

## 한국어 에러 메시지 톤

기존 메시지 톤 (그대로 유지):
- "유튜브 URL 또는 비디오 ID가 전달되지 않았습니다."
- "현재 라이브 중이 아니거나 채팅이 활성화되어 있지 않습니다."
- "AI 분석 호출 도중 지연이 발생하여 가상 분석 시스템으로 즉시 자동 복구되었습니다: {err.message}"

키: 존댓말 + 구체적 원인 + 가능하면 사용자 행동 힌트.

## 로그 컨벤션

- `[AI Listener] ...` — OpenAI 호출 관련
- `console.log('No OPENAI_API_KEY detected. ...')` — 폴백 진입
- `console.error('OpenAI {area} internal failure:', err)` — 예외 보고

## 자주 발생하는 실수

1. **시뮬레이터 누락** → DEMO 사용자가 깨진 UI를 본다
2. **재시도 헬퍼 우회** → 503 에러 시 사용자에게 즉시 노출
3. **영어 에러 메시지** → UI 톤 깨짐, 사용자 혼란
4. **`return` 누락** → Express 응답 후 코드 계속 실행되어 헤더 중복 에러
5. **`async` 함수에서 `Promise<any>` 미반환 타입 어노테이션** → 기존 코드 컨벤션 위반

## 산출물

`_workspace/02_backend_changes.md` — 변경된 라우트 목록, 신규 헬퍼/시뮬레이터 수정, fallback 동작 검증 노트.

## 빌드 검증

작업 종료 직전 1회:
```
npm run lint
```
(`tsc --noEmit`이 실행됨)

타입 에러가 나면 ai-schema-engineer에게 즉시 메시지로 보고 후 함께 해결.
