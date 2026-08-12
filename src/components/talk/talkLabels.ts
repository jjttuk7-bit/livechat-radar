/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 정치·시사 UI 공용 라벨/색상 매핑 (단일 출처).
 * 축/태그 한국어 라벨과 High Density 다크 테마 액센트 클래스를 한 곳에서 관리한다.
 *
 * ⚠️ 리스크 태그 라벨은 **단정을 피한다** (D-4 / D-5).
 *   misinfo_suspect → "가짜뉴스"가 아니라 "검증 필요"
 *   defamation_risk → "명예훼손"이 아니라 "명예훼손 소지"
 *   election_law_watch → "선거법 위반"이 아니라 "선거 주의"
 * 라벨 한 단어가 제품의 법적 입장을 바꾼다.
 */

import {
  TalkAxis,
  TalkMetricStatus,
  TalkTag,
  RiskSeverity,
  UrgencyLevel,
} from '../../types/liveTalk';

export const AXIS_LABEL: Record<TalkAxis, string> = {
  agenda: '아젠다·이슈',
  stance: '반응·의견',
  emotion: '정서·온도',
  inquiry: '질문·요구',
  loyalty: '참여·후원',
  risk: '리스크·운영',
};

/** 축별 텍스트 액센트 — 리스크만 경고색(로즈) */
export const AXIS_TEXT: Record<TalkAxis, string> = {
  agenda: 'text-cyan-400',
  stance: 'text-blue-400',
  emotion: 'text-amber-400',
  inquiry: 'text-emerald-400',
  loyalty: 'text-violet-400',
  risk: 'text-rose-400',
};

/** 축별 바/칩 배경 */
export const AXIS_BAR: Record<TalkAxis, string> = {
  agenda: 'bg-cyan-500',
  stance: 'bg-blue-500',
  emotion: 'bg-amber-500',
  inquiry: 'bg-emerald-500',
  loyalty: 'bg-violet-500',
  risk: 'bg-rose-500',
};

export const TAG_LABEL: Record<TalkTag, string> = {
  // agenda
  issue_mention: '사안 언급',
  figure_mention: '인물 언급',
  topic_request: '주제 요청',
  followup_request: '후속 요청',
  source_request: '근거 요청',
  guest_request: '초대 요청',
  breaking_tip: '제보·속보',
  // stance
  agree_support: '동의·지지',
  disagree_object: '반대·이견',
  doubt_verify: '검증 요구',
  mixed_nuance: '조건부',
  whataboutism: '맞불',
  // emotion
  outrage: '분노',
  anxiety: '불안',
  ridicule: '조소',
  hope_cheer: '환호·응원',
  fatigue_disengage: '피로·이탈',
  despair: '실망·체념',
  // inquiry
  factual_question: '사실 질문',
  explain_request: '설명 요청',
  opinion_request: '견해 요청',
  host_question_direct: '진행자 지목',
  rerun_request: '다시보기 요청',
  how_to_act: '행동 문의',
  // loyalty
  superchat: '후원',
  membership: '멤버십',
  subscribe_share: '구독·공유',
  attendance: '출석',
  community_bond: '유대·응원',
  petition_action: '행동 언급',
  // risk — 단정 금지 (D-4 / D-5)
  hate_slur: '혐오·욕설',
  defamation_risk: '명예훼손 소지',
  misinfo_suspect: '검증 필요',
  election_law_watch: '선거 주의',
  brigading_spam: '도배·확산',
  stream_issue: '방송 장애',
  // fallback
  other: '기타',
};

export const STATUS_BORDER: Record<TalkMetricStatus, string> = {
  good: 'border-emerald-500/30',
  normal: 'border-slate-800',
  warning: 'border-amber-500/40',
  danger: 'border-rose-500/50',
};

export const STATUS_TEXT: Record<TalkMetricStatus, string> = {
  good: 'text-emerald-400',
  normal: 'text-slate-200',
  warning: 'text-amber-400',
  danger: 'text-rose-400',
};

export const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

export const SEVERITY_CHIP: Record<RiskSeverity, string> = {
  high: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  low: 'bg-slate-700/40 text-slate-400 border-slate-700',
};

export const URGENCY_CHIP: Record<UrgencyLevel, string> = {
  high: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  low: 'bg-slate-700/40 text-slate-400 border-slate-700',
};

/**
 * 리스크·선거 신호에 상시 노출하는 면책 문구 (D-4 / D-5).
 * 이 문구를 제거하는 변경은 safety-reviewer 검토 대상이다.
 */
export const RISK_DISCLAIMER = '본 판단은 참고용이며 법적 판정이 아닙니다.';
