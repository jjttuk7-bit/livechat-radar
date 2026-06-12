import { liveModeById } from '../config/liveModes';
import {
  AnalyzeCommentsInput,
  AnalyzeCommentsResult,
  CommentAnalysis,
  LiveModeId,
  PostLiveReport,
  RadarMetric,
  RadarStatus,
} from '../types/liveRadar';

export const mockCommentsByMode: Record<LiveModeId, string[]> = {
  commerce: [
    '가격 얼마예요?',
    '배송은 언제 되나요?',
    '지금 사면 할인되나요?',
    '링크 어디 있어요?',
    '사고 싶은데 사이즈가 고민돼요',
  ],
  education: [
    '여기 다시 설명해주세요',
    '예시는 없나요?',
    '실습하다가 오류가 나요',
    '속도가 좀 빨라요',
    '자료 받을 수 있나요?',
  ],
  fandom: [
    'ㅋㅋㅋㅋㅋㅋ',
    '이거 클립 따야 한다',
    '오늘 텐션 미쳤다',
    '방금 말 공식 밈 가자',
    '다음에는 이 게임 해주세요',
  ],
  issue: [
    '그 주장은 근거가 있나요?',
    '팩트체크 필요합니다',
    '정책 효과보다 예산 문제가 핵심 아닌가요?',
    '인신공격 말고 근거로 봅시다',
    '이 논점은 다른 문제로 넘어간 것 같아요',
  ],
};

const categoryRules: Record<LiveModeId, Array<{ category: string; keywords: string[]; sentiment?: CommentAnalysis['sentiment']; urgency?: CommentAnalysis['urgency'] }>> = {
  commerce: [
    { category: 'price_question', keywords: ['가격', '얼마', '할인', '혜택'], urgency: 'high' },
    { category: 'purchase_intent', keywords: ['사고', '구매', '살게요', '결제'], sentiment: 'positive', urgency: 'medium' },
    { category: 'delivery_question', keywords: ['배송', '언제 오', '택배'], urgency: 'medium' },
    { category: 'stock_question', keywords: ['재고', '품절', '남았'], urgency: 'medium' },
    { category: 'option_question', keywords: ['사이즈', '옵션', '색상'], urgency: 'medium' },
    { category: 'comparison_question', keywords: ['비교', '다른', '차이'], urgency: 'medium' },
    { category: 'hesitation', keywords: ['고민', '망설', '괜찮을까', '환불'], sentiment: 'neutral', urgency: 'high' },
    { category: 'complaint', keywords: ['비싸', '별로', '불만'], sentiment: 'negative', urgency: 'high' },
    { category: 'link_request', keywords: ['링크', '어디', '주소'], urgency: 'medium' },
    { category: 'positive_reaction', keywords: ['좋아요', '예쁘', '대박'], sentiment: 'positive', urgency: 'low' },
  ],
  education: [
    { category: 'understood', keywords: ['이해', '알겠', '쉽네요'], sentiment: 'positive', urgency: 'low' },
    { category: 'confusion', keywords: ['다시', '헷갈', '모르', '어려워'], sentiment: 'negative', urgency: 'high' },
    { category: 'repeated_question', keywords: ['질문', '한번 더', '다시 설명'], urgency: 'medium' },
    { category: 'practice_error', keywords: ['오류', '에러', '안 돼', '안되', '막혀'], sentiment: 'negative', urgency: 'high' },
    { category: 'example_request', keywords: ['예시', '예제'], urgency: 'medium' },
    { category: 'material_request', keywords: ['자료', '파일', '슬라이드'], urgency: 'medium' },
    { category: 'speed_complaint', keywords: ['빨라', '속도'], sentiment: 'negative', urgency: 'medium' },
    { category: 'difficulty_reaction', keywords: ['어렵', '난이도'], sentiment: 'negative', urgency: 'medium' },
    { category: 'next_topic_request', keywords: ['다음', '다음 주제'], urgency: 'low' },
  ],
  fandom: [
    { category: 'laughter', keywords: ['ㅋㅋ', 'ㅎㅎ', '웃겨'], sentiment: 'positive', urgency: 'medium' },
    { category: 'excitement', keywords: ['텐션', '미쳤', '대박'], sentiment: 'positive', urgency: 'medium' },
    { category: 'meme_candidate', keywords: ['밈', '공식', '유행'], sentiment: 'positive', urgency: 'high' },
    { category: 'fan_affection', keywords: ['사랑', '좋아', '최고'], sentiment: 'positive', urgency: 'medium' },
    { category: 'playful_teasing', keywords: ['놀리', '귀엽', '킹받'], sentiment: 'positive', urgency: 'low' },
    { category: 'request', keywords: ['해주세요', '해줘', '다음에는'], urgency: 'medium' },
    { category: 'nickname_mention', keywords: ['닉네임', '별명'], sentiment: 'positive', urgency: 'low' },
    { category: 'clip_candidate', keywords: ['클립', '따야', '저장'], sentiment: 'positive', urgency: 'high' },
    { category: 'mood_drop', keywords: ['조용', '재미없', '식었'], sentiment: 'negative', urgency: 'medium' },
    { category: 'conflict', keywords: ['싸우', '그만', '분쟁'], sentiment: 'negative', urgency: 'high' },
  ],
  issue: [
    { category: 'support_opinion', keywords: ['찬성', '동의'], sentiment: 'positive', urgency: 'low' },
    { category: 'opposition_opinion', keywords: ['반대', '아닌'], sentiment: 'negative', urgency: 'low' },
    { category: 'conditional_agreement', keywords: ['조건', '다만'], urgency: 'low' },
    { category: 'evidence_request', keywords: ['근거', '출처'], urgency: 'high' },
    { category: 'fact_check_needed', keywords: ['팩트', '확인', '검증'], urgency: 'high' },
    { category: 'new_issue', keywords: ['새로운', '핵심', '예산'], urgency: 'medium' },
    { category: 'topic_drift', keywords: ['논점', '넘어간', '다른 문제'], urgency: 'medium' },
    { category: 'personal_attack', keywords: ['인신공격', '비난'], sentiment: 'negative', urgency: 'high' },
    { category: 'emotional_escalation', keywords: ['화난', '분노', '과열'], sentiment: 'negative', urgency: 'high' },
    { category: 'hate_or_violent_expression', keywords: ['혐오', '폭력'], sentiment: 'negative', urgency: 'high' },
    { category: 'unverified_claim', keywords: ['카더라', '확실히', '무조건'], urgency: 'high' },
    { category: 'host_question', keywords: ['질문', '어떻게 보'], urgency: 'medium' },
    { category: 'next_topic_request', keywords: ['다음 주제', '다뤄'], urgency: 'low' },
  ],
};

export function analyzeComments(input: AnalyzeCommentsInput): AnalyzeCommentsResult {
  const now = input.now ?? new Date();
  const analyses = input.comments.map((text, index) => {
    const rule = categoryRules[input.mode].find((item) => item.keywords.some((keyword) => text.includes(keyword)));

    return {
      id: `${input.mode}-${index}`,
      text,
      author: `mock-user-${index + 1}`,
      timestamp: new Date(now.getTime() - (input.comments.length - index) * 12000).toISOString(),
      mode: input.mode,
      category: rule?.category ?? liveModeById[input.mode].categories[0],
      topic: inferTopic(input.mode, text),
      sentiment: rule?.sentiment ?? 'neutral',
      urgency: rule?.urgency ?? 'low',
      actionNeeded: (rule?.urgency ?? 'low') !== 'low',
    } satisfies CommentAnalysis;
  });

  return {
    analyses,
    metrics: buildMetrics(input.mode, analyses),
    distribution: buildDistribution(input.mode, analyses),
  };
}

export function buildPostLiveReport(mode: LiveModeId, analyses: CommentAnalysis[]): PostLiveReport {
  const modeConfig = liveModeById[mode];
  const distribution = buildDistribution(mode, analyses);
  const topCategories = Object.entries(distribution)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, count]) => `${category}: ${count}건`);

  return {
    mode,
    title: `${modeConfig.label} 종료 리포트 미리보기`,
    summary: `${analyses.length}개 mock 댓글을 기준으로 ${modeConfig.shortLabel} 목적에 맞는 핵심 흐름을 정리했습니다.`,
    sections: modeConfig.reportSections.map((title, index) => ({
      title,
      items: buildReportItems(mode, title, analyses, topCategories, index),
    })),
  };
}

function buildDistribution(mode: LiveModeId, analyses: CommentAnalysis[]): Record<string, number> {
  return liveModeById[mode].categories.reduce((acc, category) => {
    acc[category] = analyses.filter((analysis) => analysis.category === category).length;
    return acc;
  }, {} as Record<string, number>);
}

function buildMetrics(mode: LiveModeId, analyses: CommentAnalysis[]): RadarMetric[] {
  const count = (category: string) => analyses.filter((analysis) => analysis.category === category).length;
  const urgent = analyses.filter((analysis) => analysis.urgency === 'high').length;

  const metricValue = (value: number, warningAt: number, dangerAt: number): RadarStatus => {
    if (value >= dangerAt) return 'danger';
    if (value >= warningAt) return 'warning';
    return value > 0 ? 'normal' : 'good';
  };

  if (mode === 'commerce') {
    const priceQuestions = count('price_question');
    const purchaseIntent = count('purchase_intent') + count('link_request');
    const hesitation = count('hesitation') + count('option_question');
    return [
      metric('purchase_temperature', '구매 온도', Math.min(100, purchaseIntent * 28 + priceQuestions * 14), '%', '구매 의도와 링크 요청을 합산한 전환 열기', purchaseIntent >= 2 ? 'good' : 'normal'),
      metric('price_questions', '가격 질문 수', priceQuestions, '건', '가격, 할인, 혜택 문의 수', metricValue(priceQuestions, 1, 3)),
      metric('purchase_intent', '구매 의도 댓글 수', purchaseIntent, '건', '구매 방법 안내가 필요한 댓글 수', purchaseIntent >= 2 ? 'good' : 'normal'),
      metric('hesitation', '망설임 댓글 수', hesitation, '건', '사이즈, 옵션, 환불 등 불안 신호', metricValue(hesitation, 1, 2)),
      metric('complaint_risk', '불만 위험도', count('complaint'), '건', '부정 반응 또는 불만 신호', metricValue(count('complaint'), 1, 2)),
      metric('conversion_timing', '전환 타이밍', purchaseIntent + priceQuestions >= 3 ? '지금' : '대기', undefined, '구매 방법을 다시 안내할 타이밍', purchaseIntent + priceQuestions >= 3 ? 'good' : 'normal'),
    ];
  }

  if (mode === 'education') {
    const confusion = count('confusion') + count('difficulty_reaction');
    const errors = count('practice_error');
    return [
      metric('understanding', '이해도', Math.max(0, 100 - confusion * 24 - errors * 18), '%', '혼란/오류 댓글을 반영한 이해 신호', confusion === 0 ? 'good' : 'warning'),
      metric('confusion', '혼란도', confusion, '건', '다시 설명, 어렵다 반응', metricValue(confusion, 1, 2)),
      metric('repeated_questions', '반복 질문 수', count('repeated_question') + count('example_request'), '건', 'Q&A 전환이 필요한 질문량', metricValue(count('repeated_question') + count('example_request'), 1, 2)),
      metric('practice_errors', '실습 오류 수', errors, '건', '실습 막힘 또는 오류 댓글', metricValue(errors, 1, 2)),
      metric('qa_need', 'Q&A 필요도', confusion + errors >= 2 ? '높음' : '보통', undefined, '잠깐 멈추고 질문을 받아야 할 정도', confusion + errors >= 2 ? 'warning' : 'normal'),
      metric('explain_need', '설명 보완 필요도', count('example_request') + count('speed_complaint'), '건', '예시 추가와 속도 조절 필요 신호', metricValue(count('example_request') + count('speed_complaint'), 1, 2)),
    ];
  }

  if (mode === 'fandom') {
    const hype = count('laughter') + count('excitement') + count('meme_candidate');
    return [
      metric('broadcast_energy', '방송 텐션', Math.min(100, 55 + hype * 12), '%', '웃음, 밈, 텐션 반응을 합친 분위기', hype >= 2 ? 'good' : 'normal'),
      metric('laughter', '웃음 반응 수', count('laughter'), '건', '웃음 댓글 수', count('laughter') > 0 ? 'good' : 'normal'),
      metric('meme_candidates', '밈 후보 수', count('meme_candidate'), '건', '반복 가능한 표현 후보', count('meme_candidate') > 0 ? 'good' : 'normal'),
      metric('clip_candidates', '클립 후보 구간', count('clip_candidate'), '건', '클립 저장 후보 댓글', count('clip_candidate') > 0 ? 'good' : 'normal'),
      metric('fan_affection', '팬 충성 반응', count('fan_affection') + count('request'), '건', '애정 표현과 다음 콘텐츠 요청', 'good'),
      metric('mood_risk', '분위기 위험도', count('mood_drop') + count('conflict'), '건', '분위기 하락 또는 충돌 신호', metricValue(count('mood_drop') + count('conflict'), 1, 2)),
    ];
  }

  return [
    metric('topic_focus', '논점 집중도', Math.max(0, 100 - count('topic_drift') * 22), '%', '논점 이탈을 제외한 집중 흐름', count('topic_drift') > 0 ? 'warning' : 'good'),
    metric('conflict_heat', '갈등 과열도', urgent, '건', '개인 비난, 과열, 검증 필요 신호', metricValue(urgent, 2, 4)),
    metric('factcheck_needed', '팩트체크 필요 건수', count('fact_check_needed') + count('evidence_request'), '건', '근거/팩트체크 요청', metricValue(count('fact_check_needed') + count('evidence_request'), 1, 2)),
    metric('new_issues', '새 쟁점 수', count('new_issue'), '건', '새로 떠오른 논점', metricValue(count('new_issue'), 1, 3)),
    metric('topic_drift', '논점 이탈도', count('topic_drift'), '건', '현재 주제에서 벗어난 흐름', metricValue(count('topic_drift'), 1, 2)),
    metric('question_density', '질문 밀도', count('host_question') + count('evidence_request'), '건', '진행자가 받아야 할 질문량', metricValue(count('host_question') + count('evidence_request'), 1, 3)),
  ];
}

function metric(id: string, label: string, value: number | string, unit: string | undefined, description: string, status: RadarStatus): RadarMetric {
  return { id, label, value, unit, description, status };
}

function inferTopic(mode: LiveModeId, text: string): string {
  if (mode === 'commerce') return text.includes('배송') ? '배송/구매 조건' : '상품 전환';
  if (mode === 'education') return text.includes('오류') ? '실습 오류' : '설명 이해';
  if (mode === 'fandom') return text.includes('클립') ? '하이라이트' : '팬 반응';
  return text.includes('근거') || text.includes('팩트') ? '검증 필요 주장' : '논점 구조';
}

function buildReportItems(mode: LiveModeId, title: string, analyses: CommentAnalysis[], topCategories: string[], index: number): string[] {
  const evidence = analyses.slice(0, 3).map((analysis) => `"${analysis.text}"`);

  if (mode === 'issue' && title.includes('팩트체크')) {
    return ['근거/출처 요청은 단정하지 않고 확인 필요로 표시합니다.', ...evidence.slice(0, 2)];
  }

  if (topCategories.length > 0) {
    return [topCategories[index % topCategories.length], evidence[index % Math.max(1, evidence.length)] ?? '추가 데이터 수집 필요'];
  }

  return ['아직 충분한 댓글 신호가 없어 다음 라이브에서 추가 수집이 필요합니다.'];
}
