import { liveModeById } from '../config/liveModes';
import { ActionCard, CommentAnalysis, LiveModeId } from '../types/liveRadar';

export function generateActionCards(mode: LiveModeId, analyses: CommentAnalysis[]): ActionCard[] {
  const config = liveModeById[mode];
  const cards = config.alertRules.map((rule) => {
    const evidence = pickEvidence(mode, rule.id, analyses);

    return {
      id: rule.id,
      mode,
      priority: rule.priority,
      title: rule.label,
      reason: buildReason(rule.message, evidence, mode),
      suggestedLine: rule.suggestedLine,
      evidence: evidence.length > 0 ? evidence : analyses.slice(0, 2).map((analysis) => analysis.text),
    } satisfies ActionCard;
  });

  return cards.slice(0, 3);
}

function pickEvidence(mode: LiveModeId, ruleId: string, analyses: CommentAnalysis[]): string[] {
  const categoriesByRule: Record<string, string[]> = {
    'commerce-price-repeat': ['price_question'],
    'commerce-link-guide': ['purchase_intent', 'link_request'],
    'commerce-hesitation': ['hesitation', 'delivery_question', 'option_question'],
    'education-explain-again': ['confusion', 'difficulty_reaction', 'example_request'],
    'education-qa': ['repeated_question', 'example_request'],
    'education-practice-error': ['practice_error'],
    'fandom-meme': ['meme_candidate', 'excitement'],
    'fandom-clip': ['laughter', 'clip_candidate'],
    'fandom-mood': ['mood_drop', 'conflict', 'request'],
    'issue-attack': ['personal_attack', 'emotional_escalation', 'hate_or_violent_expression'],
    'issue-factcheck': ['fact_check_needed', 'evidence_request', 'unverified_claim'],
    'issue-new-topic': ['new_issue', 'topic_drift', 'next_topic_request'],
  };

  const categories = categoriesByRule[ruleId] ?? liveModeById[mode].categories;
  return analyses
    .filter((analysis) => categories.includes(analysis.category))
    .slice(0, 3)
    .map((analysis) => analysis.text);
}

function buildReason(baseMessage: string, evidence: string[], mode: LiveModeId): string {
  const suffix = evidence.length > 0 ? ` 최근 댓글 ${evidence.length}건에서 관련 신호가 감지되었습니다.` : ' 현재 mock 흐름 기준으로 선제 안내가 필요합니다.';

  if (mode === 'issue') {
    return `${baseMessage} 중립적 표현으로 논점 구조와 확인 필요 사항만 정리하세요.`;
  }

  return `${baseMessage}${suffix}`;
}
