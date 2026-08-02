export interface RecentTopicPractice {
  topic: string | null;
  createdAt: string;
}

export interface FamiliarTopic {
  topic: string;
  normalizedTopic: string;
  count: number;
  lastPracticedAt: string;
}

export interface DailySuggestion {
  sourceTopic: string | null;
  relatedTopic: string;
  reason: "familiar" | "default";
  familiarCount?: number;
  cached?: boolean;
}

