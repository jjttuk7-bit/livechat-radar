# 📡 LiveChat Radar (라이브챗 레이더)

> **"방송자가 지금 시청자와 교감하기 위해 무엇을 말해야 하는지 실시간으로 콕 짚어 알려주는 AI 조연출"**  
> 유튜브 라이브 URL을 기반으로 실시간 피드 댓글을 안전하게 미러링 수집 및 분류하고, OpenAI gpt-4o 계열 모델의 고도화된 정서/리스닝 분석을 유기적으로 엮어 실시간 맞춤 가이드를 처방하는 고밀도(High Density) MVP 대시보드입니다.

---

## ✨ 핵심 혁신 가치 (Core Offerings)
1. **유튜브 통합 라이브 커넥터** : URL/VideoID 기반으로 `activeLiveChatId`를 분석하여 다이렉트 미러링 연동을 자동으로 수행합니다.
2. **실시간 위기 및 액션 솔루션** : 시청자의 긍정/부정 감정 비율, 최고 순간 대화 밀도(Peak CPM)를 추적합니다.
3. **가이드 답변 템플릿 (Click-to-Copy)** : 자주 복창되는 시청자 질문(FAQ)의 최적 답변 대사 템플릿을 AI가 실시간 자동 작성하여 원클릭 복사 소통을 유도합니다.
4. **특수 리액션 분류 리스트** :
   - 🛒 **구매 신호 (Purchase Signals)**: 결제 가이드, 혜택 관심 시그널 감지
   - ⚡ **방송 장애 (Stream Issues)**: 싱크 밀림, 오디오 하울링, 동결 이슈 필터화
   - 🚨 **불만 의심 (Complaints)**: 조롱, 비난, 의도적 도배 대처
5. **방송 종료 종합 분석 리포트** : 방송을 마치며 다운로드 받아 복기 및 피드백할 수 있는 디테일한 마크다운 리포트를 AI 자동 생성합니다.
6. **고성능 로컬 가상 시뮬레이터 지원 (DEMO MODE)** : API Key 설정이 마련되지 않은 샌드박스 및 빠른 체험을 위한 실감형 가상 댓글 스트리밍 흐름을 완벽 탑재했습니다.

---

## 🛠️ 기술 스택 및 환경 설정 (Technical Stack)
- **Frontend** : React Dynamic Layout, Tailwind CSS @4 (High Density Visual), Lucide-React Icons
- **Backend / Engine** : Express.js, TypeScript Native Type Stripping (`tsx`), OpenAI API (gpt-4o-mini 우선 / gpt-4o 폴백) with Structured Outputs JSON Schema (`openai`)

### 🔑 환경변수 세팅 (`.env` 파일 설정)
프로젝트 루트 폴더에 `.env` 파일을 생성해 아래 키들을 대입합니다 (키가 없으면 자동으로 로컬 시뮬레이터로 폴백됩니다):
```env
# Google Cloud Console에서 발급받은 유튜브 Data API v3 키
YOUTUBE_API_KEY="YOUR_YOUTUBE_API_KEY"

# OpenAI Platform에서 발급받은 OpenAI API 키
# https://platform.openai.com/api-keys
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
```

---

## 🚀 로컬 구동 지침 (Simple Start Guides)
포트 3000번으로 로컬 프록시가 작동합니다.
```bash
# 1. 의존성 패키지 설치
npm install

# 2. 풀스택 개발 모드 기동 (Express Server + Vite SPA Proxy)
npm run dev

# 3. 배포(Production)용 빌드 및 구동
npm run build
npm run start
```

---

## 🎨 디자인 철학 (Design Aesthetics)
- **High Density Theme**: 깊이 있는 우주적 감성의 짙은 백그라운드 `#020617`와 얇고 균일한 사이안 글로잉 보더라인 디자인을 채용하여 전업 호스트 시야 방해를 최소화하는 동시에 기동성을 극대화 하였습니다.
- **Architectural Honesty**: 불필요한 테라바이트 로그 및 테크 데코레이션을 지양하고 실제 스트리머가 시각 점유율 100% 상황에서 활용할 수 있도록 직관성을 최우선시하여 기획되었습니다.
