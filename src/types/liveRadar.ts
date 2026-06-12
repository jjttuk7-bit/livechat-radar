export type LiveModeId = 'commerce' | 'education' | 'fandom' | 'issue';

export type AlertPriority = 'low' | 'medium' | 'high';
export type RadarStatus = 'good' | 'normal' | 'warning' | 'danger';

export type AlertRule = {
  id: string;
  label: string;
  conditionDescription: string;
  message: string;
  suggestedLine: string;
  priority: AlertPriority;
};

export type LiveModeConfig = {
  id: LiveModeId;
  label: string;
  shortLabel: string;
  userGoalText: string;
  description: string;
  recommendedFor: string;
  categories: string[];
  metrics: string[];
  alertRules: AlertRule[];
  reportSections: string[];
  safetyGuidelines?: string[];
};

export type CommentAnalysis = {
  id: string;
  text: string;
  author?: string;
  timestamp: string;
  mode: LiveModeId;
  category: string;
  topic?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: AlertPriority;
  actionNeeded: boolean;
};

export type RadarMetric = {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  description: string;
  status: RadarStatus;
};

export type ActionCard = {
  id: string;
  mode: LiveModeId;
  priority: AlertPriority;
  title: string;
  reason: string;
  suggestedLine: string;
  evidence: string[];
};

export type PostLiveReport = {
  mode: LiveModeId;
  title: string;
  summary: string;
  sections: {
    title: string;
    items: string[];
  }[];
};

export type AnalyzeCommentsInput = {
  mode: LiveModeId;
  comments: string[];
  now?: Date;
};

export type AnalyzeCommentsResult = {
  analyses: CommentAnalysis[];
  metrics: RadarMetric[];
  distribution: Record<string, number>;
};
