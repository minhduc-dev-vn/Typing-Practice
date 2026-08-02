import { findFamiliarTopics } from "@/lib/personalization/algorithm";
import { getDefaultTopic } from "@/lib/personalization/defaults";
import { generateRelatedTopic } from "@/lib/personalization/generate-related";
import type { TopicSuggestionRepository } from "@/lib/personalization/repository";
import type { DailySuggestion } from "@/lib/personalization/types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface DailySuggestionDependencies {
  repository: TopicSuggestionRepository;
  generate?: (sourceTopic: string) => Promise<string>;
  now?: Date;
}

export async function createDailySuggestion(
  userId: string,
  dependencies: DailySuggestionDependencies
): Promise<DailySuggestion> {
  const now = dependencies.now ?? new Date();
  const day = now.toISOString().slice(0, 10);
  const rows = await dependencies.repository.listRecentTopics(
    userId,
    new Date(now.getTime() - SEVEN_DAYS_MS)
  );
  const familiarTopics = findFamiliarTopics(rows);

  if (familiarTopics.length === 0) {
    return {
      sourceTopic: null,
      relatedTopic: getDefaultTopic(userId, day),
      reason: "default"
    };
  }

  const candidates: DailySuggestion[] = [];
  const generate = dependencies.generate ?? generateRelatedTopic;

  for (const familiar of familiarTopics) {
    const cached = await dependencies.repository.findSuggestion(familiar.normalizedTopic);
    if (cached) {
      candidates.push({
        sourceTopic: familiar.topic,
        relatedTopic: cached,
        reason: "familiar",
        familiarCount: familiar.count,
        cached: true
      });
      continue;
    }

    try {
      const relatedTopic = await generate(familiar.topic);
      try {
        await dependencies.repository.saveSuggestion(familiar.normalizedTopic, relatedTopic);
      } catch {
        // The current recommendation is still useful if a transient cache write
        // fails. A later request may retry the write.
      }
      candidates.push({
        sourceTopic: familiar.topic,
        relatedTopic,
        reason: "familiar",
        familiarCount: familiar.count,
        cached: false
      });
    } catch {
      // A recommendation must never prevent normal practice. Try the next
      // familiar topic, then use a static suggestion if none can be prepared.
    }
  }

  return candidates[0] ?? {
    sourceTopic: null,
    relatedTopic: getDefaultTopic(userId, day),
    reason: "default"
  };
}

