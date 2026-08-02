import { normalizeCacheTopic } from "@/lib/ai/types";
import type { FamiliarTopic, RecentTopicPractice } from "@/lib/personalization/types";

export const FAMILIAR_TOPIC_THRESHOLD = 3;

export function findFamiliarTopics(rows: RecentTopicPractice[]): FamiliarTopic[] {
  const groups = new Map<string, FamiliarTopic>();

  for (const row of rows) {
    const topic = row.topic?.trim().replace(/\s+/gu, " ");
    if (!topic) {
      continue;
    }

    const normalizedTopic = normalizeCacheTopic(topic);
    const existing = groups.get(normalizedTopic);
    if (!existing) {
      groups.set(normalizedTopic, {
        topic,
        normalizedTopic,
        count: 1,
        lastPracticedAt: row.createdAt
      });
      continue;
    }

    existing.count += 1;
    if (row.createdAt > existing.lastPracticedAt) {
      existing.topic = topic;
      existing.lastPracticedAt = row.createdAt;
    }
  }

  return [...groups.values()]
    .filter((group) => group.count >= FAMILIAR_TOPIC_THRESHOLD)
    .sort((left, right) => (
      right.count - left.count ||
      right.lastPracticedAt.localeCompare(left.lastPracticedAt) ||
      left.normalizedTopic.localeCompare(right.normalizedTopic)
    ));
}

