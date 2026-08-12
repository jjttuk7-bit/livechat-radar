/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LiveChat Radar — 유튜브 정치·시사 라이브 전용 타입 계약 (P-1).
 *
 * 단일 출처(single source of truth): 백엔드 응답(server.ts) · OpenAI strict json_schema(src/prompts.ts)
 * · L1 파이프라인(src/lib/) · 프론트 hook(App.tsx)이 이 파일을 공유한다.
 *
 * AI 응답으로 채워지는 인터페이스는 OpenAI Structured Outputs strict 모드와 1:1 매핑된다.
 * strict는 옵셔널(`?`)을 허용하지 않으므로, 비어있을 수 있는 필드는 `| null`로 표현하고
 * schema에서 required + nullable(`type: ['x','null']`)로 둔다.
 * 단, `analyzedAt`처럼 서버가 응답 직후 주입하는 메타 필드는 schema에 포함하지 않고 TS에서만 옵셔널로 둔다.
 *
 * 설계 근거: docs/plans/politics-pivot.md 3절(6축 37태그) · 5절(KPI) · 2절(안전 D-1~D-8).
 *
 * ⚠️ 안전 제약 (D-1 / D-2 / D-3):
 *   이 파일에는 **개인 단위 정치성향·진영·정당 필드가 존재하지 않는다.** 정치적 견해는 민감정보이며,
 *   닉네임과 성향을 묶은 데이터 구조는 만들지 않는다. 시청자 개인 지표는 참여 빈도·후원·출석 등
 *   비민감 축(SupporterProfile)만 두고, 여론은 집계(TalkMetric / analyses 분포)로만 표현한다.
 *   성향 필드를 추가하려는 변경은 safety-reviewer 승인 없이 진행하지 않는다.
 */

// ── 분류 축 & 세부 태그 (6축 × 37 태그) ───────────────────────────────────────

export type TalkAxis = 'agenda' | 'stance' | 'emotion' | 'inquiry' | 'loyalty' | 'risk';

/** 축 1. 아젠다·이슈 — 무엇에 대해 말하는가 (다음에 다룰 주제 우선순위의 핵심) */
export type AgendaTag =
  | 'issue_mention'     // 특정 사안 언급
  | 'figure_mention'    // 특정 인물·기관 언급
  | 'topic_request'     // "이 주제 다뤄주세요"
  | 'followup_request'  // 지난 방송 후속 요청
  | 'source_request'    // 근거·자료·원문 요청
  | 'guest_request'     // "○○ 초대해주세요"
  | 'breaking_tip';     // 제보·속보 공유

/**
 * 축 2. 반응·의견 — 집계 전용 (D-1 / D-3).
 * 진영 라벨(보수/진보/정당)은 태그로 존재하지 않는다. 여론 흐름은 이 5태그의 비율로만 표현한다.
 */
export type StanceTag =
  | 'agree_support'    // 동의·지지
  | 'disagree_object'  // 반대·이견
  | 'doubt_verify'     // 의심·검증 요구
  | 'mixed_nuance'     // 조건부·양비
  | 'whataboutism';    // 화제 전환·맞불 (논쟁 격화 선행 신호)

/** 축 3. 정서·온도 */
export type EmotionTag =
  | 'outrage'            // 분노·격앙
  | 'anxiety'            // 불안·우려
  | 'ridicule'           // 조소·비꼼
  | 'hope_cheer'         // 환호·응원
  | 'fatigue_disengage'  // 피로·지루함 (이탈 선행 신호)
  | 'despair';           // 실망·체념

/** 축 4. 질문·요구 — 미응답 큐 적재 대상 */
export type InquiryTag =
  | 'factual_question'      // 사실 확인 질문
  | 'explain_request'       // "쉽게 설명해주세요"
  | 'opinion_request'       // 진행자 견해 요청
  | 'host_question_direct'  // 진행자 지목 질문
  | 'rerun_request'         // 다시보기·타임스탬프 요청
  | 'how_to_act';           // "우리가 뭘 해야 하나"

/** 축 5. 참여·후원 — 수익 엔진 */
export type LoyaltyTag =
  | 'superchat'        // 슈퍼챗·후원
  | 'membership'       // 멤버십 가입·갱신
  | 'subscribe_share'  // 구독·좋아요·공유 독려
  | 'attendance'       // 출근/출석 도장·인사 (정치 채널 특유의 강한 신호)
  | 'community_bond'   // 시청자 간 유대·응원
  | 'petition_action'; // 청원·집회·투표 등 오프라인 행동 언급

/**
 * 축 6. 리스크·운영 — 채널 방어의 핵심.
 * ⚠️ 이 축의 태그는 **탐지 신호이지 판정이 아니다** (D-4 / D-5).
 *   - misinfo_suspect = "검증 필요"이며 "거짓"이 아니다
 *   - election_law_watch = "주의 표현"이며 위법 판정이 아니다
 *   - defamation_risk = "명예훼손 소지"이며 명예훼손 확정이 아니다
 * UI 라벨과 프롬프트 문구가 단정으로 바뀌면 제품의 법적 입장이 바뀐다.
 */
export type RiskTag =
  | 'hate_slur'           // 혐오·차별·욕설
  | 'defamation_risk'     // 명예훼손 소지 (단정적 범죄 단언)
  | 'misinfo_suspect'     // 미확인 주장 확산 → 검증 필요 플래그
  | 'election_law_watch'  // 선거 관련 주의 표현
  | 'brigading_spam'      // 조직적 도배·좌표
  | 'stream_issue';       // 음향/화면/끊김

/** 어느 축에도 안 맞는 댓글 */
export type TalkTag =
  | AgendaTag
  | StanceTag
  | EmotionTag
  | InquiryTag
  | LoyaltyTag
  | RiskTag
  | 'other';

export type Sentiment = 'positive' | 'neutral' | 'negative';
export type UrgencyLevel = 'low' | 'medium' | 'high';
export type TalkMetricStatus = 'good' | 'normal' | 'warning' | 'danger';
/** 리스크 심각도 — urgency와 의미가 다르므로 별도 유지 */
export type RiskSeverity = 'low' | 'medium' | 'high';

/** 축 enum 단일 출처 — schema enum / 시뮬레이터 / L1 사전이 이 배열을 공유한다. */
export const TALK_AXES: readonly TalkAxis[] = ['agenda', 'stance', 'emotion', 'inquiry', 'loyalty', 'risk'];

/**
 * 태그 enum 단일 출처.
 * 태그를 추가할 때는 반드시 세 곳을 함께 갱신한다: 유니온 타입 · 이 배열 · TAG_AXIS 맵.
 * (qa-validator의 "쌍 4: enum 삼중 일치"가 이 규칙을 검사한다.)
 */
export const TALK_TAGS: readonly TalkTag[] = [
  // agenda
  'issue_mention', 'figure_mention', 'topic_request', 'followup_request', 'source_request', 'guest_request', 'breaking_tip',
  // stance
  'agree_support', 'disagree_object', 'doubt_verify', 'mixed_nuance', 'whataboutism',
  // emotion
  'outrage', 'anxiety', 'ridicule', 'hope_cheer', 'fatigue_disengage', 'despair',
  // inquiry
  'factual_question', 'explain_request', 'opinion_request', 'host_question_direct', 'rerun_request', 'how_to_act',
  // loyalty
  'superchat', 'membership', 'subscribe_share', 'attendance', 'community_bond', 'petition_action',
  // risk
  'hate_slur', 'defamation_risk', 'misinfo_suspect', 'election_law_watch', 'brigading_spam', 'stream_issue',
  // fallback
  'other',
] as const;

/** 각 태그가 속한 축. 분포 집계·색상 매핑에 사용. */
export const TAG_AXIS: Record<TalkTag, TalkAxis> = {
  issue_mention: 'agenda', figure_mention: 'agenda', topic_request: 'agenda', followup_request: 'agenda',
  source_request: 'agenda', guest_request: 'agenda', breaking_tip: 'agenda',

  agree_support: 'stance', disagree_object: 'stance', doubt_verify: 'stance', mixed_nuance: 'stance',
  whataboutism: 'stance',

  outrage: 'emotion', anxiety: 'emotion', ridicule: 'emotion', hope_cheer: 'emotion',
  fatigue_disengage: 'emotion', despair: 'emotion',

  factual_question: 'inquiry', explain_request: 'inquiry', opinion_request: 'inquiry',
  host_question_direct: 'inquiry', rerun_request: 'inquiry', how_to_act: 'inquiry',

  superchat: 'loyalty', membership: 'loyalty', subscribe_share: 'loyalty', attendance: 'loyalty',
  community_bond: 'loyalty', petition_action: 'loyalty',

  hate_slur: 'risk', defamation_risk: 'risk', misinfo_suspect: 'risk', election_law_watch: 'risk',
  brigading_spam: 'risk', stream_issue: 'risk',

  other: 'risk',
};

/** 미응답 큐 적재 대상이 되는 축 */
export const INQUIRY_AXIS: TalkAxis = 'inquiry';

/**
 * 리스크 태그 단일 출처 — RiskAlert.tag의 schema enum이 이 배열을 재사용한다.
 * TALK_TAGS의 부분집합이며, talkTaxonomy.test.ts가 포함 관계를 검증한다.
 */
export const RISK_TAGS: readonly RiskTag[] = [
  'hate_slur',
  'defamation_risk',
  'misinfo_suspect',
  'election_law_watch',
  'brigading_spam',
  'stream_issue',
];

export const RISK_SEVERITIES: readonly RiskSeverity[] = ['low', 'medium', 'high'];
export const SENTIMENTS: readonly Sentiment[] = ['positive', 'neutral', 'negative'];
export const URGENCY_LEVELS: readonly UrgencyLevel[] = ['low', 'medium', 'high'];
export const METRIC_STATUSES: readonly TalkMetricStatus[] = ['good', 'normal', 'warning', 'danger'];

// ── 입력 계약: 방송 큐시트 ────────────────────────────────────────────────────

/** 사전 등록 예상 질문·답변 (스크립트 어시스트) */
export interface PresetFaq {
  q: string;
  a: string;
}

/** 방송 시작 시 진행자가 등록하는 오늘의 이슈(큐시트 항목). 분석 호출의 컨텍스트로 AI에 전달된다. */
export interface LiveIssue {
  id: string;
  title: string;
  keywords?: string[];      // 매칭용 키워드 ['특검', '국정조사', …]
  figures?: string[];       // 관련 인물·기관
  isActive?: boolean;       // 현재 다루는 중인 이슈
  talkingPoints?: string[]; // 진행 포인트 (한 번에 읽기용)
  presetFaqs?: PresetFaq[]; // 예상 질문·답변 (자동 매칭용)
}

/** 코너/이슈 타임블록 — 활성 이슈가 다뤄진 구간 */
export interface SegmentBlock {
  id: string;
  issueId: string;
  title: string;
  startedAt: string;      // ISO
  endedAt: string | null; // null = 현재 진행중
}

// ── AI 응답 계약 (OpenAI strict json_schema와 1:1) ────────────────────────────

/** 댓글 1건의 6축 태깅 + 이슈/인물 매칭 결과 */
export interface TalkCommentAnalysis {
  id: string;
  text: string;
  author: string | null;
  timestamp: string;
  axis: TalkAxis;
  tag: TalkTag;
  issueId: string | null;   // 매칭된 등록 이슈 id (없으면 null)
  figure: string | null;    // 언급된 인물·기관 (없으면 null)
  sentiment: Sentiment;
  urgency: UrgencyLevel;
  isRequest: boolean;       // 진행자 응답이 필요한 질문/요구인가 (미응답 큐 후보)
  answered: boolean | null; // 진행자 응답 매칭 여부 (미정 시 null)
  /** L1 dedupe 결과 — 동일 문구가 몇 건 있었는지. 표본 1건이 n건을 대표한다. */
  duplicateCount: number;
}

/** KPI 대시보드 메트릭 1개 */
export interface TalkMetric {
  id: string;
  label: string;
  value: number | string;  // 수치형 KPI 또는 "지금"/"대기" 같은 신호 라벨
  unit: string | null;     // '%','건' 등 (없으면 null)
  description: string;
  status: TalkMetricStatus;
}

/** 실시간 액션(처방 멘트) 카드 */
export interface TalkActionCard {
  id: string;
  priority: UrgencyLevel;
  title: string;
  reason: string;            // 근거 (관련 댓글 n건 등)
  suggestedLine: string;     // 진행자가 바로 말할 처방 멘트
  evidence: string[];        // 근거 댓글 원문
  targetIssueId: string | null; // 관련 이슈 (전체 대상이면 null)
}

/** 미응답 요구 큐 항목 */
export interface UnansweredRequest {
  id: string;
  text: string;
  author: string | null;
  askedAt: string;
  issueId: string | null;
  tag: TalkTag;
  urgency: UrgencyLevel;
  suggestedAnswer: string | null; // FAQ 매칭 추천 답변 (없으면 null)
}

/** 이슈별 관심 랭킹 ("다음에 다룰 주제" 우선순위) */
export interface AgendaInterest {
  issueId: string;
  title: string;
  interestScore: number;   // 0-100 정규화
  mentionCount: number;
  requestCount: number;    // 해당 이슈 관련 질문·요구 수
  isRising: boolean;       // 직전 구간 대비 급상승 여부
}

/**
 * 리스크 알림 — 채널 방어의 핵심 (D-4 / D-5).
 * `recommendation`은 권고이며 자동 실행 대상이 아니다. 삭제·차단은 사람이 판단한다.
 */
export interface RiskAlert {
  id: string;
  tag: RiskTag;
  severity: RiskSeverity;
  text: string;            // 원문
  author: string | null;
  detectedAt: string;
  spreadCount: number;     // 동일·유사 문구 확산 건수
  reason: string;          // 왜 리스크로 분류했는가
  recommendation: string;  // 권고 조치 (삭제 검토 / 모더레이터 확인 / 관망 등)
}

/** 반복 질문·루머 FAQ 후보 */
export interface TalkFaqItem {
  question: string;
  count: number;
  templateAnswer: string;
  issueId: string | null;
}

/** /api/analyze/talk 응답 최상위 — analyzedAt만 서버 주입 메타. */
export interface TalkAnalysisResult {
  analyses: TalkCommentAnalysis[];
  metrics: TalkMetric[];
  actionCards: TalkActionCard[];
  unanswered: UnansweredRequest[];
  agendaInterest: AgendaInterest[];
  riskAlerts: RiskAlert[];
  faq: TalkFaqItem[];
  recentSummary: string;
  hostAdvice: string;      // 지금 진행 전략 한 줄
  analyzedAt?: string;     // 서버가 응답 직후 주입 (strict schema 비포함)
}

// ── 타임라인 스냅샷 ───────────────────────────────────────────────────────────

export interface TalkTimelinePoint {
  t: number;             // Unix ms
  cpm: number;           // 분당 댓글 수
  rallyHeat: number;     // 결집 온도 %
  disputeLevel: number;  // 이견·논쟁 강도 건수
  unansweredCount: number; // 미응답 요구 누적
  riskCount: number;     // 리스크 누적 — 급증 구간 추적
  supportCount: number;  // 후원 누적 (슈퍼챗·멤버십)
}

// ── 참여 퍼널 ─────────────────────────────────────────────────────────────────

/** 시청자 단위 참여 퍼널 단계별 인원 + 추정 참여 전환율 */
export interface ParticipationFunnel {
  commented: number;   // 채팅 참여
  engaged: number;     // 반복 참여(2건 이상)
  advocated: number;   // 구독·공유 독려 등 능동 행동
  supported: number;   // 후원(슈퍼챗·멤버십)
  supportRate: number; // supported / commented * 100 (0-100)
}

// ── 어필 윈도우 ───────────────────────────────────────────────────────────────

/** 지금이 구독·후원 안내 적기인지 감지한 결과 */
export interface AppealWindow {
  open: boolean;         // 어필 타이밍 도달 여부
  score: number;         // 강도 0-100
  reasons: string[];     // 근거 (결집 온도/후원 가속/스파이크)
  suggestedLine: string; // 바로 칠 안내 멘트
}

// ── 멘트 효과 마킹 ────────────────────────────────────────────────────────────

/** 진행자가 특정 멘트를 친 시점 마킹 — 직후 결집/후원 변화로 효과 측정 */
export interface MentionMark {
  id: string;
  label: string;             // 구독 안내 / 후원 감사 / 자료 공개 등
  at: string;                // ISO
  baselineSupport: number;   // 마킹 시점 누적 후원
  baselineHeat: number;      // 마킹 시점 결집 온도
}

// ── 시청자 인텔리전스 (비민감 축만 — D-1 / D-2) ───────────────────────────────

/**
 * ⚠️ 이 타입에는 정치성향·진영·정당 필드를 추가하지 않는다.
 * 충성도와 모더레이션은 성향 정보 없이 성립한다. flag는 **행위 기준**이다.
 */
export type SupporterFlag = 'core_supporter' | 'regular' | 'troll' | 'normal';

/** author 단위로 누적 집계한 시청자 프로필. 클라이언트에서 analyses로부터 파생. */
export interface SupporterProfile {
  author: string;
  commentCount: number;
  firstSeen: string;
  lastSeen: string;
  loyaltyScore: number;         // 0-100 참여·충성 점수 (구매 가능성 아님)
  topTags: TalkTag[];           // 자주 단 태그 상위
  interestedIssueIds: string[]; // 관심 보인 이슈 id
  hasUnanswered: boolean;       // 미응답 질문 보유
  isReturning: boolean;         // 재방문·단골 신호
  isSupporter: boolean;         // 후원(슈퍼챗) 이력
  isMember: boolean;            // 멤버십(sponsor)
  riskFlagCount: number;        // 행위 기준 리스크 건수 (도배·욕설)
  flag: SupporterFlag;
}

/** 세그먼트 결산 (배타적 분류) */
export interface SupporterSummary {
  total: number;
  supporters: number;
  members: number;
  regulars: number;
  onlookers: number;
  trolls: number;
}

// ── 종료 리포트 ───────────────────────────────────────────────────────────────

export interface TalkReportSummaryStats {
  totalMessages: number;
  peakCpm: number;
  topAgenda: string;        // 관심도 최상위 이슈 (없으면 '-')
  supportCount: number;     // 후원 신호 건수
  unansweredCount: number;  // 미응답으로 남은 요구 수
  answerRate: number;       // 요구 대비 응답 추정 비율 (0-100)
  riskCount: number;        // 리스크 발생 건수
}

/** /api/report/talk 응답 — reportMarkdown은 7섹션 전체를 포함. */
export interface TalkReportResult {
  reportMarkdown: string;
  summaryStats: TalkReportSummaryStats;
  generatedAt?: string;     // 서버 주입 메타 (strict schema 비포함)
}

// ── 종료 후 심화 분석 (세션 데이터에서 클라이언트 파생) ────────────────────────

export interface GoldenMoment {
  t: number;               // Unix ms
  supportDelta: number;    // 그 구간 후원 증가
  heat: number;            // 그 시점 결집 온도
  mention: string | null;  // 직전 진행자 멘트 마킹 (있으면)
}

export interface TimeBucket {
  label: string;   // "구간 1" 또는 시각 범위
  avgHeat: number; // 평균 결집 온도
  support: number; // 그 구간 후원 증가
  risk: number;    // 그 구간 리스크 건수
}

export interface PostLiveInsights {
  goldenMoments: GoldenMoment[];
  timeBuckets: TimeBucket[];
  dropOff: { detected: boolean; note: string };
  checklist: string[]; // 다음 방송 액션 체크리스트
}

// ── 크로스세션 (P-11) ─────────────────────────────────────────────────────────
//
// 매일 방송 + 고정 시청층이라는 정치·시사의 특성이 처음으로 자산이 되는 지점.
// 쇼핑에서는 3순위였지만 여기서는 경쟁 우위의 핵심이다.
//
// ⚠️ D-8: 닉네임은 **해시로만** 저장한다. 원문 닉네임과 댓글 원문은 영속 저장하지 않는다.
//   개인 정치성향은 애초에 계산하지 않으므로 저장 대상 자체가 없다 (D-1).

/** 회차 1건의 요약 — 세션 종료 시 저장되는 단위 */
export interface SessionRecord {
  /** 회차 id (방송 videoId 또는 생성 id) */
  id: string;
  /** 방송 제목 */
  title: string;
  /** 방송 일자 (ISO) */
  startedAt: string;
  endedAt: string;
  totalMessages: number;
  peakCpm: number;
  /** 결집 온도 평균 */
  avgRallyHeat: number;
  supportCount: number;
  riskCount: number;
  unansweredCount: number;
  answerRate: number;
  /** 이슈별 관심도 (제목 기준 — 다음 회차와 비교 가능하도록) */
  agenda: { title: string; interestScore: number; mentionCount: number }[];
  /** 끝까지 답하지 못한 요구 (다음 방송 이월용). 원문 대신 요약된 질문만 */
  carryOverRequests: string[];
  /** 참여자 해시 목록 (D-8 — 원문 닉네임 미저장) */
  participantHashes: string[];
}

/** 직전 회차 대비 비교 */
export interface SessionComparison {
  current: SessionRecord;
  previous: SessionRecord | null;
  deltas: {
    totalMessages: number;
    peakCpm: number;
    avgRallyHeat: number;
    supportCount: number;
    riskCount: number;
    answerRate: number;
  } | null;
  /** 직전 회차에도 참여했던 사람 수 (해시 교집합) */
  returningCount: number;
  /** 재방문율 % */
  returningRate: number;
}

/** 이슈 하나의 회차별 관심도 추이 — "이 사안이 며칠째 화제인가" */
export interface AgendaTrend {
  title: string;
  points: { sessionId: string; at: string; interestScore: number; mentionCount: number }[];
  /** 최근 대비 상승/하강 */
  direction: 'rising' | 'falling' | 'flat';
  /** 연속 등장 회차 수 */
  streak: number;
}
